# ComfyUI Krea 2 LoRA Library

A ComfyUI custom node for browsing, downloading, and applying [Krea 2 Style LoRAs](https://huggingface.co/ilkerzgi/fal-Krea-2-Style-LoRAs) directly from the node interface.

**1503 style LoRAs** organized into 7 categories, trained on [fal](https://fal.ai) by [ilkerzgi](https://huggingface.co/ilkerzgi).

## Features

- **Gallery** — browse all 1503 styles with preview images, organized by category
- **One-click download** — download any LoRA directly into your ComfyUI `models/loras/` folder
- **My Loras** — manage downloaded LoRAs with enable/disable toggle and strength slider
- **Trigger string output** — automatically builds a comma-separated trigger string from enabled LoRAs
- **Auto-sync** — on startup, fetches the latest LoRA index from HuggingFace and merges new additions
- **Delete from disk** — remove unwanted LoRAs with confirmation

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/vizart-vj/comfyui-krea2-loralib.git
```

Restart ComfyUI.

## Usage

1. Add the **Krea 2 LoRA Library** node (`loaders/loras` category)
2. Connect `MODEL` and `CLIP` inputs from your checkpoint loader
3. Open the **Gallery** tab to browse styles by category
4. Click the ⬇ button on any card to download and add it to **My Loras**
5. In **My Loras**, toggle LoRAs on/off and adjust strength with the slider
6. The `trigger_string` output contains all active trigger phrases — append them to your prompt

## LoRA Storage

Downloaded LoRAs are saved in a structured folder:
```
models/loras/
  Krea2_lora_lib/
    3D & Render/
      airy-porcelain-blue.safetensors
    Cinematic/
      airy-ligne-claire-scifi.safetensors
    Drawing/
      ...
    Graphic/
      ...
    Illustration/
      ...
    Painterly/
      ...
    Photographic/
      ...
```

Category folders are created only when at least one LoRA is downloaded into them.

## Categories

| Category | Count |
|----------|-------|
| 3D & Render | 97 |
| Cinematic | 101 |
| Drawing | 98 |
| Graphic | 126 |
| Illustration | 619 |
| Painterly | 289 |
| Photographic | 173 |
| **Total** | **1503** |

## Credits

- **LoRA weights**: [ilkerzgi/fal-Krea-2-Style-LoRAs](https://huggingface.co/ilkerzgi/fal-Krea-2-Style-LoRAs) — 1503 style LoRAs for [Krea 2 Turbo](https://huggingface.co/krea/Krea-2-Turbo), trained on [fal.ai](https://fal.ai)
- **Base model**: [Krea 2 Turbo](https://huggingface.co/krea/Krea-2-Turbo)
- **License**: [krea-2-community-license](https://huggingface.co/krea/Krea-2-LoRA-impressionist/blob/main/LICENSE.pdf)

## Requirements

- ComfyUI
- `huggingface_hub` is **not** required — the node fetches LoRA files directly via HTTP
