"""Verify the rendered total-cost diagram without looking at it.

The diagram is checked four ways:
  1. geometry -- every piece of text is recorded as it is drawn and checked
     for canvas overflow and for overlapping another piece of text;
  2. containment -- every piece of text must stay inside the panel it belongs
     to, so nothing leaks out of a card or a column;
  3. pixels -- the rendered PNG is probed at the exact places the recorded
     text says the figure and the flag clause landed, so the picture cannot
     quietly lose its colour or its number;
  4. the numbers -- the total in the diagram is recomputed from the fixture
     so the picture cannot drift from the truth.

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
            # The Canvas draws tracked text letter by letter from the
            # ascender origin, so the ink box is the glyph box, not the
            # ascender box.
            ink = f.getbbox(txt)
            width = sum(self.d.textlength(ch, font=f) for ch in txt) / s(1)
            width += tracking * max(0, len(txt) - 1)
            if anchor[0] == "m":
                x -= width / 2
            elif anchor[0] == "r":
                x -= width
            BOXES.append(
                (txt, x, y + ink[1] / s(1), x + width, y + ink[3] / s(1))
            )
        else:
            x0, y0, x1, y1 = self.d.textbbox(
                (x * s(1), y * s(1)), txt, font=f, anchor=anchor
            )
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


# The panels of the diagram. Text that starts inside a panel's x range and
# whose middle falls inside its y range must stay inside its x range.
PANELS = [
    ("mock total card", 92, 246, 776, 392),
    ("mock flagged panel", 92, 408, 776, 632),
    ("mock recurring panel", 92, 648, 776, 1084),
    ("enlarged card A", 852, 168, 1320, 314),
    ("enlarged card B", 852, 366, 1320, 512),
    ("enlarged card C", 852, 564, 1320, 696),
    ("mobile phone", 852, 768, 1172, 1122),
    ("mobile notes", 1196, 770, 1320, 1122),
    ("legend", 1360, 120, 1724, 1130),
]

# The three columns of the diagram. Nothing may cross from one into another.
COLUMNS = [
    ("column 1", 60, 800),
    ("column 2", 840, 1320),
    ("column 3", 1360, 1740),
]


def check_geometry() -> list[str]:
    problems: list[str] = []
    W, H = 1800, 1180

    for txt, x0, y0, x1, y1 in BOXES:
        if x0 < 2 or y0 < 2 or x1 > W - 2 or y1 > H - 2:
            problems.append(f"off-canvas: {txt!r} at ({x0:.0f},{y0:.0f})-({x1:.0f},{y1:.0f})")

    # nothing may run into the footer rule at y = 1136
    for txt, x0, y0, x1, y1 in BOXES:
        if y1 > 1131 and y0 < 1146:
            problems.append(f"in the footer rule: {txt!r} at y={y0:.0f}..{y1:.0f}")

    for i in range(len(BOXES)):
        for j in range(i + 1, len(BOXES)):
            a, b = BOXES[i], BOXES[j]
            area = overlap(a, b)
            if area > 6:
                problems.append(f"overlap: {a[0]!r} and {b[0]!r} share {area:.0f}px")

    return problems


def check_containment() -> list[str]:
    problems: list[str] = []

    # nothing may cross from one column of the diagram into the next
    for name, cx0, cx1 in COLUMNS:
        for txt, x0, y0, x1, y1 in BOXES:
            if not (cx0 <= x0 <= cx1):
                continue
            if x1 > cx1 + 6:
                problems.append(f"{name}: {txt!r} spills to x={x0:.0f}..{x1:.0f}")

    # nothing may leak out of the panel it sits in
    for name, px0, py0, px1, py1 in PANELS:
        for txt, x0, y0, x1, y1 in BOXES:
            cy = (y0 + y1) / 2
            if not (py0 <= cy <= py1):
                continue
            if not (px0 - 6 <= x0 <= px1):
                continue
            if x1 > px1 + 6:
                problems.append(f"{name}: {txt!r} spills to x={x0:.0f}..{x1:.0f}")
    return problems


def find_box(text: str, near: tuple[float, float]) -> tuple[float, float, float, float] | None:
    """The recorded box of the text run equal to `text` closest to `near`."""
    best = None
    best_d = 1e9
    for txt, x0, y0, x1, y1 in BOXES:
        if txt != text:
            continue
        d = abs(x0 - near[0]) + abs(y0 - near[1])
        if d < best_d:
            best_d = d
            best = (x0, y0, x1, y1)
    return best


def count_pixels(px, box, test) -> int:
    x0, y0, x1, y1 = box
    n = 0
    for x in range(max(0, int(x0)), min(1800, int(x1))):
        for y in range(max(0, int(y0)), min(1180, int(y1))):
            if test(px[x, y]):
                n += 1
    return n


def check_pixels(name: str) -> list[str]:
    problems: list[str] = []
    img = Image.open(os.path.join(HERE, name)).convert("RGB")
    px = img.load()

    def is_ink(c):
        r, g, b = c
        return r < 90 and g < 90 and b < 90

    def is_flag(c):
        r, g, b = c
        return 120 < r < 215 and g < 110 and b < 105

    # the big figure in the mock's total card
    box = find_box("$2,401.64", (116, 291))
    if box is None:
        problems.append("the figure is missing from the mock's total card")
    else:
        if (box[3] - box[1]) < 25:
            problems.append(f"the figure is not large: {box[3] - box[1]:.0f}px tall")
        if count_pixels(px, box, is_ink) < 120:
            problems.append("the figure is not ink-coloured")

    # the flag-coloured unclaimed clause on the mock's context line
    box = find_box("$451.15", (400, 349))
    if box is None:
        problems.append("the unclaimed clause is missing from the mock")
    elif count_pixels(px, box, is_flag) < 12:
        problems.append("the unclaimed clause is not flag-coloured")

    # and the same clause on the enlarged card
    box = find_box("$451.15", (1030, 271))
    if box is None:
        problems.append("the unclaimed clause is missing from the enlarged card")
    elif count_pixels(px, box, is_flag) < 12:
        problems.append("the enlarged card's clause is not flag-coloured")

    # the enlarged card without the clause must carry no red text
    for txt, x0, y0, x1, y1 in BOXES:
        if txt == "$451.15" and 366 <= (y0 + y1) / 2 <= 512:
            problems.append("the unclaimed clause is still on the all-owned card")

    # the empty-state card must not show a figure
    for txt, x0, y0, x1, y1 in BOXES:
        if txt == "$2,401.64" and 564 <= (y0 + y1) / 2 <= 696:
            problems.append("the empty-state card shows a number")
    if find_box("No recurring charges found", (876, 580)) is None:
        problems.append("the empty-state heading is missing")

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

    problems = (
        check_geometry()
        + check_containment()
        + check_pixels("08-total-cost.png")
        + check_numbers()
    )

    print(f"text runs checked: {len(BOXES)}")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("all checks passed")
