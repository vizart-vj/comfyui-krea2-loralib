import os
import json
import folder_paths
import comfy.utils
import comfy.sd

KREA2_BASE = "Krea2_lora_lib"


def get_lora_path(category, filename):
    loras_dir = folder_paths.get_folder_paths("loras")[0]
    return os.path.join(loras_dir, KREA2_BASE, category, filename)


class Krea2LoraLib:
    """Browse, download, and apply Krea 2 Style LoRAs from a curated HuggingFace collection."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "loras_config": ("STRING", {
                    "default": "[]",
                    "multiline": True,
                    "hidden": True,
                }),
            },
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("model", "clip", "trigger_string")
    FUNCTION = "apply_loras"
    CATEGORY = "loaders/loras"
    DESCRIPTION = (
        "Browse and apply Krea 2 style LoRAs. "
        "Use the gallery widget to select styles, adjust strength, and toggle enable/disable."
    )

    def _find_lora_on_disk(self, filename, category=""):
        if category:
            p = get_lora_path(category, filename)
            if os.path.exists(p):
                return p
        base = folder_paths.get_folder_paths("loras")[0]
        krea2_root = os.path.join(base, KREA2_BASE)
        if os.path.isdir(krea2_root):
            for cat in os.listdir(krea2_root):
                p = os.path.join(krea2_root, cat, filename)
                if os.path.isfile(p):
                    return p
        return None

    def apply_loras(self, model, clip, loras_config):
        try:
            selected = json.loads(loras_config) if loras_config.strip() else []
        except json.JSONDecodeError:
            selected = []

        triggers = []

        for entry in selected:
            if not entry.get("enabled", False):
                continue

            filename = entry.get("filename", "")
            category = entry.get("category", "")
            strength = entry.get("strength", 1.0)
            trigger = entry.get("trigger", "")

            if not filename:
                continue

            lora_path = self._find_lora_on_disk(filename, category)
            if not lora_path:
                print(f"[Krea2LoraLib] LoRA not found, skipping: {filename}")
                continue

            try:
                lora_data = comfy.utils.load_torch_file(lora_path, safe_load=True)
                model, clip = comfy.sd.load_lora_for_models(
                    model, clip, lora_data, strength, strength
                )
                if trigger:
                    triggers.append(trigger)
            except Exception as e:
                print(f"[Krea2LoraLib] Error applying {filename}: {e}")

        trigger_string = ", ".join(triggers)
        return (model, clip, trigger_string)


NODE_CLASS_MAPPINGS = {
    "Krea2LoraLib": Krea2LoraLib,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Krea2LoraLib": "Krea 2 LoRA Library",
}
