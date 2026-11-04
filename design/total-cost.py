"""Render the total-monthly-recurring-cost design for approval.

Outputs:
  design/08-total-cost.png  - the workspace mock with the headline card at the
                              top, an enlarged study of the card, both variants,
                              the empty state, the 320 px mobile mock, and the
                              anatomy legend

Run: python design/total-cost.py

Reuses the drawing helpers in design/render.py (Canvas, badge, paragraph,
dash_round_rect, icon_check, icon_file, font) and the small component helpers
in design/recurring.py (chevron, money). Nothing here is a new drawing
library -- only the components this feature adds.

The numbers come from the real fixtures: test-data/statement-3-months.csv
holds 62 transactions and 14 recurring charges that come to $2,401.64 a
month. Every figure in this diagram is that one number.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from render import Canvas, font, s  # noqa: E402
from recurring import chevron, money  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# --- the app's tokens, written out so the diagram cannot drift from the app
T_PAGE = "#fbfbf8"
T_SURFACE = "#ffffff"
T_INK = "#12120f"
T_INK_SOFT = "#3a3a34"
T_MUTED = "#6e6e66"
T_SUBTLE = "#73736a"
T_HAIRLINE = "#e4e2da"
T_ACCENT = "#0e7c5a"
T_ACCENT_SOFT = "#e9f4ee"
T_FLAG = "#b4392b"
T_FLAG_SOFT = "#fbedee"

# neutrals that already exist in the app's surfaces
T_CHIP = "#f1f0e9"
T_CARD_ALT = "#fafaf6"
T_DASH = "#d8d5cb"
T_DASH_FLAG = "#e0b6b0"
T_RULE = "#efeee7"

# ------------------------------------------------------------------ geometry
W, H = 1800, 1180

# column 1 -- the workspace mock
PG_X, PG_Y, PG_R, PG_B = 60, 152, 800, 1120
CARD_L, CARD_R = 92, 776
PAD = 24

# column 2 -- the card study
C2_X, C2_R = 840, 1320
CD_X, CD_R = 852, 1320      # the enlarged card
CD_PAD = 24
CD_L = CD_X + CD_PAD        # 876 -- where the enlarged card's content starts

# column 3 -- the anatomy legend
C3_X, C3_W = 1360, 364

# recurring row internals (inside the recurring panel)
R_NAME = 116
R_CHIP = 316
R_AMOUNT = 540
R_CHEV = 618
R_OWNER = 644

# flagged row internals (inside the needs-owner panel)
F_DOT = 116
F_NAME = 132
F_AMOUNT = 580
F_OWNER = 596

# ------------------------------------------------------------------ the data
# test-data/statement-3-months.csv -- 62 transactions, 14 recurring charges.
CHARGES = [
    ("CITY APARTMENTS RENT", "3 payments · $5,550.00 total", 1850.00, "Sam", False),
    ("GEICO AUTO INSURANCE", "3 payments · $385.50 total", 128.50, None, False),
    ("CITY POWER & WATER", "3 payments · $370.20 total", 123.40, None, True),
    ("VERIZON WIRELESS", "3 payments · $255.00 total", 85.00, "Alex", False),
    ("ADOBE CREATIVE CLOUD", "3 payments · $179.97 total", 59.99, None, False),
]

# the charges nobody has claimed, largest first. The three claimed charges are
# the rent (Sam), the phone (Alex) and Netflix (Me) -- the same owners the
# owner-flagging diagram uses.
UNOWNED = [
    ("GEICO AUTO INSURANCE", "3 payments · $385.50 total", 128.50),
    ("CITY POWER & WATER", "3 payments · $370.20 total", 123.40),
    ("ADOBE CREATIVE CLOUD", "3 payments · $179.97 total", 59.99),
]

TOTAL = 2401.64          # the sum of all 14 monthly amounts
UNOWNED_TOTAL = 451.15   # the 11 charges nobody has claimed
N_CHARGES = 14
N_UNOWNED = 11
N_TRANSACTIONS = 62


# ------------------------------------------------------------------ baseline
def baseline_at(cap_top: float, size: float, weight: str = "regular") -> float:
    """The baseline y for a line whose capital top should sit at cap_top.

    PIL anchors on the ascender, which for Segoe UI is taller than the caps,
    so "draw at y" is not the same as "the letters start at y". Everything
    here is placed by its cap line instead, so blocks of type line up.
    """
    f = font(weight, size)
    bb = f.getbbox("0")
    return cap_top + (bb[3] - bb[1]) / s(1)


def figure(
    cv: Canvas,
    x: float,
    cap_top: float,
    amount: float,
    size: float = 44,
    weight: str = "semibold",
    tracking: float = -0.88,
    fill: str = T_INK,
) -> tuple[float, float]:
    """The big number. Returns (right edge, baseline).

    The app sets tracking-[-0.02em], which is -0.88 px at 44 px.
    """
    text = money(amount)
    f = font(weight, size)
    bb = f.getbbox("0")
    # The Canvas draws tracked text letter by letter from the ascender
    # origin, so shift up to land the cap line where it belongs.
    la_y = cap_top - bb[1] / s(1)
    base = cap_top + (bb[3] - bb[1]) / s(1)
    cv.text((x, la_y), text, size, weight, fill, tracking=tracking)
    return x + cv.tw(text, size, weight, tracking), base


def context_lines(
    cv: Canvas,
    charges: int,
    unowned: float | None,
    size: float = 12,
    max_w: float | None = None,
) -> list[list[tuple[str, str]]]:
    """The context line, broken the way the browser would break it.

    "across 14 recurring charges", and -- only when something is unclaimed --
    the flag-coloured clause on the same line.
    """
    word = "charge" if charges == 1 else "charges"
    head = f"across {charges} recurring {word}"

    tokens: list[tuple[str, str]] = [(t, T_SUBTLE) for t in head.split()]
    if unowned is not None:
        tokens.append(("·", T_SUBTLE))
        clause = f"{money(unowned)} per month has no owner"
        tokens += [(t, T_FLAG) for t in clause.split()]

    lines: list[list[tuple[str, str]]] = [[]]
    line_w = 0.0
    space = cv.tw(" ", size, "regular")
    for tok, col in tokens:
        w = cv.tw(tok, size, "regular")
        add = w if not lines[-1] else space + w
        if max_w is not None and lines[-1] and line_w + add > max_w:
            lines.append([(tok, col)])
            line_w = w
            continue
        lines[-1].append((tok, col))
        line_w += add
    return lines


def draw_context(
    cv: Canvas,
    x: float,
    cap_top: float,
    lines: list[list[tuple[str, str]]],
    size: float = 12,
) -> float:
    """Draw the context line and return the bottom of the last line."""
    base = baseline_at(cap_top, size, "regular")
    space = cv.tw(" ", size, "regular")
    y = base
    for line in lines:
        cx = x
        for i, (tok, col) in enumerate(line):
            if i:
                cx += space
            cv.text((cx, y), tok, size, "regular", col, anchor="ls")
            cx += cv.tw(tok, size, "regular")
        y += size * 1.45
    return y


def count_badge(cv: Canvas, x: float, y: float, n: int, h: float = 17) -> float:
    """The count badge beside a heading. Flag-soft fill, flag-red text."""
    w = 12 + cv.tw(str(n), 10, "semibold")
    cv.rect((x, y, x + w, y + h), fill=T_FLAG_SOFT, radius=h / 2)
    cv.text((x + w / 2, y + 3.5), str(n), 10, "semibold", T_FLAG, anchor="mt")
    return w


def cross(cv: Canvas, cx: float, cy: float, size: float = 3.0, color: str = T_SUBTLE) -> None:
    """A tiny multiplication sign, drawn rather than typed."""
    cv.line([(cx - size, cy - size), (cx + size, cy + size)], color, 1.2)
    cv.line([(cx - size, cy + size), (cx + size, cy - size)], color, 1.2)


def dashed_pill(
    cv: Canvas,
    x: float,
    y: float,
    text: str,
    size: float = 11,
    height: float = 26,
    pad: float = 11,
    flagged: bool = False,
) -> float:
    """The '+ Add owner' affordance. Neutral in the main list, tinted in the
    flagged list, because that list is already the warning."""
    w = cv.tw(text, size, "semibold") + pad * 2
    border = T_DASH_FLAG if flagged else T_DASH
    label = T_FLAG if flagged else T_MUTED
    cv.rect((x, y, x + w, y + height), fill=None, radius=height / 2)
    cv.dash_round_rect((x, y, x + w, y + height), height / 2, border, 1.4, 6, 4)
    cv.text((x + w / 2, y + (height - size) / 2 + 0.5), "+ " + text, size, "semibold", label, anchor="mt")
    return w


def owner_pill(cv: Canvas, x: float, y: float, name: str, height: float = 26, size: float = 11.5) -> float:
    """A filled soft pill carrying an owner's name."""
    w = 10 + cv.tw(name, size, "semibold") + 10
    cv.rect((x, y, x + w, y + height), fill=T_CHIP, radius=height / 2)
    cv.text((x + 10, y + (height - size) / 2 + 0.5), name, size, "semibold", T_INK_SOFT)
    return w


def cadence_chip(cv: Canvas, x: float, y: float) -> float:
    """The 'Monthly' chip. Returns the baseline of its label."""
    cv.rect((x, y, x + 56, y + 18), fill=T_CHIP, radius=9)
    base = baseline_at(y + 5.5, 10, "semibold")
    cv.text((x + 28, base), "Monthly", 10, "semibold", T_MUTED, anchor="ms")
    return base


def flag_dot(cv: Canvas, x: float, y: float) -> None:
    """The small marker on a flagged row: a red dot in a soft disc."""
    cv.d.ellipse([s(x - 3), s(y - 3), s(x + 9), s(y + 9)], fill=T_FLAG_SOFT)
    cv.d.ellipse([s(x), s(y), s(x + 6), s(y + 6)], fill=T_FLAG)


def file_chip(cv: Canvas, x: float, y: float, w: float) -> None:
    h = 52
    cv.rect((x, y, x + w, y + h), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=12)
    cv.rect((x + 10, y + 10, x + 38, y + 42), fill="#f3f2ec", radius=6)
    cv.icon_file(x + 18.5, y + 19, 11, T_MUTED)
    cv.text((x + 48, y + 13), "statement-3-months.csv", 11.5, "semibold", T_INK)
    cv.text((x + 48, y + 29), "2.3 KB · 62 rows", 10, "regular", T_MUTED)
    cv.d.ellipse([s(x + w - 40), s(y + 17), s(x + w - 24), s(y + 33)], fill=T_ACCENT)
    cv.icon_check(x + w - 32, y + 25, 4.6, T_SURFACE)


# ------------------------------------------------------------------ the card
def total_card(
    cv: Canvas,
    x: float,
    y: float,
    w: float,
    *,
    charges: int = N_CHARGES,
    unowned: float | None = UNOWNED_TOTAL,
    empty: bool = False,
    num_size: float = 44,
    label_size: float = 12,
    unit_size: float = 13,
    ctx_size: float = 12,
    pad: float = PAD,
    flat: bool = False,
) -> tuple[float, dict]:
    """The headline card.

    Mirrors app/_components/total-panel.tsx exactly: a small muted label, the
    figure with its unit on the same baseline, and one quiet context line
    under it. The unclaimed figure is an inline clause on that line -- never a
    second large number, and never inside the card as a list.

    Returns (height used, geometry) so the caller can put annotations on the
    parts.
    """
    label_h = label_size * 1.25
    num_h = num_size * 1.10
    lead = ctx_size * 1.45

    lines = context_lines(cv, charges, unowned, size=ctx_size, max_w=w - pad * 2)
    ctx_h = len(lines) * lead

    if empty:
        head_h = 28 * 1.25
        h = pad + label_h + 6 + head_h + 10 + ctx_h + pad
    else:
        h = pad + label_h + 6 + num_h + 10 + ctx_h + pad

    if not flat:
        cv.shadow((x, y, x + w, y + h), radius=18, spread=16, alpha=14, offset=5)
    cv.rect((x, y, x + w, y + h), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=18)

    cx = x + pad
    geo: dict = {"x": cx, "y": y, "w": w, "h": h, "pad": pad, "bottom": y + h}

    # -- the label
    label_cap = y + pad
    cv.text((cx, baseline_at(label_cap, label_size, "semibold")),
            "Total monthly recurring cost", label_size, "semibold", T_MUTED, anchor="ls")
    geo["label_cap"] = label_cap

    if empty:
        head_cap = label_cap + label_h + 6
        cv.text((cx, baseline_at(head_cap, 28, "semibold")),
                "No recurring charges found", 28, "semibold", T_INK_SOFT, anchor="ls")
        body_cap = head_cap + 28 * 1.25 + 10
        cv.text((cx, baseline_at(body_cap, ctx_size, "regular")),
                "Nothing repeats in this statement yet, so there is nothing to total.",
                ctx_size, "regular", T_SUBTLE, anchor="ls")
        geo["head_cap"] = head_cap
        geo["body_cap"] = body_cap
        return h, geo

    # -- the figure and its unit, on one baseline
    num_cap = label_cap + label_h + 6
    right, base = figure(cv, cx, num_cap, TOTAL, size=num_size)
    cv.text((right + 8, base), "per month", unit_size, "regular", T_SUBTLE, anchor="ls")
    geo["num_cap"] = num_cap
    geo["num_right"] = right
    geo["num_base"] = base
    geo["unit_right"] = right + 8 + cv.tw("per month", unit_size, "regular")

    # -- the context line
    ctx_cap = num_cap + num_h + 10
    draw_context(cv, cx, ctx_cap, lines, size=ctx_size)
    geo["ctx_cap"] = ctx_cap
    geo["ctx_right"] = cx + max(
        sum(cv.tw(t, ctx_size, "regular") for t, _ in line)
        + cv.tw(" ", ctx_size, "regular") * (len(line) - 1)
        for line in lines
    )
    return h, geo


# ------------------------------------------------------------------ the mock
def workspace(cv: Canvas) -> None:
    cv.rect((PG_X, PG_Y, PG_R, PG_B), fill=T_PAGE, outline=T_HAIRLINE, width=1, radius=18)

    file_chip(cv, CARD_L, 176, CARD_R - CARD_L)

    # --- the headline card, at the very top of the workspace --------------
    ty = 246
    _, geo = total_card(cv, CARD_L, ty, CARD_R - CARD_L)
    cv.badge(76, ty + 16, 1, r=10)

    # --- needs an owner ----------------------------------------------------
    fy0, fy1 = 408, 630
    cv.shadow((CARD_L, fy0, CARD_R, fy1), radius=18, spread=16, alpha=14, offset=5)
    cv.rect((CARD_L, fy0, CARD_R, fy1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=18)

    cv.text((CARD_L + PAD, 422), "Needs an owner", 13.5, "semibold", T_INK)
    head_w = cv.tw("Needs an owner", 13.5, "semibold")
    count_badge(cv, CARD_L + PAD + head_w + 10, 418, N_UNOWNED)
    cv.d.ellipse([s(CARD_R - PAD - 168), s(424), s(CARD_R - PAD - 162), s(430)], fill=T_FLAG)
    cv.text((CARD_R - PAD, 422), "Nobody has claimed these", 10.5, "regular", T_SUBTLE, anchor="rt")

    for i, (name, evidence, amount) in enumerate(UNOWNED):
        ry = 454 + i * 52
        flag_dot(cv, F_DOT, ry + 14)
        cv.text((F_NAME, ry + 11), name, 12.5, "semibold", T_INK)
        cv.text((F_NAME, ry + 29), evidence, 11, "regular", T_MUTED)
        cv.text((F_AMOUNT, ry + 11), money(amount), 12.5, "semibold", T_INK, anchor="rt")
        cv.text((F_AMOUNT, ry + 29), "per month", 10, "regular", T_SUBTLE, anchor="rt")
        dashed_pill(cv, F_OWNER, ry + 13, "Add owner", flagged=True)

    cv.line([(CARD_L + PAD, 598), (CARD_R - PAD, 598)], T_HAIRLINE, 1)
    cv.text(
        (CARD_L + PAD, 606),
        "Name an owner to clear a charge. It leaves this list and appears in the "
        "recurring charges below with their name on it.",
        10.5,
        "regular",
        T_SUBTLE,
    )

    # --- recurring charges -------------------------------------------------
    py0, py1 = 648, 1082
    cv.shadow((CARD_L, py0, CARD_R, py1), radius=18, spread=18, alpha=16, offset=6)
    cv.rect((CARD_L, py0, CARD_R, py1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=16)

    cv.text((CARD_L + PAD, 664), "Recurring charges", 15, "semibold", T_INK)
    cv.rect((CARD_L + PAD + 148, 665, CARD_L + PAD + 176, 684), fill=T_CHIP, radius=9)
    cv.text((CARD_L + PAD + 162, 669), "14", 8.6, "semibold", T_MUTED, anchor="mt")
    cv.text((CARD_R - PAD, 669), "Largest first", 9.5, "regular", T_SUBTLE, anchor="rt")

    ry = 700
    for i, (name, evidence, amount, owner, varies) in enumerate(CHARGES):
        if i:
            cv.line([(CARD_L + PAD, ry - 2), (CARD_R - PAD, ry - 2)], T_RULE, 1)
        cv.text((R_NAME, ry + 13), name, 13.5, "semibold", T_INK)
        cv.text((R_NAME, ry + 34), evidence, 11.5, "regular", T_MUTED)

        base = cadence_chip(cv, R_CHIP, ry + 14)
        if varies:
            cv.text((R_CHIP + 64, base), "amount varies", 10.5, "regular", T_SUBTLE, anchor="ls")

        cv.text((R_AMOUNT, ry + 13), money(amount), 13.5, "semibold", T_INK, anchor="rt")
        cv.text((R_AMOUNT, ry + 34), "per month", 10.5, "regular", T_SUBTLE, anchor="rt")
        chevron(cv, R_CHEV, ry + 32, 4.5, T_SUBTLE)

        if owner is None:
            dashed_pill(cv, R_OWNER, ry + 19, "Add owner")
        else:
            owner_pill(cv, R_OWNER, ry + 19, owner)
        ry += 66

    # --- the footer repeats the sum ---------------------------------------
    cv.line([(CARD_L + PAD, 1030), (CARD_R - PAD, 1030)], T_HAIRLINE, 1)
    cv.text((CARD_L + PAD, 1040), f"{N_CHARGES} recurring charges grouped from {N_TRANSACTIONS} transactions",
            10.5, "regular", T_SUBTLE)
    cv.text((CARD_R - PAD, 1040), money(TOTAL), 10.5, "semibold", T_INK_SOFT, anchor="rt")
    cv.text((CARD_R - PAD - cv.tw(money(TOTAL), 10.5, "semibold"), 1040), " per month in total",
            10.5, "regular", T_INK_SOFT, anchor="rt")
    cv.badge(738, 1018, 9, r=10)


# ------------------------------------------------------------------ variants
def variant_with(cv: Canvas) -> None:
    """The card as built, with the unclaimed figure on the context line."""
    y = 168
    _, geo = total_card(cv, CD_X, y, CD_R - CD_X)
    cv.badge(864, geo["num_cap"] + 18, 2, r=10)
    cv.badge(geo["unit_right"] + 27, geo["num_base"] - 8, 3, r=10)
    cv.badge(864, geo["ctx_cap"] + 6, 4, r=10)
    cv.badge(geo["ctx_right"] + 24, geo["ctx_cap"] + 6, 5, r=10)

    cv.paragraph(
        (CD_X, geo["bottom"] + 10),
        "Some charges have no owner. The unclaimed figure sits on the same line, "
        "in the flag colour, and is always a subset of the figure above it.",
        CD_R - CD_X,
        10.5,
        "regular",
        T_MUTED,
        1.45,
    )


def variant_without(cv: Canvas) -> None:
    """The card once every charge has an owner: the clause is gone."""
    y = 366
    _, geo = total_card(cv, CD_X, y, CD_R - CD_X, unowned=None)
    cv.badge(geo["ctx_right"] + 25, geo["ctx_cap"] + 6, 6, r=10)

    cv.paragraph(
        (CD_X, geo["bottom"] + 10),
        "Every charge has an owner. The clause disappears rather than showing "
        "$0.00 — and there is no green tick. Green is for income.",
        CD_R - CD_X,
        10.5,
        "regular",
        T_MUTED,
        1.45,
    )


def empty(cv: Canvas) -> None:
    """The card when the statement holds no recurring charges."""
    y = 564
    _, geo = total_card(cv, CD_X, y, CD_R - CD_X, empty=True)
    cv.badge(864, geo["head_cap"] + 12, 7, r=10)

    cv.paragraph(
        (CD_X, geo["bottom"] + 10),
        "No $0.00. A zero would claim you pay nothing; the truth is that "
        "nothing repeated often enough to count. Same card, same padding.",
        CD_R - CD_X,
        10.5,
        "regular",
        T_MUTED,
        1.45,
    )


# ------------------------------------------------------------------ mobile
def mobile(cv: Canvas) -> None:
    cv.badge(858, 752, 8, r=10)
    cv.text((880, 746), "MOBILE — 320 PX", 9.5, "semibold", T_MUTED, tracking=1.8)

    px0, py0, px1, py1 = 852, 768, 1172, 1120
    cv.shadow((px0, py0, px1, py1), radius=16, spread=14, alpha=14, offset=5)
    cv.rect((px0, py0, px1, py1), fill=T_PAGE, outline=T_HAIRLINE, width=1, radius=16)

    # the card at 320 px: 20 px padding, a 32 px figure, a wrapped context line
    cx0, cx1 = 872, 1152
    cy = 784
    h, geo = total_card(
        cv, cx0, cy, cx1 - cx0,
        num_size=32, unit_size=12.5, ctx_size=12, pad=20, flat=True,
    )

    # what comes next, so the order is still legible at 320 px
    ny = cy + h + 14
    cv.rect((cx0, ny, cx1, ny + 118), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=12)
    cv.text((cx0 + 14, ny + 14), "NEEDS AN OWNER", 9, "semibold", T_INK, tracking=1.3)
    hw = cv.tw("NEEDS AN OWNER", 9, "semibold", 1.3)
    count_badge(cv, cx0 + 14 + hw + 7, ny + 10, N_UNOWNED, h=15)
    for i, (name, amount, evidence) in enumerate(
        [
            ("GEICO AUTO INSURANCE", 128.50, "3 payments · $385.50 total"),
            ("CITY POWER & WATER", 123.40, "3 payments · $370.20 total"),
        ]
    ):
        ry = ny + 44 + i * 38
        flag_dot(cv, cx0 + 18, ry + 5)
        cv.text((cx0 + 30, ry + 1), name, 10.5, "semibold", T_INK)
        cv.text((cx1 - 14, ry + 1), money(amount), 10.5, "semibold", T_INK, anchor="rt")
        cv.text((cx0 + 30, ry + 17), evidence, 9, "regular", T_MUTED)

    # the notes beside the phone
    nx = 1196
    ny2 = 784
    for title, body in (
        ("32 px", "The figure drops a step and is still the largest type on the screen."),
        ("20 px", "The padding is unchanged. Nothing is cropped."),
        ("WRAPS", "The context line breaks mid-phrase, because it is one paragraph "
                  "with the flag clause inline."),
        ("FIX", "Give the flag clause its own line below 380 px. One rule, one "
                "break, no orphaned words."),
    ):
        cv.text((nx, ny2), title, 9, "semibold", T_MUTED, tracking=1.3)
        ny2 = cv.paragraph((nx, ny2 + 14), body, CD_R - nx, 9.2, "regular", T_MUTED, 1.45) + 12


# ------------------------------------------------------------------ legend
LEGEND = [
    (
        1,
        "Top of the workspace",
        "The card sits above 'Needs an owner' and above the list it summarises. "
        "It is the only thing on the page that is not a list.",
    ),
    (
        2,
        "The figure",
        "44 px semibold, ink, tabular-nums, tight tracking. The largest type on "
        "the page — the next largest is a 15 px panel heading.",
    ),
    (
        3,
        "The unit",
        "'per month' at 13 px subtle, on the figure's baseline. A number with no "
        "unit is a number you cannot act on.",
    ),
    (
        4,
        "The context line",
        "'across 14 recurring charges' at 12 px subtle, one line under the figure. "
        "It says what the number covers.",
    ),
    (
        5,
        "The unclaimed figure",
        "The same line, in flag red. Always a subset of the figure above it, and "
        "never a second large number.",
    ),
    (
        6,
        "No flag clause",
        "When every charge has an owner the clause disappears. The line stops "
        "after the count — no green tick, no badge.",
    ),
    (
        7,
        "The empty state",
        "'No recurring charges found', and why. Never '$0.00', which would claim "
        "you pay nothing.",
    ),
    (
        8,
        "Mobile, 320 px",
        "The figure drops to 32 px, the context line wraps, and the card keeps its "
        "padding. Nothing overflows.",
    ),
    (
        9,
        "The footer confirms it",
        "The recurring panel repeats the same sum on the right, so the headline "
        "can be checked against the list.",
    ),
]


def legend(cv: Canvas) -> float:
    cv.text((C3_X, 130), "ANATOMY", 9.5, "semibold", T_MUTED, tracking=1.8)

    ly = 152
    for n, title, body in LEGEND:
        cv.badge(C3_X + 10, ly + 4, n, r=10)
        cv.text((C3_X + 28, ly - 2), title, 11.5, "semibold", T_INK)
        ly += 15
        ly = cv.paragraph((C3_X + 28, ly), body, C3_W - 28, 9.8, "regular", T_MUTED, 1.45) + 12

    ly += 4
    cv.line([(C3_X, ly), (C3_X + C3_W, ly)], T_HAIRLINE, 1)
    ly += 20

    cv.text((C3_X, ly), "COLOUR RULE", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    for swatch, label in (
        (T_INK, "the figure — money out is never green"),
        (T_MUTED, "the label"),
        (T_SUBTLE, "'per month', the context line, the footer"),
        (T_FLAG, "the unclaimed figure — red means one thing only"),
    ):
        cv.rect((C3_X, ly - 2, C3_X + 16, ly + 14), fill=swatch, outline=T_HAIRLINE, width=1, radius=4)
        cv.text((C3_X + 24, ly), label, 9.8, "regular", T_MUTED)
        ly += 22

    ly += 10
    cv.text((C3_X, ly), "TRUST", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    ly = cv.paragraph(
        (C3_X, ly),
        "One function, sumMonthly, builds the headline and the list footer. The "
        "figure above is the addition of the amounts already on screen in the "
        "list below, so the two cannot disagree.",
        C3_W,
        9.8,
        "regular",
        T_MUTED,
        1.45,
    )

    ly += 10
    cv.text((C3_X, ly), "WHAT IS NOT HERE", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    ly = cv.paragraph(
        (C3_X, ly),
        "No breakdown inside the card. Every app that shows a headline and its "
        "detail puts the detail on its own surface — Copilot's Cash Flow and "
        "Categories tabs, Monarch's Recurring page. Here the Recurring charges "
        "panel is that surface, and the footer carries the sum.",
        C3_W,
        9.8,
        "regular",
        T_MUTED,
        1.45,
    )

    ly += 10
    cv.text((C3_X, ly), "THE NUMBER", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    ly = cv.paragraph(
        (C3_X, ly),
        "$2,401.64 a month across 14 charges · $451.15 has no owner",
        C3_W,
        9.8,
        "regular",
        T_MUTED,
        1.45,
    )

    ly += 12
    cv.text((C3_X, ly), "THE THREE CARDS", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    for state, body in (
        ("Charges found", "$2,401.64 per month, across 14 charges"),
        ("Some unclaimed", "+ $451.15 per month has no owner"),
        ("None found", "No recurring charges found, and why"),
    ):
        cv.text((C3_X, ly), state, 9.8, "semibold", T_INK)
        cv.text((C3_X + 96, ly), body, 9.8, "regular", T_MUTED)
        ly += 16
    return ly


# ------------------------------------------------------------------ image
def image_total() -> None:
    cv = Canvas(W, H)

    cv.text((60, 50), "TOTAL MONTHLY RECURRING COST — ANATOMY", 10.5, "semibold", T_MUTED, tracking=2.2)
    cv.text((60, 72), "One number, at the top, that tells you what you quietly pay every month.",
            17, "semibold", T_INK)
    cv.text((1740, 74), "Step 5 · local only · no account", 10.5, "regular", T_SUBTLE, anchor="rt")

    workspace(cv)
    variant_with(cv)
    variant_without(cv)
    empty(cv)
    mobile(cv)
    legend(cv)

    cv.line([(60, 1136), (1740, 1136)], T_HAIRLINE, 1)
    cv.text((60, 1148), "Spend Audit · step 5 of the roadmap · the file never leaves the device",
            10, "regular", T_SUBTLE)
    cv.text((1740, 1148), "design/TOTAL.md holds the full spec", 10, "regular", T_SUBTLE, anchor="rt")

    cv.save("08-total-cost.png")
    check_edges("08-total-cost.png")


def check_edges(name: str, margin: int = 6) -> None:
    """Fail loudly if anything was drawn at the very edge of the canvas."""
    from PIL import Image

    path = os.path.join(HERE, name)
    img = Image.open(path).convert("RGB")
    px = img.load()
    bg = px[0, 0]
    dirty = 0
    for x in range(img.width):
        for y in range(margin):
            dirty += px[x, y] != bg
            dirty += px[x, img.height - 1 - y] != bg
    for y in range(img.height):
        for x in range(margin):
            dirty += px[x, y] != bg
            dirty += px[img.width - 1 - x, y] != bg
    if dirty:
        print(f"WARNING: {name} has {dirty} pixels touching the canvas edge")
    else:
        print(f"edge check ok: {name} is clear for {margin}px all round")


if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    image_total()
