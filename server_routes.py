import os
import re
import json
import asyncio
import urllib.request
import ssl
import threading
import folder_paths
from server import PromptServer

KREA2_BASE = "Krea2_lora_lib"
HF_README_URL = "https://huggingface.co/ilkerzgi/fal-Krea-2-Style-LoRAs/raw/main/README.md"
INDEX_PATH = os.path.join(os.path.dirname(__file__), "loras_index.json")


def get_krea2_dir():
    return os.path.join(folder_paths.get_folder_paths("loras")[0], KREA2_BASE)


def get_lora_path(category, filename):
    return os.path.join(get_krea2_dir(), category, filename)


def is_downloaded(category, filename):
    return os.path.exists(get_lora_path(category, filename))


def load_local_index():
    if not os.path.exists(INDEX_PATH):
        return {}
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_local_index(data):
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def parse_readme(text):
    lines = text.split("\n")
    categories = {}
    current_category = None

    for line in lines:
        cat_match = re.match(r"^### (.+?) \((\d+)\)", line)
        if cat_match:
            current_category = cat_match.group(1)
            categories[current_category] = []
            continue

        if current_category and "| <img src=" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 6:
                continue

            name_raw = parts[2]
            name_link = re.search(r"\[([^\]]+)\]\(([^)]+)\)", name_raw)
            name = name_link.group(1) if name_link else name_raw.strip()

            trigger_match = re.search(r"`([^`]+)`", parts[3])
            trigger = trigger_match.group(1) if trigger_match else ""

            comfy_match = re.search(r"\[comfy\]\(([^)]+)\)", parts[5])
            comfy_url = comfy_match.group(1) if comfy_match else ""
            filename = comfy_url.split("/")[-1] if comfy_url else ""

            if name and filename:
                preview_match = re.search(r'<img src="([^"]+)"', parts[1])
                preview = preview_match.group(1) if preview_match else ""
                categories[current_category].append({
                    "name": name,
                    "filename": filename,
                    "trigger": trigger,
                    "comfy_url": comfy_url,
                    "preview": preview,
                })

    return categories


def merge_indexes(local, remote):
    local_fns = set()
    for cat, loras in local.items():
        for l in loras:
            local_fns.add(l["filename"])

    added = 0
    for cat, loras in remote.items():
        if cat not in local:
            local[cat] = []
        existing_fns = {l["filename"] for l in local[cat]}
        for lora in loras:
            if lora["filename"] not in local_fns and lora["filename"] not in existing_fns:
                local[cat].append(lora)
                added += 1

    return local, added


def sync_index_from_hf():
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(HF_README_URL, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, context=ctx, timeout=30)
        data = resp.read().decode("utf-8")
        remote = parse_readme(data)

        local = load_local_index()
        if not local:
            save_local_index(remote)
            print(f"[Krea2LoraLib] Created index with {sum(len(v) for v in remote.values())} LoRAs")
        else:
            merged, added = merge_indexes(local, remote)
            if added:
                save_local_index(merged)
                print(f"[Krea2LoraLib] Added {added} new LoRAs (total: {sum(len(v) for v in merged.values())})")
    except Exception as e:
        print(f"[Krea2LoraLib] Sync error: {e}")


@PromptServer.instance.routes.get("/krea2-loralib/index")
async def handle_index(request):
    from aiohttp import web
    data = load_local_index()
    for cat, loras in data.items():
        for lora in loras:
            lora["downloaded"] = is_downloaded(cat, lora["filename"])
    return web.json_response(data)


@PromptServer.instance.routes.post("/krea2-loralib/download")
async def handle_download(request):
    from aiohttp import web
    body = await request.json()
    filename = body.get("filename", "")
    comfy_url = body.get("comfy_url", "")
    category = body.get("category", "")

    if not filename or not comfy_url or not category:
        return web.json_response({"error": "Missing filename, comfy_url, or category"}, status=400)

    dest = get_lora_path(category, filename)
    if os.path.exists(dest):
        return web.json_response({"status": "already_exists", "path": dest})

    os.makedirs(os.path.dirname(dest), exist_ok=True)

    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(comfy_url, headers={"User-Agent": "Mozilla/5.0"})

        def _download():
            resp = urllib.request.urlopen(req, context=ctx, timeout=300)
            with open(dest, "wb") as f:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _download)
        return web.json_response({"status": "ok", "path": dest})
    except Exception as e:
        if os.path.exists(dest):
            os.remove(dest)
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post("/krea2-loralib/download-all")
async def handle_download_all(request):
    from aiohttp import web
    body = await request.json()
    entries = body.get("entries", [])
    if not entries:
        return web.json_response({"error": "No entries"}, status=400)

    results = []
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for entry in entries:
        filename = entry.get("filename", "")
        comfy_url = entry.get("comfy_url", "")
        category = entry.get("category", "")
        dest = get_lora_path(category, filename)

        if os.path.exists(dest):
            results.append({"filename": filename, "status": "already_exists"})
            continue

        os.makedirs(os.path.dirname(dest), exist_ok=True)

        try:
            req = urllib.request.Request(comfy_url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, context=ctx, timeout=300)
            with open(dest, "wb") as f:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
            results.append({"filename": filename, "status": "ok"})
        except Exception as e:
            if os.path.exists(dest):
                os.remove(dest)
            results.append({"filename": filename, "status": "error", "error": str(e)})

    return web.json_response({"results": results})


@PromptServer.instance.routes.post("/krea2-loralib/delete")
async def handle_delete(request):
    from aiohttp import web
    body = await request.json()
    filename = body.get("filename", "")
    if not filename:
        return web.json_response({"error": "Missing filename"}, status=400)

    base = get_krea2_dir()
    if not os.path.isdir(base):
        return web.json_response({"error": "Krea2_lora_lib folder not found"}, status=404)

    for cat in os.listdir(base):
        cat_path = os.path.join(base, cat)
        if os.path.isdir(cat_path):
            fpath = os.path.join(cat_path, filename)
            if os.path.isfile(fpath):
                os.remove(fpath)
                if not os.listdir(cat_path):
                    os.rmdir(cat_path)
                return web.json_response({"status": "ok", "path": fpath})

    return web.json_response({"error": f"File not found: {filename}"}, status=404)


threading.Thread(target=sync_index_from_hf, daemon=True).start()
