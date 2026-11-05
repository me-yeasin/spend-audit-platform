"""Verify the rendered monthly re-run diagram without looking at it.

The diagram is checked five ways:
  1. geometry -- every piece of text is recorded as it is drawn and checked
     for canvas overflow and for overlapping another piece of text;
  2. containment -- every piece of text must stay inside the panel it belongs
     to, and nothing may cross a gutter between the columns;
  3. colour -- every colour drawn must be one of the app's tokens, money out
     is never green, and red only ever appears on an owner-flag element;
  4. pixels -- the rendered PNG is probed at the exact places the recorded
     text says the figures landed, so the picture cannot quietly lose its
     number, its size, or its colour;
  5. the numbers -- the totals in the diagram are recomputed from the fixture
     so the picture cannot drift from the truth, and the consistency rule
     (+$2.70 + $2.50 = +$5.20 = $2,406.84 - $2,401.64) is checked.

Run: python design/check-monthly.py
"""
from __future__ import annotations

import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

import render  # noqa: E402
from render import font, s  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

BOXES: list[tuple[str, float, float, float, float]] = []
MARKS: list[tuple[str, float, float, float, float, str]] = []  # boxes + colour
SIZES: list[tuple[str, float, float, float, float, float]] = []  # boxes + size

# the app's tokens. Nothing outside this list may be drawn.
PALETTE = {
    "#fbfbf8",  # page
    "#ffffff",  # surface
    "#12120f",  # ink
    "#3a3a34",  # ink soft
    "#6e6e66",  # muted
    "#73736a",  # subtle
    "#e4e2da",  # hairline
    "#0e7c5a",  # accent
    "#e9f4ee",  # accent soft
    "#b4392b",  # flag
    "#fbedee",  # flag soft
    "#f1f0e9",  # chip
    "#fafaf6",  # card alt
    "#d8d5cb",  # dash
    "#e0b6b0",  # dash flag
    "#efeee7",  # rule
    "#f3f2ec",  # the file icon tile
    "#e9e7e0",  # the canvas
    "#2a2a26",  # the annotation badge
}

T_FLAG = "#b4392b"
T_ACCENT = "#0e7c5a"
T_INK = "#12120f"


class RecordingCanvas(render.Canvas):
    """A Canvas that remembers where every piece of text landed, and in what."""

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
            box = (x, y + ink[1] / s(1), x + width, y + ink[3] / s(1))
        else:
            x0, y0, x1, y1 = self.d.textbbox(
                (x * s(1), y * s(1)), txt, font=f, anchor=anchor
            )
            box = (x0 / s(1), y0 / s(1), x1 / s(1), y1 / s(1))
        BOXES.append((txt, *box))
        MARKS.append((txt, *box, fill))
        SIZES.append((txt, *box, size))
        return super().text(xy, txt, size, weight, fill, anchor, tracking)

    def rect(self, box, fill=None, outline=None, width=1.0, radius=0.0):
        if fill:
            MARKS.append(("rect", box[0], box[1], box[2], box[3], fill))
        if outline:
            MARKS.append(("rect", box[0], box[1], box[2], box[3], outline))
        return super().rect(box, fill=fill, outline=outline, width=width, radius=radius)

    def line(self, pts, fill=render.INK, width=1.0):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        MARKS.append(("line", min(xs), min(ys), max(xs), max(ys), fill))
        return super().line(pts, fill=fill, width=width)


def overlap(a, b) -> float:
    """The area of the intersection of two boxes."""
    x0 = max(a[1], b[1])
    y0 = max(a[2], b[2])
    x1 = min(a[3], b[3])
    y1 = min(a[4], b[4])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return (x1 - x0) * (y1 - y0)


def inside(box, zone, slack: float = 2.0) -> bool:
    """Is `box` (x0, y0, x1, y1) inside `zone` (x0, y0, x1, y1)?"""
    return (
        box[0] >= zone[0] - slack
        and box[1] >= zone[1] - slack
        and box[2] <= zone[2] + slack
        and box[3] <= zone[3] + slack
    )


# The panels of the diagram. Text that starts inside a panel's x range and
# whose middle falls inside its y range must stay inside its x range.
PANELS = [
    ("stage 1", 60, 134, 400, 286),
    ("stage 2", 440, 134, 780, 286),
    ("stage 3", 820, 134, 1160, 286),
    ("decisions", 1200, 116, 1740, 310),
    ("mock file chip", 92, 364, 776, 416),
    ("mock headline card", 92, 428, 776, 572),
    ("mock comparison panel", 92, 584, 776, 902),
    ("mock owner panel", 92, 914, 776, 994),
    ("mock recurring panel", 92, 1006, 776, 1112),
    ("state 1", 840, 364, 1320, 452),
    ("state 2", 840, 480, 1320, 568),
    ("state 3", 840, 596, 1320, 684),
    ("mobile phone", 852, 722, 1172, 1120),
    ("mobile notes", 1196, 730, 1320, 1120),
    ("options", 1360, 340, 1740, 690),
    ("legend", 1360, 704, 1740, 1110),
]

# Red is the owner flag. It may only appear on these.
FLAG_ZONES = [
    ("mock headline card", 92, 428, 776, 572),
    ("mock owner panel", 92, 914, 776, 994),
    ("the legend's colour key", 1360, 1096, 1740, 1120),
]

ROW_A = 348          # the second row of the diagram
GUTTERS = [(800, 840), (1320, 1360)]

# The regions of the diagram that must carry content.
REGIONS = [
    ("the flow row", 60, 116, 1740, 310),
    ("the workspace mock", 60, 348, 800, 1120),
    ("the three states", 840, 332, 1320, 690),
    ("the mobile mock", 852, 700, 1320, 1120),
    ("the options", 1360, 332, 1740, 690),
    ("the legend", 1360, 704, 1740, 1115),
]

MIN_SIZE = 8.0       # nothing may be set smaller than this

# The copy and the figures the diagram and the spec must agree on.
REQUIRED = [
    "$2,406.84",
    "$2,401.64",
    "$2,398.94",
    "+$5.20",
    "+$2.70",
    "+$2.50",
    "$453.85",
    "12 charges unchanged.",
    "Compared with December 2026",
    "the same 14 charges in both months",
    "MONTHS ON FILE",
    "No recurring charges yet",
    "Forget saved history",
]


def check_copy() -> list[str]:
    """The diagram and the spec must carry the same words and the same figures."""
    problems: list[str] = []
    runs = [txt for txt, *_ in BOXES]

    for want in REQUIRED:
        if not any(want in txt for txt in runs):
            problems.append(f"the diagram is missing {want!r}")

    spec_path = os.path.join(HERE, "MONTHLY.md")
    if not os.path.exists(spec_path):
        problems.append("design/MONTHLY.md is missing")
        return problems

    with open(spec_path, encoding="utf-8") as fh:
        spec = fh.read()
    for want in REQUIRED:
        if want not in spec:
            problems.append(f"the spec is missing {want!r}")

    return problems


def check_legibility() -> list[str]:
    problems: list[str] = []
    for txt, x0, y0, x1, y1, size in SIZES:
        if size < MIN_SIZE:
            problems.append(f"too small ({size}px): {txt!r}")
    return problems


def check_density(name: str) -> list[str]:
    """No region may be blank, and none may be a solid block.

    Only type and solid marks count as ink: the white panels, the page and the
    hairlines are surfaces, not content.
    """
    problems: list[str] = []
    img = Image.open(os.path.join(HERE, name)).convert("RGB")
    px = img.load()

    def is_ink(c):
        return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 210

    for label, x0, y0, x1, y1 in REGIONS:
        ink = 0
        total = 0
        for x in range(max(0, int(x0)), min(1800, int(x1))):
            for y in range(max(0, int(y0)), min(1180, int(y1))):
                total += 1
                if is_ink(px[x, y]):
                    ink += 1
        share = ink / max(1, total)
        if share < 0.002:
            problems.append(f"{label} is nearly blank ({share * 100:.2f}% ink)")
        if share > 0.30:
            problems.append(f"{label} is a solid block ({share * 100:.1f}% ink)")
    return problems


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

    # below the flow row, nothing may cross a gutter between the columns
    for txt, x0, y0, x1, y1 in BOXES:
        cy = (y0 + y1) / 2
        if cy < ROW_A:
            continue
        for gx0, gx1 in GUTTERS:
            if x0 < gx1 and x1 > gx0:
                problems.append(f"crosses the gutter {gx0}-{gx1}: {txt!r}")

    return problems


def check_colour() -> list[str]:
    problems: list[str] = []

    for name, x0, y0, x1, y1, colour in MARKS:
        if colour.lower() not in PALETTE:
            problems.append(f"off-palette colour {colour!r} on {name!r}")

    # money out is never green
    for txt, x0, y0, x1, y1, colour in MARKS:
        if "$" in txt and colour.lower() == T_ACCENT:
            problems.append(f"money in green: {txt!r}")

    # red only on an owner-flag element
    for name, x0, y0, x1, y1, colour in MARKS:
        if colour.lower() != T_FLAG:
            continue
        if not any(inside((x0, y0, x1, y1), zone[1:]) for zone in FLAG_ZONES):
            problems.append(f"red outside an owner-flag element: {name!r}")

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

    # the headline figure in the mock: big, and ink
    box = find_box("$2,406.84", (114, 460))
    if box is None:
        problems.append("the headline figure is missing from the mock")
    else:
        if (box[3] - box[1]) < 25:
            problems.append(f"the headline figure is not large: {box[3] - box[1]:.0f}px tall")
        if count_pixels(px, box, is_ink) < 120:
            problems.append("the headline figure is not ink-coloured")

    # the comparison figure: the same number, smaller
    cbox = find_box("$2,406.84", (114, 630))
    if cbox is None:
        problems.append("the comparison figure is missing from the mock")
    else:
        hbox = find_box("$2,406.84", (114, 460))
        if hbox and (cbox[3] - cbox[1]) >= (hbox[3] - hbox[1]):
            problems.append("the comparison figure is not smaller than the headline")
        if count_pixels(px, cbox, is_ink) < 40:
            problems.append("the comparison figure is not ink-coloured")

    # the delta line is ink, never green and never red
    dbox = find_box("+$5.20", (114, 660))
    if dbox is None:
        problems.append("the delta line is missing from the comparison")
    else:
        if count_pixels(px, dbox, is_ink) < 20:
            problems.append("the delta line is not ink-coloured")

    # the flag-coloured unclaimed clause on the mock's context line
    clause = "$453.85 per month has no owner"
    fbox = find_box(clause, (260, 525))
    if fbox is None:
        problems.append("the unclaimed clause is missing from the mock")
    elif count_pixels(px, fbox, is_flag) < 12:
        problems.append("the unclaimed clause is not flag-coloured")

    # the empty states must not show a figure
    for txt, x0, y0, x1, y1 in BOXES:
        if txt.strip() == "$0.00":
            problems.append(f"a $0.00 is on the page: {txt!r}")
    for near in ((860, 390), (860, 506)):
        if find_box("No recurring charges yet", near) is None:
            problems.append(f"the empty-state heading is missing near {near}")

    # the third state does show a figure
    if find_box("$2,406.84", (860, 620)) is None:
        problems.append("the third state is missing its figure")

    return problems


def check_numbers() -> list[str]:
    """The totals in the diagram must equal the sum of the fixture."""
    problems: list[str] = []

    spec = importlib.util.spec_from_file_location(
        "monthly_rerun", os.path.join(HERE, "monthly-rerun.py")
    )
    monthly = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(monthly)

    nov = round(sum(c[1] for c in monthly.CHARGES), 2)
    dec = round(sum(c[2] for c in monthly.CHARGES), 2)
    jan = round(sum(c[3] for c in monthly.CHARGES), 2)
    if (nov, dec, jan) != (2398.94, 2401.64, 2406.84):
        problems.append(f"the months sum to {nov}, {dec}, {jan} -- not 2398.94, 2401.64, 2406.84")
    if len(monthly.CHARGES) != 14:
        problems.append(f"{len(monthly.CHARGES)} charges, not 14")

    # the consistency rule: the rows add up to the difference between the months
    rows = round(sum(after - before for _, before, after in monthly.MOVED), 2)
    if rows != round(jan - dec, 2):
        problems.append(f"the change rows sum to {rows}, not {round(jan - dec, 2)}")
    if rows != monthly.DELTA:
        problems.append(f"the change rows sum to {rows}, not the delta {monthly.DELTA}")
    if len(monthly.MOVED) + monthly.UNCHANGED != 14:
        problems.append("the moved and unchanged charges do not add up to 14")

    # the unowned figure
    unowned = round(sum(c[3] for c in monthly.CHARGES if c[0] not in monthly.OWNED), 2)
    if unowned != 453.85:
        problems.append(f"the unowned charges sum to {unowned}, not 453.85")
    if monthly.N_UNOWNED != 11:
        problems.append(f"{monthly.N_UNOWNED} unowned charges, not 11")

    # the median basis the decision replaces
    if monthly.MEDIAN_BASIS != 2401.64 or monthly.NEWEST_BASIS != 2404.34:
        problems.append("the median / newest-payment figures do not match the fixture")
    if round(monthly.NEWEST_BASIS - monthly.MEDIAN_BASIS, 2) != 2.70:
        problems.append("the $2.70 gap between the two bases is wrong")

    # what today's rule would do to the price rise
    if monthly.TODAY_CHARGES != 13 or monthly.TODAY_JAN != 2388.85:
        problems.append("the rejected-rule figures do not match the detector")
    if round(monthly.TOTAL_JAN - 17.99, 2) != monthly.TODAY_JAN:
        problems.append("the rejected-rule figure is not the January total without Netflix")

    return problems


if __name__ == "__main__":
    render.Canvas = RecordingCanvas

    spec = importlib.util.spec_from_file_location(
        "monthly_rerun", os.path.join(HERE, "monthly-rerun.py")
    )
    monthly = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(monthly)
    monthly.image_monthly()

    problems: list[str] = []
    problems += check_geometry()
    problems += check_containment()
    problems += check_colour()
    problems += check_legibility()
    problems += check_copy()
    problems += check_pixels("09-monthly-rerun.png")
    problems += check_density("09-monthly-rerun.png")
    problems += check_numbers()

    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    print(f"all checks passed: {len(BOXES)} text runs, {len(MARKS)} marks, 0 problems")
