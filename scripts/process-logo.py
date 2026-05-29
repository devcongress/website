#!/usr/bin/env python3
"""
Process the DevCongress logo PNG into all required sizes.
Usage: python3 scripts/process-logo.py <path-to-logo.png>
       python3 scripts/process-logo.py  (uses public/images/logo-source.png by default)
"""

import sys
import os
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "public/images/logo-source.png"
OUT = "public/images"

os.makedirs(OUT, exist_ok=True)

if not os.path.exists(SRC):
    print(f"ERROR: source file not found: {SRC}")
    print("Place the logo PNG at public/images/logo-source.png and re-run.")
    sys.exit(1)

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"Source: {SRC} ({w}x{h})")

# Output sizes and destinations
outputs = [
    ("logo.png",            None),       # original optimised
    ("logo@2x.png",         None),       # same as original (already HiDPI)
    ("logo-nav.png",        (240, None)),# navbar: 240px wide, height auto
    ("logo-nav@2x.png",     (480, None)),
    ("favicon-16.png",      (16, 16)),
    ("favicon-32.png",      (32, 32)),
    ("favicon-180.png",     (180, 180)), # apple-touch-icon
    ("favicon-512.png",     (512, 512)), # PWA icon
]

def resize(img, size):
    if size is None:
        return img.copy()
    tw, th = size
    if th is None:
        # width-only: scale height proportionally
        ratio = tw / img.width
        th = round(img.height * ratio)
        return img.resize((tw, th), Image.LANCZOS)
    # both dimensions: fit inside box, preserve aspect
    img2 = img.copy()
    img2.thumbnail((tw, th), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    x = (tw - img2.width) // 2
    y = (th - img2.height) // 2
    canvas.paste(img2, (x, y))
    return canvas

for fname, size in outputs:
    out_img = resize(img, size)
    path = os.path.join(OUT, fname)
    out_img.save(path, "PNG", optimize=True)
    print(f"  wrote {path}  ({out_img.width}x{out_img.height})")

# Write favicon.ico (multi-size)
ico_sizes = [(16,16), (32,32), (48,48)]
ico_imgs  = [resize(img, s) for s in ico_sizes]
ico_path  = "public/favicon.ico"
ico_imgs[0].save(ico_path, format="ICO", sizes=ico_sizes,
                 append_images=ico_imgs[1:])
print(f"  wrote {ico_path}")

print("\nDone. Drop the output files are in public/images/ and public/favicon.ico.")
