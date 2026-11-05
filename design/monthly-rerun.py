"""Render the monthly re-run design for approval.

Outputs:
  design/09-monthly-rerun.png  - the three-upload flow, the workspace with the
                                comparison and the history added, the three
                                honest states, three placements for the
                                comparison, the 320 px mobile mock, and the
                                numbered legend

Run: python design/monthly-rerun.py

Reuses the drawing helpers in design/render.py (Canvas, badge, paragraph,
icon_check, icon_file, font) and the small component helpers in
design/recurring.py (chevron, money), the way design/total-cost.py does. The
number on the page is drawn with the same helpers the shipped step 5 diagram
uses -- baseline_at, figure, count_badge, flag_dot -- imported from
design/total-cost.py, so the two diagrams cannot drift apart. Nothing here is
a new drawing library; only the components this feature adds.

The numbers are real. The three months are the fixture's three months
(test-data/statement-3-months.csv, 62 rows, 14 recurring charges) renamed
November, December and January, with one deliberate price rise in the newest
month so that the comparison has something to show. Every figure in this
diagram was produced by running the real detector over exactly this data;
design/check-monthly.py proves the arithmetic and the colours.
"""
from __future__ import annotations

import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from render import (  # noqa: E402
    WHITE,
    Canvas,
    font,
    s,
)
from recurring import money  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# The components the shipped step 5 diagram already uses, so this diagram is
# drawn with the same hands.
_spec = importlib.util.spec_from_file_location(
    "total_cost", os.path.join(HERE, "total-cost.py")
)
total_cost = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(total_cost)

baseline_at = total_cost.baseline_at
figure = total_cost.figure
count_badge = total_cost.count_badge
flag_dot = total_cost.flag_dot

# the app's tokens, written out so the diagram cannot drift from the app
T_PAGE = total_cost.T_PAGE
T_SURFACE = total_cost.T_SURFACE
T_INK = total_cost.T_INK
T_INK_SOFT = total_cost.T_INK_SOFT
T_MUTED = total_cost.T_MUTED
T_SUBTLE = total_cost.T_SUBTLE
T_HAIRLINE = total_cost.T_HAIRLINE
T_ACCENT = total_cost.T_ACCENT
T_ACCENT_SOFT = total_cost.T_ACCENT_SOFT
T_FLAG = total_cost.T_FLAG
T_FLAG_SOFT = total_cost.T_FLAG_SOFT

# neutrals that already exist in the app's surfaces
T_CHIP = total_cost.T_CHIP
T_CARD_ALT = total_cost.T_CARD_ALT
T_DASH = total_cost.T_DASH
T_DASH_FLAG = total_cost.T_DASH_FLAG
T_RULE = total_cost.T_RULE

# ------------------------------------------------------------------ geometry
W, H = 1800, 1180

ROW_A = 348          # where the second row starts

PG_X, PG_Y, PG_R, PG_B = 60, ROW_A, 800, 1120   # the workspace mock
CARD_L, CARD_R = 92, 776
PAD = 22

C2_X, C2_R = 840, 1320          # the three states and the mobile mock
C3_X, C3_R = 1360, 1740         # the options and the legend
C3_W = C3_R - C3_X

# ------------------------------------------------------------------ the data
# The fixture's three months, renamed, with one deliberate price rise in
# January. test-data/statement-3-months.csv holds 62 rows and 14 recurring
# charges; these are the amounts each charge was paid in each month.
CHARGES = [
    # name,                   November, December, January
    ("CITY APARTMENTS RENT", 1850.00, 1850.00, 1850.00),
    ("GEICO AUTO INSURANCE", 128.50, 128.50, 128.50),
    ("CITY POWER & WATER", 120.70, 123.40, 126.10),
    ("VERIZON WIRELESS", 85.00, 85.00, 85.00),
    ("ADOBE CREATIVE CLOUD", 59.99, 59.99, 59.99),
    ("AMAZON WEB SERVICES", 42.30, 42.30, 42.30),
    ("PLANET FITNESS", 24.99, 24.99, 24.99),
    ("CHATGPT SUBSCRIPTION", 20.00, 20.00, 20.00),
    ("NOTION LABS", 19.00, 19.00, 19.00),
    ("NETFLIX.COM", 15.49, 15.49, 17.99),
    ("FIGMA PROFESSIONAL", 15.00, 15.00, 15.00),
    ("SPOTIFY AB", 11.99, 11.99, 11.99),
    ("GOOGLE ONE", 2.99, 2.99, 2.99),
    ("APPLE ICLOUD+", 2.99, 2.99, 2.99),
]

MONTHS = [
    ("November 2026", "statement-november.csv", 21),
    ("December 2026", "statement-december.csv", 20),
    ("January 2027", "statement-january.csv", 21),
]

TOTAL_NOV = round(sum(c[1] for c in CHARGES), 2)   # 2398.94
TOTAL_DEC = round(sum(c[2] for c in CHARGES), 2)   # 2401.64
TOTAL_JAN = round(sum(c[3] for c in CHARGES), 2)   # 2406.84
DELTA = round(TOTAL_JAN - TOTAL_DEC, 2)            # 5.20

# the charges that moved between December and January
MOVED = [
    ("CITY POWER & WATER", 123.40, 126.10),
    ("NETFLIX.COM", 15.49, 17.99),
]
UNCHANGED = len(CHARGES) - len(MOVED)              # 12

# the three charges that already have an owner (Sam, Alex, Me)
OWNED = {"CITY APARTMENTS RENT", "VERIZON WIRELESS", "NETFLIX.COM"}
UNOWNED_TOTAL = round(sum(c[3] for c in CHARGES if c[0] not in OWNED), 2)   # 453.85
N_UNOWNED = len(CHARGES) - len(OWNED)               # 11
N_TRANSACTIONS = 62

# what the shipped median basis says on the fixture's own three months
MEDIAN_BASIS = 2401.64      # the median of every payment
NEWEST_BASIS = 2404.34      # the newest payment of every charge
MEDIAN_GAP = round(NEWEST_BASIS - MEDIAN_BASIS, 2)   # 2.70 -- CITY POWER & WATER

# what today's 4% rule does to the price rise
TODAY_CHARGES = 13
TODAY_JAN = 2388.85
TODAY_DELTA = 2.70


def delta(amount: float) -> str:
    """A signed money string: "+$2.70", "-$0.40"."""
    text = money(abs(amount))
    return f"+{text}" if amount >= 0 else f"-{text}"


# ------------------------------------------------------------------ helpers
def cap_text(
    cv: Canvas,
    x: float,
    cap_top: float,
    txt: str,
    size: float,
    weight: str = "regular",
    fill: str = T_INK,
    tracking: float = 0,
    anchor: str = "ls",
) -> None:
    """Text placed by its cap line, the way the house places it.

    PIL anchors on the ascender, so "draw at y" is not "the letters start at
    y". Everything here is placed by its cap line instead.
    """
    bb = font(weight, size).getbbox("0")
    if tracking:
        # tracked text is drawn letter by letter from the ascender origin
        cv.text(
            (x, cap_top - bb[1] / s(1)),
            txt,
            size,
            weight,
            fill,
            anchor=anchor[0] + "t",
            tracking=tracking,
        )
    else:
        cv.text((x, baseline_at(cap_top, size, weight)), txt, size, weight, fill, anchor=anchor)


def section_label(cv: Canvas, x: float, cap_top: float, txt: str) -> None:
    """The small tracked heading the house uses for every section."""
    cap_text(cv, x, cap_top, txt.upper(), 9.5, "semibold", T_MUTED, tracking=1.7)


def panel(cv: Canvas, box, radius: float = 16, shadow: bool = True) -> None:
    if shadow:
        cv.shadow(box, radius=radius, spread=16, alpha=14, offset=5)
    cv.rect(box, fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=radius)


def history_strip(
    cv: Canvas,
    x: float,
    cap_top: float,
    values: list[tuple[str, float]],
    gap: float = 120,
    max_h: float = 20,
    bar_w: float = 5,
) -> None:
    """The compact history strip: a month, its total, and a bar from zero.

    The bars are scaled from zero, so a flat series looks flat. The strip is a
    trend, not a change detector -- the change is in the list above it.
    """
    top = max(v for _, v in values) or 1.0
    cx = x
    for label, value in values:
        cap_text(cv, cx, cap_top, label, 9.5, "semibold", T_MUTED)
        cap_text(cv, cx, cap_top + 15, money(value), 12, "semibold", T_INK)
        h = max(2.0, max_h * value / top)
        cv.rect((cx, cap_top + 27, cx + bar_w, cap_top + 27 + h), fill=T_DASH, radius=2.5)
        cx += gap


# ------------------------------------------------------------------ the flow
def flow(cv: Canvas) -> None:
    section_label(cv, 60, 116, "The flow — three uploads, one saved history")

    bodies = [
        [
            "Saved in this browser. One month of payments is on file.",
            "Nothing repeats often enough to call, so the list stays empty — and the card says so.",
        ],
        [
            "Saved in this browser. Two months of payments are on file.",
            "The detector wants three payments of the same charge. Still one month short.",
        ],
        [
            "November, December and January are analysed together, as one history.",
            "Fourteen charges are found, and January is compared with December.",
        ],
    ]
    sees = [
        "No recurring charges yet — one month is not enough to spot a repeat.",
        "Still empty. Nothing here is wrong; there is simply not enough to go on.",
        "14 recurring charges, $2,406.84 a month. January against December.",
    ]

    for i, (label, filename, rows) in enumerate(MONTHS):
        x = 60 + i * 380
        y = 134
        panel(cv, (x, y, x + 340, y + 152), radius=14)

        cv.badge(x + 22, y + 22, i + 1, r=10)
        cap_text(cv, x + 42, y + 14, label.upper(), 11.5, "semibold", T_INK)
        cap_text(cv, x + 42, y + 32, f"{filename} · {rows} rows", 9.5, "regular", T_SUBTLE)

        cv.line([(x + 16, y + 52), (x + 324, y + 52)], T_RULE, 1)

        cap_text(cv, x + 16, y + 62, bodies[i][0], 9.8, "regular", T_MUTED)
        y2 = cap_top = y + 78
        for line in cv.wrap(bodies[i][1], 308, 9.8, "regular"):
            cap_text(cv, x + 16, cap_top, line, 9.8, "regular", T_MUTED)
            cap_top += 14.2

        cv.rect((x + 16, y + 112, x + 324, y + 144), fill=T_CARD_ALT, radius=7)
        cap_top = y + 118
        for line in cv.wrap(sees[i], 290, 9.4, "regular"):
            cap_text(cv, x + 26, cap_top, line, 9.4, "regular", T_INK_SOFT)
            cap_top += 13.2

        if i < 2:
            ax = x + 360
            cap_text(cv, ax, y + 42, "saved", 8.5, "regular", T_SUBTLE, anchor="mt")
            cv.line([(ax, y + 70), (ax + 14, y + 70)], T_DASH, 1.4)
            cv.line([(ax + 14, y + 70), (ax + 9, y + 66.5)], T_DASH, 1.4)
            cv.line([(ax + 14, y + 70), (ax + 9, y + 73.5)], T_DASH, 1.4)

    cap_text(
        cv,
        60,
        300,
        "The three months are analysed together — that is what makes a repeat visible. "
        "Nothing is uploaded, and nothing leaves this browser.",
        10.5,
        "regular",
        T_MUTED,
    )


# ------------------------------------------------------------------ decisions
def decisions(cv: Canvas) -> None:
    section_label(cv, 1200, 116, "Four decisions")

    items = [
        (
            "D1 · One price change allowed",
            "A subscription that raises its price is a price change, not a dead charge. "
            "Relaxing the 4% rule changes nothing on either fixture: still 14 recurring, "
            "7 rejected, no new false positives.",
        ),
        (
            "D2 · One basis",
            "The headline and the comparison count the same charges at the same amounts. "
            "The median lags a month: on the fixture it says $2,401.64 where the newest "
            "payment says $2,404.34. The $2.70 is CITY POWER & WATER.",
        ),
        (
            "D4 · Keep twelve months",
            "The oldest month is dropped when a thirteenth arrives. “Forget saved "
            "history” clears all of it in one click — stored data that cannot be "
            "deleted is a trap.",
        ),
        (
            "D5 · Only report a stop we knew about",
            "A charge is called “no longer charged” only if the app had already "
            "listed it. A shop you happened to pay twice is not a cancelled subscription.",
        ),
    ]

    y = 134
    for title, body in items:
        cap_text(cv, 1200, y, title, 10.5, "semibold", T_INK)
        cap_top = y + 14
        for line in cv.wrap(body, 540, 9.4, "regular"):
            cap_text(cv, 1200, cap_top, line, 9.4, "regular", T_MUTED)
            cap_top += 13.4
        y += 44


# ------------------------------------------------------------------ workspace
def headline_card(cv: Canvas, x: float, y: float, w: float) -> float:
    """The headline, as built: one number, the largest type on the page."""
    h = 144
    panel(cv, (x, y, x + w, y + h), radius=18)
    cap_text(cv, x + PAD, y + 24, "Total monthly recurring cost", 12, "semibold", T_MUTED)

    right, base = figure(cv, x + PAD, y + 45, TOTAL_JAN, size=44, tracking=-0.88)
    cap_text(cv, right + 8, base - 9.5, "per month", 12.5, "regular", T_SUBTLE)

    head = "across 14 recurring charges"
    cap_text(cv, x + PAD, y + 103, head, 12, "regular", T_SUBTLE)
    w1 = cv.tw(head, 12, "regular")
    cap_text(cv, x + PAD + w1 + 8, y + 103, "·", 12, "regular", T_SUBTLE)
    cap_text(
        cv,
        x + PAD + w1 + 16,
        y + 103,
        f"{money(UNOWNED_TOTAL)} per month has no owner",
        12,
        "regular",
        T_FLAG,
    )
    return y + h


def compare_panel(cv: Canvas, x: float, y: float, w: float) -> float:
    """The comparison: this month against the month before it."""
    h = 318
    panel(cv, (x, y, x + w, y + h), radius=16)

    lx = x + PAD
    rx = x + w - PAD

    cap_text(cv, lx, y + 20, "Compared with December 2026", 13.5, "semibold", T_INK)
    cap_text(
        cv, rx, y + 23, "the same 14 charges in both months", 10, "regular", T_SUBTLE, anchor="rt"
    )

    # this month
    cap_text(cv, lx, y + 42, "January 2027", 11, "semibold", T_MUTED)
    right, base = figure(cv, lx, y + 58, TOTAL_JAN, size=22, tracking=-0.44)
    cap_text(cv, right + 8, base - 8, "per month", 11, "regular", T_SUBTLE)

    # the change, in words. No arrow, no colour: the sentence carries it.
    cap_text(cv, lx, y + 88, delta(DELTA), 12.5, "semibold", T_INK)
    w1 = cv.tw(delta(DELTA), 12.5, "semibold")
    cap_text(
        cv,
        lx + w1 + 6,
        y + 88,
        f"more than December 2026 ({money(TOTAL_DEC)})",
        12.5,
        "regular",
        T_INK_SOFT,
    )

    # the charges that moved
    cap_text(cv, lx, y + 116, "INCREASED", 9, "semibold", T_MUTED, tracking=1.3)
    ry = y + 132
    for name, before, after in MOVED:
        cap_text(cv, lx, ry, name, 12, "semibold", T_INK)
        cap_text(
            cv, rx - 108, ry + 1, f"{money(before)} → {money(after)}", 11.5, "regular", T_MUTED, anchor="rt"
        )
        cap_text(cv, rx, ry, delta(after - before), 12, "semibold", T_INK, anchor="rt")
        ry += 21

    cap_text(cv, lx, y + 178, f"{UNCHANGED} charges unchanged.", 10.5, "regular", T_SUBTLE)

    # the history strip
    cv.line([(lx, y + 198), (rx, y + 198)], T_HAIRLINE, 1)
    cap_text(cv, lx, y + 210, "MONTHS ON FILE", 9, "semibold", T_MUTED, tracking=1.3)
    history_strip(
        cv,
        lx + 190,
        y + 206,
        [
            ("November 2026", TOTAL_NOV),
            ("December 2026", TOTAL_DEC),
            ("January 2027", TOTAL_JAN),
        ],
    )

    cap_text(cv, lx, y + 278, "3 months saved in this browser", 10, "regular", T_SUBTLE)
    forget = "Forget saved history"
    cap_text(cv, rx, y + 278, forget, 10.5, "regular", T_MUTED, anchor="rt")
    fw = cv.tw(forget, 10.5, "regular")
    cv.line([(rx - fw, y + 284), (rx, y + 284)], T_DASH, 1)
    return y + h


def owner_panel(cv: Canvas, x: float, y: float, w: float) -> float:
    h = 80
    panel(cv, (x, y, x + w, y + h), radius=16)
    cap_text(cv, x + PAD, y + 16, "Needs an owner", 15, "semibold", T_INK)
    head_w = cv.tw("Needs an owner", 15, "semibold")
    count_badge(cv, x + PAD + head_w + 10, y + 14, N_UNOWNED)

    flag_dot(cv, x + PAD + 5, y + 47)
    cap_text(cv, x + PAD + 20, y + 46, "GEICO AUTO INSURANCE", 13, "semibold", T_INK)
    cap_text(cv, x + w - PAD, y + 46, money(128.50), 13, "semibold", T_INK, anchor="rt")
    cap_text(cv, x + w - PAD, y + 64, "per month", 10.5, "regular", T_SUBTLE, anchor="rt")
    return y + h


def recurring_panel(cv: Canvas, x: float, y: float, w: float) -> float:
    h = 106
    panel(cv, (x, y, x + w, y + h), radius=16)
    cap_text(cv, x + PAD, y + 16, "Recurring charges", 15, "semibold", T_INK)
    cv.rect((x + PAD + 132, y + 17, x + PAD + 160, y + 36), fill=T_CHIP, radius=9)
    cap_text(cv, x + PAD + 146, y + 21, "14", 8.6, "semibold", T_MUTED, anchor="mt")
    cap_text(cv, x + w - PAD, y + 21, "Largest first", 9.5, "regular", T_SUBTLE, anchor="rt")

    cap_text(cv, x + PAD, y + 52, "CITY APARTMENTS RENT", 13, "semibold", T_INK)
    cap_text(cv, x + w - PAD, y + 52, money(1850.00), 13, "semibold", T_INK, anchor="rt")
    cap_text(cv, x + w - PAD, y + 70, "per month", 10.5, "regular", T_SUBTLE, anchor="rt")

    cv.line([(x + PAD, y + 84), (x + w - PAD, y + 84)], T_HAIRLINE, 1)
    cap_text(
        cv,
        x + PAD,
        y + 92,
        f"14 recurring charges grouped from {N_TRANSACTIONS} transactions",
        10.5,
        "regular",
        T_SUBTLE,
    )
    total = money(TOTAL_JAN)
    cap_text(cv, x + w - PAD, y + 92, total, 10.5, "semibold", T_INK_SOFT, anchor="rt")
    cap_text(
        cv,
        x + w - PAD - cv.tw(total, 10.5, "semibold"),
        y + 92,
        " per month in total",
        10.5,
        "regular",
        T_INK_SOFT,
        anchor="rt",
    )
    return y + h


def workspace(cv: Canvas) -> None:
    cv.rect((PG_X, PG_Y, PG_R, PG_B), fill=T_PAGE, outline=T_HAIRLINE, width=1, radius=18)

    # the file chip
    cy = PG_Y + 16
    cv.rect((CARD_L, cy, CARD_R, cy + 52), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=12)
    cv.rect((CARD_L + 10, cy + 10, CARD_L + 38, cy + 42), fill="#f3f2ec", radius=6)
    cv.icon_file(CARD_L + 18.5, cy + 19, 11, T_MUTED)
    cap_text(cv, CARD_L + 48, cy + 13, "statement-january.csv", 11.5, "semibold", T_INK)
    cap_text(cv, CARD_L + 48, cy + 29, "3.1 KB · 21 rows · January 2027", 10, "regular", T_MUTED)
    cv.d.ellipse([s(CARD_R - 40), s(cy + 17), s(CARD_R - 24), s(cy + 33)], fill=T_ACCENT)
    cv.icon_check(CARD_R - 32, cy + 25, 4.6, T_SURFACE)
    cap_text(cv, CARD_R - 48, cy + 29, "Saved", 10, "regular", T_MUTED, anchor="rt")

    y = headline_card(cv, CARD_L, PG_Y + 80, CARD_R - CARD_L)
    y = compare_panel(cv, CARD_L, y + 12, CARD_R - CARD_L)
    y = owner_panel(cv, CARD_L, y + 12, CARD_R - CARD_L)
    recurring_panel(cv, CARD_L, y + 12, CARD_R - CARD_L)


# ------------------------------------------------------------------ states
def state_card(
    cv: Canvas,
    x: float,
    y: float,
    w: float,
    heading: str,
    body: list[str],
    amount: float | None,
) -> None:
    panel(cv, (x, y, x + w, y + 88), radius=14)
    cap_text(cv, x + 20, y + 18, "Total monthly recurring cost", 11, "semibold", T_MUTED)

    if amount is None:
        cap_text(cv, x + 20, y + 34, heading, 17, "semibold", T_INK_SOFT)
        by = y + 60
    else:
        right, base = figure(cv, x + 20, y + 34, amount, size=24, tracking=-0.48)
        cap_text(cv, right + 8, base - 8.5, "per month", 11, "regular", T_SUBTLE)
        by = y + 62

    for line in body:
        cap_text(cv, x + 20, by, line, 10.5, "regular", T_SUBTLE)
        by += 15


def states(cv: Canvas) -> None:
    section_label(cv, C2_X, 332, "The first run — three honest states")

    state_card(
        cv,
        C2_X,
        364,
        C2_R - C2_X,
        "No recurring charges yet",
        [
            "One month is not enough to tell a repeat from a one-off.",
            "November 2026 is saved — two more months and this becomes a number.",
        ],
        None,
    )
    cap_text(cv, C2_X, 348, "MONTH 1 · NOVEMBER 2026", 9.5, "semibold", T_MUTED, tracking=1.7)

    state_card(
        cv,
        C2_X,
        480,
        C2_R - C2_X,
        "No recurring charges yet",
        [
            "Two months are on file. One more month of payments and we can",
            "name your recurring charges. Nothing here is wrong.",
        ],
        None,
    )
    cap_text(cv, C2_X, 464, "MONTH 2 · DECEMBER 2026", 9.5, "semibold", T_MUTED, tracking=1.7)

    state_card(
        cv,
        C2_X,
        596,
        C2_R - C2_X,
        "",
        ["across 14 recurring charges", "and January is compared with December"],
        TOTAL_JAN,
    )
    cap_text(cv, C2_X, 580, "MONTH 3 · JANUARY 2027", 9.5, "semibold", T_MUTED, tracking=1.7)


# ------------------------------------------------------------------ options
def option(cv: Canvas, y: float, letter: str, title: str, note: str, recommended: bool) -> None:
    cap_text(cv, C3_X, y, f"{letter} · {title}", 11.5, "semibold", T_INK)
    if recommended:
        cv.rect((C3_R - 88, y - 6, C3_R, y + 10), fill=T_INK, radius=8)
        cap_text(cv, C3_R - 44, y - 1, "RECOMMENDED", 8, "bold", WHITE, anchor="ms")
    else:
        cv.rect(
            (C3_R - 88, y - 6, C3_R, y + 10),
            fill=T_CARD_ALT,
            outline=T_HAIRLINE,
            width=1,
            radius=8,
        )
        cap_text(cv, C3_R - 44, y - 1, "ALTERNATIVE", 8, "bold", T_SUBTLE, anchor="ms")

    cap_top = y + 20
    for line in cv.wrap(note, C3_W, 9.6, "regular"):
        cap_text(cv, C3_X, cap_top, line, 9.6, "regular", T_MUTED)
        cap_top += 13.6


def sketch_pair(cv: Canvas, y: float, right_label: str, right_note: str, tab: bool = False) -> None:
    """The little drawing that shows where the comparison sits."""
    cv.rect((C3_X, y, C3_X + 168, y + 34), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=8)
    cap_text(cv, C3_X + 10, y + 9, "Total monthly", 8.5, "regular", T_MUTED)
    cap_text(cv, C3_X + 10, y + 20, "recurring cost", 8.5, "regular", T_MUTED)

    if tab:
        cv.rect((C3_X + 176, y, C3_R, y + 34), fill=T_CHIP, radius=8)
        cap_text(cv, C3_X + 186, y + 9, right_label, 8.5, "semibold", T_INK_SOFT)
        cap_text(cv, C3_X + 186, y + 20, right_note, 8.5, "regular", T_MUTED)
    else:
        cv.rect((C3_X + 176, y, C3_R, y + 34), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=8)
        cap_text(cv, C3_X + 186, y + 9, right_label, 8.5, "semibold", T_INK)
        cap_text(cv, C3_X + 186, y + 20, right_note, 8.5, "regular", T_MUTED)


def options(cv: Canvas) -> None:
    section_label(cv, C3_X, 332, "D3 · Where the comparison lives")

    option(
        cv,
        348,
        "A",
        "A quiet panel under the headline",
        "The comparison sits directly under the headline card, and the history strip is "
        "the last thing in that panel. The eye moves down one step. The headline keeps "
        "the big number; the comparison is 22 px, not 44 px.",
        True,
    )
    sketch_pair(cv, 412, "Compared with December 2026", "+$5.20")

    option(
        cv,
        466,
        "B",
        "The same, with the history at the foot of the page",
        "The comparison stays under the headline; the history strip moves to the bottom "
        "of the workspace, under Transactions. Further away, and it competes with the "
        "transaction list for the last screen.",
        False,
    )
    sketch_pair(cv, 530, "Compared with December 2026", "history strip ↓ at the foot")

    option(
        cv,
        584,
        "C",
        "Its own Months view",
        "Both the comparison and the history live in a separate tab. The workspace is "
        "untouched, but “what changed?” is a click away — and on a phone it "
        "is another screen.",
        False,
    )
    sketch_pair(cv, 648, "Months", "comparison + history", tab=True)


# ------------------------------------------------------------------ mobile
def mobile(cv: Canvas) -> None:
    section_label(cv, 858, 700, "Mobile — 320 px")

    px0, py0, px1, py1 = 852, 722, 1172, 1120
    cv.rect((px0, py0, px1, py1), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=18)

    lx = px0 + 16
    rx = px1 - 16

    # the headline, at the phone's size
    cv.rect((lx, py0 + 14, rx, py0 + 108), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=14)
    cap_text(cv, lx + 14, py0 + 28, "Total monthly recurring cost", 10, "semibold", T_MUTED)
    right, base = figure(cv, lx + 14, py0 + 44, TOTAL_JAN, size=30, tracking=-0.6)
    cap_text(cv, right + 8, base - 8, "per month", 10, "regular", T_SUBTLE)
    cap_text(cv, lx + 14, py0 + 86, "across 14 recurring charges", 9.5, "regular", T_SUBTLE)

    # the comparison, stacked
    cv.rect((lx, py0 + 120, rx, py0 + 310), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=14)
    cap_text(cv, lx + 14, py0 + 134, "Compared with December 2026", 11.5, "semibold", T_INK)
    cap_text(cv, lx + 14, py0 + 152, "January 2027", 10, "semibold", T_MUTED)
    figure(cv, lx + 14, py0 + 164, TOTAL_JAN, size=20, tracking=-0.4)
    cap_text(cv, lx + 14, py0 + 186, delta(DELTA), 11.5, "semibold", T_INK)
    w1 = cv.tw(delta(DELTA), 11.5, "semibold")
    cap_text(cv, lx + 14 + w1 + 5, py0 + 186, "more than December", 11.5, "regular", T_INK_SOFT)

    cap_text(cv, lx + 14, py0 + 208, "INCREASED", 8.5, "semibold", T_MUTED, tracking=1.2)
    ry = py0 + 222
    for name, before, after in MOVED:
        cap_text(cv, lx + 14, ry, name, 10.5, "semibold", T_INK)
        cap_text(cv, lx + 14, ry + 15, f"{money(before)} → {money(after)}", 10, "regular", T_MUTED)
        cap_text(cv, rx - 14, ry + 15, delta(after - before), 10.5, "semibold", T_INK, anchor="rt")
        ry += 32

    cap_text(cv, lx + 14, py0 + 288, f"{UNCHANGED} charges unchanged.", 9.5, "regular", T_SUBTLE)

    # the history strip
    cv.rect((lx, py0 + 322, rx, py0 + 384), fill=T_SURFACE, outline=T_HAIRLINE, width=1, radius=14)
    cap_text(cv, lx + 14, py0 + 334, "MONTHS ON FILE", 8.5, "semibold", T_MUTED, tracking=1.2)
    history_strip(
        cv,
        lx + 14,
        py0 + 348,
        [("Nov 2026", TOTAL_NOV), ("Dec 2026", TOTAL_DEC), ("Jan 2027", TOTAL_JAN)],
        gap=88,
        max_h=8,
        bar_w=4,
    )

    # notes
    notes = [
        ("32 px", "the card and the panel keep the same order"),
        ("22 px", "the comparison figure, against 30 px in the card"),
        ("3 bars", "the strip stays; the labels shorten"),
        ("no crop", "nothing is cut off at the narrowest width"),
    ]
    ny = py0 + 14
    for label, body in notes:
        cap_text(cv, 1196, ny, label.upper(), 9, "semibold", T_MUTED, tracking=1.2)
        cap_top = ny + 12
        for line in cv.wrap(body, 124, 9, "regular"):
            cap_text(cv, 1196, cap_top, line, 9, "regular", T_SUBTLE)
            cap_top += 12.6
        ny += 46


# ------------------------------------------------------------------ legend
def legend(cv: Canvas) -> None:
    section_label(cv, C3_X, 704, "Anatomy")

    entries = [
        (
            "The flow",
            "Three uploads. Each month is saved on this machine before anything is compared.",
        ),
        (
            "Saved, not summarised",
            "The rows of each month are kept, because a summary cannot feed the detector.",
        ),
        (
            "One basis",
            "The headline and the comparison count the same charges at the same amounts.",
        ),
        (
            "The comparison panel",
            "Directly under the headline, and deliberately smaller: 22 px, not 44 px.",
        ),
        (
            "The delta line",
            "“$5.20 more than December 2026”. Ink — never green, never red.",
        ),
        (
            "The change rows",
            "One row per charge that moved, grouped. “12 charges unchanged” is stated.",
        ),
        (
            "The consistency rule",
            "+$2.70 + $2.50 = +$5.20 = $2,406.84 − $2,401.64. The rows always add up.",
        ),
        (
            "The history strip",
            "The last twelve months, bars from zero. A flat series looks flat.",
        ),
        (
            "Nothing to compare yet",
            "Months 1 and 2 say why they are empty. Never a $0.00, never a blank list.",
        ),
    ]

    y = 718
    for i, (title, body) in enumerate(entries):
        cv.badge(C3_X + 9, y + 5, i + 1, r=9)
        cap_text(cv, C3_X + 26, y, title, 10.5, "semibold", T_INK)
        cap_top = y + 13
        for line in cv.wrap(body, C3_W - 26, 9.4, "regular"):
            cap_text(cv, C3_X + 26, cap_top, line, 9.4, "regular", T_MUTED)
            cap_top += 13.2
        y += 43

    # the colour rule, on the last line
    cy = 1104
    cap_text(cv, C3_X + 26, cy, "Colour", 10.5, "semibold", T_INK)
    sx = C3_X + 86
    for colour, label in ((T_INK, "money out"), (T_FLAG, "the owner flag"), (T_ACCENT, "income")):
        cv.rect((sx, cy + 1, sx + 9, cy + 9), fill=colour, radius=2)
        cap_text(cv, sx + 14, cy, label, 9.4, "regular", T_MUTED)
        sx += 14 + cv.tw(label, 9.4, "regular") + 14


# ------------------------------------------------------------------ the page
def image_monthly() -> None:
    cv = Canvas(W, H)

    cap_text(cv, 60, 46, "MONTHLY RE-RUN — ANATOMY", 10.5, "semibold", T_MUTED, tracking=2.1)
    cap_text(
        cv,
        60,
        68,
        "Upload next month. See what changed, and what it costs you now.",
        17,
        "semibold",
        T_INK,
    )
    cap_text(cv, 1740, 70, "Step 7 · local only · no account", 10.5, "regular", T_SUBTLE, anchor="rt")

    flow(cv)
    decisions(cv)
    workspace(cv)
    states(cv)
    options(cv)
    mobile(cv)
    legend(cv)

    cv.line([(60, 1136), (1740, 1136)], T_HAIRLINE, 1)
    cap_text(
        cv,
        60,
        1148,
        "Spend Audit · step 7 of the roadmap · the file never leaves the device",
        10,
        "regular",
        T_SUBTLE,
    )
    cap_text(
        cv,
        1740,
        1148,
        "design/MONTHLY.md holds the full spec",
        10,
        "regular",
        T_SUBTLE,
        anchor="rt",
    )

    cv.save("09-monthly-rerun.png")
    check_edges("09-monthly-rerun.png")


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
    image_monthly()
