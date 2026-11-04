"""Render the owner-flagging design for approval.

Outputs:
  design/07-owner-flagging.png  - workspace mock, the three owner-control states, mobile, anatomy

Run: python design/owner-flagging.py

Reuses the drawing helpers in design/render.py (Canvas, dash_round_rect, badge,
paragraph, icon_check, icon_file) and the small component helpers in
design/recurring.py (chevron, money). Nothing here is a new drawing library --
only the components this feature adds.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from render import Canvas, s  # noqa: E402
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
T_DASH = "#d8d5cb"          # the neutral dashed pill border
T_DASH_FLAG = "#e0b6b0"     # the flagged-list dashed pill border
T_RULE = "#efeee7"

# ------------------------------------------------------------------ geometry
W, H = 1800, 1180

# column 1 -- the workspace mock
PG_X, PG_Y, PG_R, PG_B = 60, 152, 800, 1120
CARD_L, CARD_R = 92, 776
PAD = 24                      # card padding

# column 2 -- the owner-control states
C2_X, C2_R = 840, 1320

# column 3 -- the anatomy legend
C3_X, C3_W = 1360, 364

# recurring row internals (inside the recurring panel).
# The owner control is a sibling of the disclosure button, so it sits last.
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


# ------------------------------------------------------------------ components
def count_badge(cv: Canvas, x: float, y: float, n: int, h: float = 17) -> float:
    """The count badge beside the 'Needs an owner' heading.

    Flag-soft fill with flag-red text: the badge carries the red, but it does
    not shout. A solid red pill would be louder than the heading it belongs to.
    """
    w = 12 + cv.tw(str(n), 10, "semibold")
    cv.rect((x, y, x + w, y + h), fill=T_FLAG_SOFT, radius=h / 2)
    cv.text((x + w / 2, y + 3.5), str(n), 10, "semibold", T_FLAG, anchor="mt")
    return w


def cross(cv: Canvas, cx: float, cy: float, size: float = 3.0, color: str = T_SUBTLE) -> None:
    """A tiny multiplication sign, drawn rather than typed."""
    cv.line([(cx - size, cy - size), (cx + size, cy + size)], color, 1.2)
    cv.line([(cx - size, cy + size), (cx + size, cy - size)], color, 1.2)


def dashed_pill_w(cv: Canvas, text: str, size: float = 11, pad: float = 11) -> float:
    return cv.tw(text, size, "semibold") + pad * 2


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
    """The '+ Add owner' affordance.

    Neutral by default — the recurring list must not become a wall of red.
    The flagged list may tint it, because that list is already the warning.
    """
    w = dashed_pill_w(cv, text, size, pad)
    border = T_DASH_FLAG if flagged else T_DASH
    label = T_FLAG if flagged else T_MUTED
    cv.rect((x, y, x + w, y + height), fill=None, radius=height / 2)
    cv.dash_round_rect((x, y, x + w, y + height), height / 2, border, 1.4, 6, 4)
    cv.text(
        (x + w / 2, y + (height - size) / 2 + 0.5),
        "+ " + text,
        size,
        "semibold",
        label,
        anchor="mt",
    )
    return w


def owner_pill_w(cv: Canvas, name: str, size: float = 11.5, clearable: bool = True) -> float:
    name_w = cv.tw(name, size, "semibold")
    gap = 7 if clearable else 0
    return 10 + name_w + gap + (8 if clearable else 0) + 10


def owner_pill(
    cv: Canvas,
    x: float,
    y: float,
    name: str,
    height: float = 26,
    size: float = 11.5,
    clearable: bool = True,
) -> float:
    """A filled soft pill carrying an owner's name, with a tiny x to clear it."""
    w = owner_pill_w(cv, name, size, clearable)
    cv.rect((x, y, x + w, y + height), fill=T_CHIP, radius=height / 2)
    cv.text((x + 10, y + (height - size) / 2 + 0.5), name, size, "semibold", T_INK_SOFT)
    if clearable:
        cross(cv, x + w - 14, y + height / 2, 2.6)
    return w


def cadence_chip(cv: Canvas, x: float, y: float) -> None:
    cv.rect((x, y, x + 56, y + 18), fill=T_CHIP, radius=9)
    cv.text((x + 28, y + 4.5), "Monthly", 10, "semibold", T_MUTED, anchor="mt")


def flag_dot(cv: Canvas, x: float, y: float) -> None:
    """The small marker on a flagged row: a red dot in a soft disc."""
    cv.d.ellipse([s(x - 3), s(y - 3), s(x + 9), s(y + 9)], fill=T_FLAG_SOFT)
    cv.d.ellipse([s(x), s(y), s(x + 6), s(y + 6)], fill=T_FLAG)


def flagged_row(
    cv: Canvas,
    y: float,
    name: str,
    evidence: str,
    amount: float,
    badge: int | None = None,
) -> None:
    """One row of the 'Needs an owner' section."""
    flag_dot(cv, F_DOT, y + 14)
    cv.text((F_NAME, y + 11), name, 12.5, "semibold", T_INK)
    cv.text((F_NAME, y + 29), evidence, 11, "regular", T_MUTED)

    cv.text((F_AMOUNT, y + 11), money(amount), 12.5, "semibold", T_INK, anchor="rt")
    cv.text((F_AMOUNT, y + 29), "per month", 10, "regular", T_SUBTLE, anchor="rt")

    w = dashed_pill(cv, F_OWNER, y + 13, "Add owner", flagged=True)

    if badge is not None:
        cv.badge(F_OWNER + w + 18, y + 26, badge, r=10)


def recurring_row(
    cv: Canvas,
    y: float,
    name: str,
    evidence: str,
    amount: float,
    owner: str | None,
) -> None:
    """One row of the recurring-charges panel, now with an owner column.

    The owner control sits after the disclosure button, never inside it: a
    control nested in a button is unreachable by keyboard.
    """
    cv.text((R_NAME, y + 13), name, 13.5, "semibold", T_INK)
    cv.text((R_NAME, y + 34), evidence, 11.5, "regular", T_MUTED)

    cadence_chip(cv, R_CHIP, y + 14)

    cv.text((R_AMOUNT, y + 13), money(amount), 13.5, "semibold", T_INK, anchor="rt")
    cv.text((R_AMOUNT, y + 34), "per month", 10.5, "regular", T_SUBTLE, anchor="rt")

    chevron(cv, R_CHEV, y + 32, 4.5, T_SUBTLE)

    if owner is None:
        dashed_pill(cv, R_OWNER, y + 19, "Add owner")
    else:
        owner_pill(cv, R_OWNER, y + 19, owner)


def file_chip(cv: Canvas, x: float, y: float, w: float) -> None:
    h = 52
    cv.rect((x, y, x + w, y + h), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=12)
    cv.rect((x + 10, y + 10, x + 38, y + 42), fill="#f3f2ec", radius=6)
    cv.icon_file(x + 18.5, y + 19, 11, T_MUTED)
    cv.text((x + 48, y + 13), "statement-12-months.csv", 11.5, "semibold", T_INK)
    cv.text((x + 48, y + 29), "9 KB · 250 rows", 10, "regular", T_MUTED)
    cv.d.ellipse([s(x + w - 40), s(y + 17), s(x + w - 24), s(y + 33)], fill=T_ACCENT)
    cv.icon_check(x + w - 32, y + 25, 4.6, T_SURFACE)


# ------------------------------------------------------------------ the mock
def workspace(cv: Canvas) -> None:
    cv.rect((PG_X, PG_Y, PG_R, PG_B), fill=T_PAGE, outline=T_HAIRLINE, width=1, radius=18)

    file_chip(cv, CARD_L, 176, CARD_R - CARD_L)

    # --- needs an owner ----------------------------------------------------
    fy0, fy1 = 248, 470
    cv.shadow((CARD_L, fy0, CARD_R, fy1), radius=18, spread=16, alpha=14, offset=5)
    cv.rect((CARD_L, fy0, CARD_R, fy1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=18)

    cv.badge(76, 255, 1, r=10)
    cv.text((CARD_L + PAD, 250), "Needs an owner", 13.5, "semibold", T_INK)
    head_w = cv.tw("Needs an owner", 13.5, "semibold")
    count_badge(cv, CARD_L + PAD + head_w + 10, 246, 3)
    cv.d.ellipse([s(CARD_R - PAD - 168), s(254), s(CARD_R - PAD - 162), s(260)], fill=T_FLAG)
    cv.text((CARD_R - PAD, 252), "Nobody has claimed these", 10.5, "regular", T_SUBTLE, anchor="rt")

    flagged_row(cv, 294, "ADOBE CREATIVE CLOUD", "12 payments · $719.88 total", 59.99, badge=3)
    flagged_row(cv, 346, "AMAZON WEB SERVICES", "12 payments · $507.60 total", 42.30)
    flagged_row(cv, 398, "SPOTIFY AB", "12 payments · $143.88 total", 11.99)

    # the flag marker, called out on the first flagged row
    cv.badge(76, 311, 2, r=10)

    # the card footer, then the note about the section disappearing
    cv.line([(CARD_L + PAD, 438), (CARD_R - PAD, 438)], T_HAIRLINE, 1)
    cv.text(
        (CARD_L + PAD, 448),
        "Name an owner to clear a charge. It leaves this list and appears in the "
        "recurring charges below with their name on it.",
        10.5,
        "regular",
        T_SUBTLE,
    )

    # --- the section disappears when nothing is left to flag ---------------
    cv.badge(76, 487, 5, r=10)
    cv.text(
        (CARD_L, 481),
        "When the last charge is assigned, this section is gone. There is no empty state.",
        10.5,
        "regular",
        T_SUBTLE,
    )

    # --- recurring charges -------------------------------------------------
    py0, py1 = 512, 992
    cv.shadow((CARD_L, py0, CARD_R, py1), radius=18, spread=18, alpha=16, offset=6)
    cv.rect((CARD_L, py0, CARD_R, py1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=16)

    cv.text((CARD_L + PAD, 534), "Recurring charges", 15, "semibold", T_INK)
    cv.rect((CARD_L + PAD + 148, 535, CARD_L + PAD + 176, 554), fill=T_CHIP, radius=9)
    cv.text((CARD_L + PAD + 162, 539), "14", 8.6, "semibold", T_MUTED, anchor="mt")
    cv.text((CARD_R - PAD, 539), "Largest first", 9.5, "regular", T_SUBTLE, anchor="rt")

    # the new owner column, called out above its first pill
    cv.badge(680, 540, 4, r=10)
    cv.line([(680, 551), (680, 582)], T_HAIRLINE, 1)

    rows = [
        ("CITY APARTMENTS RENT", "12 payments · $22,200.00 total", 1850.00, "Sam"),
        ("VERIZON WIRELESS", "12 payments · $1,020.00 total", 85.00, "Alex"),
        ("ADOBE CREATIVE CLOUD", "12 payments · $719.88 total", 59.99, None),
        ("AMAZON WEB SERVICES", "12 payments · $507.60 total", 42.30, None),
        ("NETFLIX.COM", "12 payments · $185.88 total", 15.49, "Me"),
        ("SPOTIFY AB", "12 payments · $143.88 total", 11.99, None),
    ]
    ry = 568
    for name, evidence, amount, owner in rows:
        cv.line([(CARD_L + PAD, ry + 63), (CARD_R - PAD, ry + 63)], T_RULE, 1)
        recurring_row(cv, ry, name, evidence, amount, owner)
        ry += 64

    cv.line([(CARD_L + PAD, ry), (CARD_R - PAD, ry)], T_HAIRLINE, 1)
    cv.text((CARD_L + PAD, ry + 12), "14 recurring charges grouped from 250 transactions", 9.5, "regular", T_SUBTLE)
    cv.text((CARD_R - PAD, ry + 12), "and 8 more", 9.5, "regular", T_SUBTLE, anchor="rt")

    # --- transactions, untouched -------------------------------------------
    ty0, ty1 = 1012, 1084
    cv.rect((CARD_L, ty0, CARD_R, ty1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=14)
    cv.text((CARD_L + PAD, ty0 + 16), "Transactions", 13, "semibold", T_INK)
    cv.rect((CARD_L + 108, ty0 + 17, CARD_L + 134, ty0 + 34), fill=T_CHIP, radius=8)
    cv.text((CARD_L + 121, ty0 + 20.5), "250", 8, "semibold", T_MUTED, anchor="mt")
    cv.text((CARD_R - PAD, ty0 + 18), "unchanged — every raw row is still here", 10, "regular", T_SUBTLE, anchor="rt")
    for i in range(2):
        cv.rect((CARD_L + PAD, ty0 + 44 + i * 12, CARD_R - 120, ty0 + 49 + i * 12), fill="#f2f1eb", radius=2)


# ------------------------------------------------------------------ states
def state_unowned(cv: Canvas) -> None:
    y0, y1 = 152, 306
    cv.rect((C2_X, y0, C2_R, y1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=16)
    cv.badge(C2_X + 28, 176, 6, r=10)
    cv.text((C2_X + 50, 170), "UNOWNED", 9.5, "semibold", T_MUTED, tracking=1.6)

    cv.rect((858, 192, 1302, 248), fill=T_CARD_ALT, radius=10)
    cv.text((874, 204), "ADOBE CREATIVE CLOUD", 12.5, "semibold", T_INK)
    cv.text((874, 223), "12 payments · $719.88 total", 10.5, "regular", T_MUTED)
    w = dashed_pill_w(cv, "Add owner")
    dashed_pill(cv, 1286 - w, 204, "Add owner")

    cv.paragraph(
        (858, 260),
        "A dashed, neutral pill. The main list is not a wall of red — red is "
        "reserved for the things that are actually wrong.",
        430,
        10.5,
        "regular",
        T_MUTED,
        1.45,
    )


def state_editing(cv: Canvas) -> None:
    y0, y1 = 322, 592
    cv.rect((C2_X, y0, C2_R, y1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=16)
    cv.badge(C2_X + 28, 348, 7, r=10)
    cv.text((C2_X + 50, 342), "EDITING", 9.5, "semibold", T_MUTED, tracking=1.6)

    cv.text((858, 362), "AMAZON WEB SERVICES", 12.5, "semibold", T_INK)
    cv.text((858, 381), "12 payments · $507.60 total", 10.5, "regular", T_MUTED)

    cv.shadow((858, 400, 1120, 432), radius=8, spread=10, alpha=12, offset=3)
    cv.rect((858, 400, 1120, 432), fill=T_SURFACE, outline=T_ACCENT, width=1.4, radius=8)
    cv.text((870, 409), "Sam", 12, "regular", T_INK)
    cv.line([(900, 406), (900, 427)], T_ACCENT, 1.4)

    cv.rect((1130, 400, 1160, 432), fill=T_ACCENT_SOFT, radius=8)
    cv.icon_check(1145, 416, 6.5, T_ACCENT)
    cross(cv, 1178, 416, 4, T_SUBTLE)

    cv.text((858, 438), "Enter confirms · Esc cancels", 10, "regular", T_MUTED)
    cv.text((858, 456), "SUGGESTIONS", 8.5, "semibold", T_SUBTLE, tracking=1.2)

    cv.shadow((858, 470, 1120, 544), radius=10, spread=12, alpha=14, offset=4)
    cv.rect((858, 470, 1120, 544), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=8)
    cv.rect((862, 522, 1116, 542), fill=T_ACCENT_SOFT, radius=6)
    cv.text((874, 482), "Alex", 11.5, "semibold", T_INK)
    cv.text((874, 504), "Me", 11.5, "semibold", T_INK)
    cv.text((874, 526), "Sam", 11.5, "semibold", T_INK)

    cv.paragraph(
        (858, 558),
        "Names you have used before come first — any name can still be typed.",
        430,
        10.5,
        "regular",
        T_MUTED,
        1.45,
    )


def state_assigned(cv: Canvas) -> None:
    y0, y1 = 608, 768
    cv.rect((C2_X, y0, C2_R, y1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=16)
    cv.badge(C2_X + 28, 634, 8, r=10)
    cv.text((C2_X + 50, 628), "ASSIGNED", 9.5, "semibold", T_MUTED, tracking=1.6)

    cv.rect((858, 650, 1302, 706), fill=T_CARD_ALT, radius=10)
    cv.text((874, 662), "NETFLIX.COM", 12.5, "semibold", T_INK)
    cv.text((874, 681), "12 payments · $185.88 total", 10.5, "regular", T_MUTED)
    w = owner_pill_w(cv, "Me")
    owner_pill(cv, 1286 - w, 662, "Me", height=28)

    cv.paragraph(
        (858, 720),
        "A soft filled pill with a tiny ×. Tap the pill to change the owner, "
        "tap × to clear it — the charge goes back to the flagged list.",
        430,
        10.5,
        "regular",
        T_MUTED,
        1.45,
    )


def mobile(cv: Canvas) -> None:
    cv.badge(902, 790, 9, r=10)
    cv.text((920, 784), "MOBILE — 320 PX", 9.5, "semibold", T_MUTED, tracking=1.8)

    px0, py0, px1, py1 = 920, 800, 1240, 1128
    cv.shadow((px0, py0, px1, py1), radius=16, spread=14, alpha=14, offset=5)
    cv.rect((px0, py0, px1, py1), fill=T_PAGE, outline=T_HAIRLINE, width=1, radius=16)

    # needs an owner
    cv.rect((932, 810, 1228, 1018), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=14)
    cv.text((946, 824), "NEEDS AN OWNER", 9, "semibold", T_INK, tracking=1.3)
    head_w = cv.tw("NEEDS AN OWNER", 9, "semibold", 1.3)
    count_badge(cv, 946 + head_w + 7, 820, 3, h=15)
    uw = cv.tw("Unclaimed", 8.5, "regular")
    cv.d.ellipse([s(1212 - uw - 10), s(826), s(1212 - uw - 6), s(830)], fill=T_FLAG)
    cv.text((1212, 822), "Unclaimed", 8.5, "regular", T_SUBTLE, anchor="rt")

    for i, (name, evidence, amount) in enumerate(
        [
            ("ADOBE CREATIVE CLOUD", "12 payments · $719.88 total", 59.99),
            ("AMAZON WEB SERVICES", "12 payments · $507.60 total", 42.30),
        ]
    ):
        ry = 852 + i * 80
        # on mobile the amount stays on the merchant's line
        cv.text((946, ry + 6), name, 11.5, "semibold", T_INK)
        amt = money(amount)
        cv.text((1212, ry + 8), amt, 11, "semibold", T_INK, anchor="rt")
        cv.text((946, ry + 26), evidence, 9.5, "regular", T_MUTED)
        # and the owner control drops onto its own line below
        dashed_pill(cv, 946, ry + 44, "Add owner", size=10, height=22, pad=9, flagged=True)

    # recurring charges
    cv.rect((932, 1030, 1228, 1108), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=14)
    cv.text((946, 1040), "RECURRING CHARGES", 8.5, "semibold", T_SUBTLE, tracking=1.2)
    cv.text((946, 1054), "NETFLIX.COM", 11.5, "semibold", T_INK)
    cv.text((946, 1068), "12 payments · $185.88 total", 9.5, "regular", T_MUTED)
    owner_pill(cv, 946, 1078, "Me", height=22, size=10.5)


# ------------------------------------------------------------------ legend
LEGEND = [
    (
        1,
        "Needs an owner",
        "A section at the top of the workspace, above the recurring panel. It lists "
        "only the charges that have no owner, and it is hidden entirely when there "
        "are none.",
    ),
    (
        2,
        "Flag marker",
        "A small red dot on every flagged row. Merchant, evidence and amount stay "
        "ink and muted — the row is marked, not repainted.",
    ),
    (
        3,
        "Inline control",
        "The owner is assigned in place, in the list. No dialog, no second screen. "
        "Enter confirms, Escape cancels.",
    ),
    (
        4,
        "Owner column",
        "Every row in the recurring panel gains one, at the end. It sits outside the "
        "disclosure button, so it stays reachable by keyboard. The panel still "
        "lists every charge — the inventory never shrinks.",
    ),
    (
        5,
        "Nothing left to flag",
        "When the last charge is assigned the section disappears. No empty state, "
        "no placeholder, no “all good!” card.",
    ),
    (
        6,
        "Unowned",
        "A dashed, neutral pill that reads “+ Add owner”. The main list is not a "
        "wall of red.",
    ),
    (
        7,
        "Editing",
        "An input, the names you have used before, and a confirm button. The list "
        "is a shortcut, not a limit.",
    ),
    (
        8,
        "Assigned",
        "A soft filled pill with a tiny ×. Tap the pill to change the owner, tap × "
        "to clear it.",
    ),
    (
        9,
        "Mobile, 320 px",
        "The owner control drops onto its own line below the row. The amount stays "
        "on the merchant’s line in the flagged list.",
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
        (T_FLAG, "count badge · row marker · the flagged pill"),
        (T_DASH, "the neutral “+ Add owner” pill"),
        (T_CHIP, "an assigned owner pill"),
        (T_ACCENT, "the confirm action — income stays the loudest green"),
    ):
        cv.rect((C3_X, ly - 2, C3_X + 16, ly + 14), fill=swatch, outline=T_HAIRLINE, width=1, radius=4)
        cv.text((C3_X + 24, ly), label, 9.8, "regular", T_MUTED)
        ly += 22

    ly += 8
    cv.text((C3_X, ly), "KEYBOARD", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    ly = cv.paragraph(
        (C3_X, ly),
        "Tab reaches every pill. Enter opens the input. Up and Down move through the "
        "suggestions. Enter saves, Escape cancels, Tab leaves.",
        C3_W,
        9.8,
        "regular",
        T_MUTED,
        1.45,
    )

    ly += 10
    cv.text((C3_X, ly), "STORAGE", 9.5, "semibold", T_MUTED, tracking=1.8)
    ly += 20
    ly = cv.paragraph(
        (C3_X, ly),
        "Owner names live in this browser's local storage, keyed by merchant, so "
        "they survive from month to month. Nothing is uploaded.",
        C3_W,
        9.8,
        "regular",
        T_MUTED,
        1.45,
    )
    return ly


# ------------------------------------------------------------------ image
def image_owner() -> None:
    cv = Canvas(W, H)

    cv.text((60, 50), "OWNER FLAGGING — ANATOMY", 10.5, "semibold", T_MUTED, tracking=2.2)
    cv.text((60, 72), "Assign a name to every recurring charge. The unnamed ones come first.", 17, "semibold", T_INK)
    cv.text((1740, 74), "Step 4 · local only · no account", 10.5, "regular", T_SUBTLE, anchor="rt")

    workspace(cv)
    state_unowned(cv)
    state_editing(cv)
    state_assigned(cv)
    mobile(cv)
    legend(cv)

    cv.line([(60, 1136), (1740, 1136)], T_HAIRLINE, 1)
    cv.text((60, 1148), "Spend Audit · step 4 of the roadmap · the file never leaves the device", 10, "regular", T_SUBTLE)
    cv.text((1740, 1148), "design/OWNERS.md holds the full spec", 10, "regular", T_SUBTLE, anchor="rt")

    cv.save("07-owner-flagging.png")
    check_edges("07-owner-flagging.png")


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
    image_owner()
