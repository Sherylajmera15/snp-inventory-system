"""
Remove white background from logo_raw.png → logo.png
Run from: frontend/public/
Command:   python remove_bg.py
Requires:  pip install Pillow
"""
from PIL import Image
import numpy as np
import os

INPUT  = os.path.join(os.path.dirname(__file__), "logo_raw.jpg")
OUTPUT = os.path.join(os.path.dirname(__file__), "logo.png")

def remove_white_bg(input_path: str, output_path: str, threshold: int = 230) -> None:
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)

    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

    # How "white" each pixel is — based on the minimum channel (nearest to white = high min)
    whiteness = np.minimum(np.minimum(r, g), b)

    # Pixels above threshold get scaled alpha (smooth edge, not hard cutoff)
    fade_start = threshold - 20  # start fading at this brightness
    scale = np.clip((whiteness - fade_start) / 20.0, 0.0, 1.0)  # 0 = keep, 1 = transparent

    data[:, :, 3] = np.clip(a * (1.0 - scale), 0, 255).astype(np.uint8)

    result = Image.fromarray(data.astype(np.uint8), "RGBA")
    result.save(output_path, "PNG")
    print(f"Done! Transparent logo saved to: {output_path}")

if __name__ == "__main__":
    if not os.path.exists(INPUT):
        print(f"ERROR: Input file not found: {INPUT}")
        print("Save the logo image as 'logo_raw.png' in this folder first.")
    else:
        remove_white_bg(INPUT, OUTPUT)
