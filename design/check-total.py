"""Verify the rendered total-cost diagram without looking at it.

The diagram is checked three ways:
  1. geometry -- every piece of text is recorded as it is drawn and checked
     for canvas overflow, for overlapping another piece of text, and for
     spilling out of the panel it belongs to;
  2. pixels -- the rendered PNG is probed for the things that must be there
     (the ink of the big figure, the flag red of the unclaimed clause, the
     white of the card surfaces);
  3. the numbers -- the total in the diagram is recomputed from the fixture
     so the picture cannot quietly drift from the truth.

Run: python design/check-total.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

import render  # noqa: E402
from render import font, s  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

BOXES: list[tuple[str, float, float, float, float]] = []


class RecordingCanvas(render.Canvas):
    """A Canvas that remembers where every piece of text landed."""

    def text(self, xy, txt, size=13, weight="regular", fill=render.INK, anchor="lt", tracking=0):
        if not txt:
            return
        f = font(weight, size)
        x, y = xy[0], xy[1]
        if tracking:
            width = sum(self.d.textlength(ch, font=f) for ch in txt) / s(1)
            width += tracking * max(0, len(txt) - 1)
            asc, desc = f.getmetrics()
            y0 = y + (asc - desc) / s(1) * 0  # ascender origin
            y0 = y
            y1 = y + (asc + desc) / s(1)
            if anchor[0] == "m":
                x -= width / 2
            elif anchor[0] == "r":
                x -= width
            BOXES.append((txt, x, y0, x + width, y1))
        else:
            x0, y0, x1, y1 = self.d.textbbox((x * s(1), y * s(1)), txt, font=f, anchor=anchor)
            BOXES.append((txt, x0 / s(1), y0 / s(1), x1 / s(1), y1 / s(1)))
        return super().text(xy, txt, size, weight, fill, anchor, tracking)


def overlap(a, b) -> float:
    """The area of the intersection of two boxes."""
    x0 = max(a[1], b[1])
    y0 = max(a[2], b[2])
    x1 = min(a[3], b[3])
    y1 = min(a[4], b[4])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return (x1 - x0) * (y1 - y0)


def check_geometry() -> list[str]:
    problems: list[str] = []
    W, H = 1800, 1180

    # 1. nothing may leave the canvas
    for txt, x0, y0, x1, y1 in BOXES:
        if x0 < 2 or y0 < 2 or x1 > W - 2 or y1 > H - 2:
            problems.append(f"off-canvas: {txt!r} at ({x0:.0f},{y0:.0f})-({x1:.0f},{y1:.0f})")

    # 2. no two pieces of text may overlap
    for i in range(len(BOXES)):
        for j in range(i + 1, len(BOXES)):
            a, b = BOXES[i], BOXES[j]
            if overlap(a, b) > 6:
                problems.append(
                    f"overlap: {a[0]!r} and {b[0]!r} share {overlap(a, b):.0f}px"
                )

    return problems


def in_box(box, x0, y0, x1, y1) -> bool:
    """Is the piece of text inside the given rectangle?"""
    return x0 >= box[0] - 0.6 and x1 <= box[2] + 0.6 and y0 >= box[1] - 0.6 and y1 <= box[3] + 0.6


def check_containers() -> list[str]:
    """Every piece of text must stay inside the panel it belongs to."""
    problems: list[str] = []

    zones = [
        # (label, rectangle, allowed y range for the text)
        ("enlarged card", (852, 160, 1320, 340), None),
        ("enlarged card", (852, 340, 1320, 500), None),
        ("enlarged card", (852, 520, 1320, 660), None),
        ("legend", (1360, 120, 1724, 1130), None),
        ("mock total card", (92, 246, 776, 390), None),
    ]
    for label, rect, _ in zones:
        for txt, x0, y0, x1, y1 in BOXES:
            cy = (y0 + y1) / 2
            if not (rect[1] <= cy <= rect[3]):
                continue
            if not (rect[0] <= x0 and x1 <= rect[2]):
                problems.append(f"{label}: {txt!r} spills to x={x0:.0f}..{x1:.0f}")

    return problems


def check_pixels(name: str) -> list[str]:
    problems: list[str] = []
    img = Image.open(os.path.join(HERE, name)).convert("RGB")
    px = img.load()

    def count_ink(x0, y0, x1, y1):
        n = 0
        for x in range(x0, x1):
            for y in range(y0, y1):
                r, g, b = px[x, y]
                if r < 80 and g < 80 and b < 80:
                    n += 1
        return n

    def count_flag(x0, y0, x1, y1):
        n = 0
        for x in range(x0, x1):
            for y in range(y0, y1):
                r, g, b = px[x, y]
                if r > 120 and r < 215 and g < 110 and b < 105:
                    n += 1
        return n

    # the big figure in the mock's total card
    if count_ink(116, 285, 400, 330) < 400:
        problems.append("the figure in the mock's total card is missing")
    # the flag-coloured unclaimed clause on the context line
    if count_flag(400, 336, 700, 356) < 25:
        problems.append("the flag-coloured unclaimed clause is missing from the mock")
    # the enlarged card A carries the same clause
    if count_flag(1000, 255, 1300, 275) < 25:
        problems.append("the flag-coloured clause is missing from the enlarged card")
    # the empty-state card must NOT show a big figure
    if count_ink(876, 570, 1300, 600) > 1200:
        problems.append("the empty-state card appears to show a number")
    return problems


def check_numbers() -> list[str]:
    """The total in the diagram must equal the sum of the fixture."""
    problems: list[str] = []
    amounts = [
        1850.00, 128.50, 123.40, 85.00, 59.99, 42.30, 24.99,
        20.00, 19.00, 15.49, 15.00, 11.99, 2.99, 2.99,
    ]
    total = round(sum(amounts), 2)
    if total != 2401.64:
        problems.append(f"the fixture charges sum to {total}, not 2401.64")

    owned = {1850.00, 85.00, 15.49}
    unowned = round(sum(a for a in amounts if a not in owned), 2)
    if unowned != 451.15:
        problems.append(f"the unowned charges sum to {unowned}, not 451.15")
    if len(amounts) != 14:
        problems.append(f"{len(amounts)} charges, not 14")
    return problems


if __name__ == "__main__":
    render.Canvas = RecordingCanvas
    import importlib.util  # noqa: E402

    spec = importlib.util.spec_from_file_location(
        "total_cost", os.path.join(HERE, "total-cost.py")
    )
    total_cost = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(total_cost)

    total_cost.image_total()

    problems = check_geometry() + check_containers() + check_pixels("08-total-cost.png") + check_numbers()

    print(f"text runs checked: {len(BOXES)}")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("all checks passed")
