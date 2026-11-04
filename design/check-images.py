"""Sanity-check rendered design images: nothing may be clipped by the canvas edge.

Run: python design/check-images.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

from render import CANVAS  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MARGIN = 8  # in CSS pixels, at 1x


def check(name: str) -> bool:
    path = os.path.join(HERE, name)
    img = Image.open(path).convert("RGB")
    width, height = img.size
    background = tuple(int(CANVAS.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))

    # Crop a thin strip at each edge and look for non-background pixels.
    ok = True
    strips = {
        "left": (0, 0, 2, height),
        "right": (width - 2, 0, width, height),
        "top": (0, 0, width, 2),
        "bottom": (0, height - 2, width, height),
    }
    for side, box in strips.items():
        strip = img.crop(box)
        colours = {c for _, c in (strip.getcolors(maxcolors=100000) or [])}
        if colours - {background}:
            print(f"  {name}: content touches the {side} edge -> possible clipping")
            ok = False

    print(
        f"  {name}: {width}x{height} px, edges clean"
        if ok
        else f"  {name}: CLIPPING"
    )
    return ok


if __name__ == "__main__":
    print("checking rendered designs")
    results = [check(name) for name in ("05-recurring-charges.png", "06-recurring-rules.png")]
    sys.exit(0 if all(results) else 1)
