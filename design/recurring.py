"""Render the recurring-charges design for approval.

Outputs:
  design/05-recurring-charges.png  - where the panel sits, row anatomy, expanded group, mobile
  design/06-recurring-rules.png    - the detection rules and the calibration evidence

Run: python design/recurring.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from render import (  # noqa: E402
    ACCENT,
    ACCENT_SOFT,
    BORDER,
    CARD,
    FLAG,
    INK,
    INK_SOFT,
    MUTED,
    PAGE,
    SUBTLE,
    WHITE,
    Canvas,
    s,
)

HERE = os.path.dirname(os.path.abspath(__file__))

# The 14 charges the detector finds in the 12-month fixture, largest first.
CHARGES = [
    ("City Apartments Rent", "Rent", 1850.00, 12, False),
    ("Geico Auto Insurance", "Insurance", 128.50, 12, False),
    ("City Power & Water", "Utilities", 126.10, 12, True),
    ("Verizon Wireless", "Phone", 85.00, 12, False),
    ("Adobe Creative Cloud", "Software", 59.99, 12, False),
    ("Amazon Web Services", "Cloud hosting", 42.30, 12, False),
    ("Planet Fitness", "Gym", 24.99, 12, False),
    ("ChatGPT Subscription", "Software", 20.00, 12, False),
    ("Notion Labs", "Software", 19.00, 12, False),
    ("Netflix.com", "Streaming", 15.49, 12, False),
    ("Figma Professional", "Software", 15.00, 12, False),
    ("Spotify AB", "Streaming", 11.99, 12, False),
    ("Google One", "Storage", 2.99, 12, False),
    ("Apple iCloud+", "Storage", 2.99, 12, False),
]

PAYMENTS = [
    ("27 Oct 2026", -15.49),
    ("27 Sep 2026", -15.49),
    ("27 Aug 2026", -15.49),
    ("27 Jul 2026", -15.49),
    ("27 Jun 2026", -15.49),
    ("27 May 2026", -15.49),
]


def money(amount: float, sign: bool = False) -> str:
    text = f"${abs(amount):,.2f}"
    return f"-{text}" if sign and amount < 0 else text


def chevron(cv: Canvas, x: float, y: float, size: float = 4.5, color: str = SUBTLE, down: bool = False) -> None:
    if down:
        cv.line([(x - size, y - size * 0.5), (x, y + size * 0.5), (x + size, y - size * 0.5)], color, 1.4)
    else:
        cv.line([(x - size * 0.5, y - size), (x + size * 0.5, y), (x - size * 0.5, y + size)], color, 1.4)


# ---------------------------------------------------------------- the panel
ROW_H = 64


def panel_header(cv: Canvas, x: float, y: float, w: float) -> float:
    cv.text((x + 24, y), "Recurring charges", 15, "semibold", INK)
    cv.rect((x + 168, y + 1, x + 196, y + 20), fill="#f1f0e9", radius=9)
    cv.text((x + 182, y + 5), "14", 8.6, "semibold", MUTED, anchor="mt")
    cv.text((x + w - 24, y + 5), "Largest first", 9.5, "regular", SUBTLE, anchor="rt")
    return y + 30


def group_row(
    cv: Canvas,
    x: float,
    y: float,
    w: float,
    name: str,
    category: str,
    amount: float,
    payments: int,
    varies: bool,
    *,
    expanded: bool = False,
    badge: int | None = None,
) -> float:
    cv.text((x + 24, y + 13), name, 13.5, "semibold", INK)

    total = amount * payments
    meta = f"{payments} payments · {money(total)} total"
    if varies:
        meta = f"{payments} payments · {money(total)} total · amount varies"
    cv.text((x + 24, y + 34), meta, 11.5, "regular", MUTED)

    # cadence chip
    chip_w = cv.tw("Monthly", 10, "semibold") + 20
    cv.rect((x + 300, y + 14, x + 300 + chip_w, y + 32), fill="#f1f0e9", radius=9)
    cv.text((x + 300 + chip_w / 2, y + 17.5), "Monthly", 10, "semibold", MUTED, anchor="mt")

    if category:
        cv.text((x + 300 + chip_w + 10, y + 17.5), category, 10.5, "regular", SUBTLE)

    # amount, right aligned before the chevron
    cv.text((x + w - 52, y + 13), money(amount), 13.5, "semibold", INK, anchor="rt")
    cv.text((x + w - 52, y + 34), "per month", 10.5, "regular", SUBTLE, anchor="rt")

    cv.text((x + w - 26, y + 26), "", 1, "regular", SUBTLE)
    chevron(cv, x + w - 26, y + 26, 4.5, SUBTLE, down=expanded)

    if badge is not None:
        cv.badge(x - 20, y + ROW_H / 2, badge, r=9)

    return y + ROW_H


def recurring_panel(cv: Canvas, x: float, y: float, w: float, rows: int = 8, footer: bool = True) -> float:
    body_h = 30 + rows * ROW_H + (44 if footer else 0)
    cv.shadow((x, y, x + w, y + 46 + body_h), radius=18, spread=18, alpha=16, offset=6)
    cv.rect((x, y, x + w, y + 46 + body_h), fill=CARD, outline=BORDER, width=1, radius=18)

    cv.text((x + 24, y + 24), "Recurring charges", 15, "semibold", INK)
    cv.rect((x + 168, y + 25, x + 196, y + 44), fill="#f1f0e9", radius=9)
    cv.text((x + 182, y + 29), "14", 8.6, "semibold", MUTED, anchor="mt")
    cv.text((x + w - 24, y + 29), "Largest first", 9.5, "regular", SUBTLE, anchor="rt")

    cv.line([(x, y + 58), (x + w, y + 58)], BORDER, 1)

    ry = y + 58
    for index in range(rows):
        name, category, amount, payments, varies = CHARGES[index]
        cv.line([(x + 24, ry + ROW_H - 1), (x + w - 24, ry + ROW_H - 1)], "#efeee7", 1)
        group_row(cv, x, ry, w, name, category, amount, payments, varies)
        ry += ROW_H

    if footer:
        ry += 12
        cv.text((x + 24, ry), "More than 8 rows scroll inside the page.", 10.5, "regular", SUBTLE)

    return y + 46 + body_h


def expanded_group(cv: Canvas, x: float, y: float, w: float) -> float:
    h = 46 + ROW_H + 6 * 26 + 20
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=16)
    cv.text((x + 20, y + 16), "Netflix.com", 13, "semibold", INK)
    cv.text((x + w - 20, y + 16), "$15.49 / mo", 12, "semibold", INK, anchor="rt")
    cv.line([(x + 20, y + 42), (x + w - 20, y + 42)], BORDER, 1)

    ry = y + 54
    cv.text((x + 20, ry), "PAYMENTS", 8.5, "semibold", SUBTLE, tracking=1.1)
    ry += 16
    for date, amount in PAYMENTS:
        cv.text((x + 20, ry), date, 10.5, "regular", MUTED)
        cv.text((x + w - 20, ry), money(amount, sign=True), 10.5, "regular", INK_SOFT, anchor="rt")
        ry += 26

    return y + h


def mobile_panel(cv: Canvas, x: float, y: float, w: float = 330) -> float:
    rows = 5
    h = 44 + rows * 74 + 16
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=16)
    cv.text((x + 18, y + 14), "Recurring charges", 13, "semibold", INK)
    cv.rect((x + 146, y + 15, x + 168, y + 31), fill="#f1f0e9", radius=8)
    cv.text((x + 157, y + 18.5), "14", 7.6, "semibold", MUTED, anchor="mt")
    cv.line([(x + 18, y + 40), (x + w - 18, y + 40)], BORDER, 1)

    ry = y + 44
    for index in range(rows):
        name, _category, amount, payments, varies = CHARGES[index]
        cv.line([(x + 18, ry + 73), (x + w - 18, ry + 73)], "#efeee7", 1)
        cv.text((x + 18, ry + 10), name, 12.5, "semibold", INK)
        cv.text((x + w - 18, ry + 10), money(amount), 12.5, "semibold", INK, anchor="rt")
        meta = f"Monthly · {payments} payments"
        if varies:
            meta = f"Monthly · varies · {payments} payments"
        cv.text((x + 18, ry + 30), meta, 10, "regular", MUTED)
        chevron(cv, x + w - 24, ry + 40, 4, SUBTLE)
        ry += 74

    return y + h


# ---------------------------------------------------------------- image 1
def image_layout():
    W, H = 1800, 1180
    cv = Canvas(W, H)

    cv.text((60, 52), "RECURRING CHARGES — LAYOUT", 10.5, "semibold", MUTED, tracking=2.2)
    cv.text((60, 74), "The grouped view sits above the transaction list, so repeats read as categories.", 17, "semibold", INK)

    # page frame
    px, py, pw = 60, 140, 940
    cv.rect((px, py, px + pw, py + 838), fill=PAGE, outline=BORDER, width=1, radius=18)

    # file chip
    chip_y = py + 24
    cv.rect((px + 24, chip_y, px + pw - 24, chip_y + 52), fill=CARD, outline=BORDER, width=1, radius=12)
    cv.rect((px + 34, chip_y + 10, px + 62, chip_y + 42), fill="#f3f2ec", radius=6)
    cv.text((px + 72, chip_y + 13), "statement-12-months.csv", 11.5, "semibold", INK)
    cv.text((px + 72, chip_y + 29), "9 KB · 250 rows", 10, "regular", MUTED)
    cv.d.ellipse([s(px + pw - 58), s(chip_y + 17), s(px + pw - 42), s(chip_y + 33)], fill=ACCENT)
    cv.icon_check(px + pw - 50, chip_y + 25, 4.6, WHITE)

    # recurring panel
    cv.badge(px - 20, chip_y + 100, 1, r=9)
    panel_y = chip_y + 74
    end = recurring_panel(cv, px + 24, panel_y, pw - 48, rows=8, footer=True)

    # transactions stub below
    stub_y = end + 32
    cv.rect((px + 24, stub_y, px + pw - 24, stub_y + 58), fill=CARD, outline=BORDER, width=1, radius=14)
    cv.text((px + 48, stub_y + 18), "Transactions", 13, "semibold", INK)
    cv.rect((px + 126, stub_y + 19, px + 152, stub_y + 36), fill="#f1f0e9", radius=8)
    cv.text((px + 139, stub_y + 22.5), "250", 8, "semibold", MUTED, anchor="mt")
    cv.text((px + pw - 48, stub_y + 20), "unchanged — every raw row is still here", 10, "regular", SUBTLE, anchor="rt")
    cv.badge(px - 20, stub_y + 29, 2, r=9)

    # legend
    lx, ly = 1050, 140
    cv.text((lx, ly), "ANATOMY", 9.5, "semibold", MUTED, tracking=1.8)
    ly += 26
    entries = [
        (1, "Recurring charges panel", "Sits directly under the file chip and above the\ntransaction list. One row per recurring charge."),
        (2, "Transaction list stays whole", "Every raw row is still listed below, so nothing\nappears to vanish. The panel is the grouped view."),
        (3, "Merchant name", "Cleaned for reading: store numbers, city and\nstate tails and punctuation are stripped."),
        (4, "Evidence line", "How many times it was charged and the total\npaid across the whole statement."),
        (5, "Cadence chip", "Monthly for now. “amount varies” appears when\nthe charge drifts, like a utility bill."),
        (6, "Monthly amount", "The typical charge, from the median of its\npayments — so one odd month cannot skew it."),
    ]
    for n, title, body in entries:
        cv.badge(lx + 8, ly + 4, n, r=8.5)
        cv.text((lx + 24, ly - 2), title, 11.5, "semibold", INK)
        ly += 15
        ly = cv.paragraph((lx + 24, ly), body, 560, 9.8, "regular", MUTED, 1.45) + 12

    # expanded group + mobile
    eg_y = 700
    cv.text((lx, eg_y - 34), "EXPANDED GROUP", 9.5, "semibold", MUTED, tracking=1.8)
    expanded_group(cv, lx, eg_y, 360)

    cv.text((lx + 400, eg_y - 34), "MOBILE", 9.5, "semibold", MUTED, tracking=1.8)
    mobile_panel(cv, lx + 400, eg_y, 300)

    cv.save("05-recurring-charges.png")


# ---------------------------------------------------------------- image 2
RULES = [
    ("Money out", "Only spending counts. Salary and refunds never enter the list."),
    ("Three payments minimum", "Two is not enough history to call something recurring."),
    ("Monthly cadence", "Payments land 25–35 days apart, and at least four in five gaps\nsit in that band."),
    ("Gentle drift only", "Each payment may differ from the one before by at most 4%.\nThis keeps a rising utility bill and rejects shopping swings."),
    ("Present the whole time", "It appears in at least 90% of the months between its first and\nlast payment — so a habit with gaps is not recurring."),
]

EVIDENCE = [
    ("Charge", "Payments", "Largest step", "Verdict"),
    ("Netflix.com", "12", "0%", "recurring"),
    ("City Power & Water", "12", "3%", "recurring"),
    ("Sweetgreen", "10", "10%", "rejected"),
    ("Uber Trip", "10", "11%", "rejected"),
    ("Starbucks Store", "10", "34%", "rejected"),
    ("Amazon Marketplace", "10", "6%", "rejected"),
    ("Cvs Pharmacy", "9", "16%", "rejected"),
]


def image_rules():
    W, H = 1720, 900
    cv = Canvas(W, H)

    cv.text((60, 52), "RECURRING CHARGES — HOW A CHARGE QUALIFIES", 10.5, "semibold", MUTED, tracking=2.2)
    cv.text((60, 74), "Five rules, each one earning its place against the fixtures.", 17, "semibold", INK)

    # rules column
    x, y = 60, 140
    cv.rect((x, y, x + 780, y + 700), fill=CARD, outline=BORDER, width=1, radius=18)
    cv.text((x + 28, y + 26), "The rules", 13.5, "semibold", INK)
    cv.text((x + 28, y + 48), "A charge must pass every one of them.", 11, "regular", MUTED)
    ry = y + 86
    for index, (title, body) in enumerate(RULES):
        cv.d.ellipse([s(x + 28), s(ry + 3), s(x + 40), s(ry + 15)], fill=ACCENT_SOFT)
        cv.icon_check(x + 34, ry + 9, 4.2, ACCENT)
        cv.text((x + 54, ry - 2), title, 12.5, "semibold", INK)
        ry += 18
        ry = cv.paragraph((x + 54, ry), body, 680, 10.2, "regular", MUTED, 1.5) + 22

    # evidence table
    tx, ty = 900, 140
    cv.rect((tx, ty, tx + 760, ty + 700), fill=CARD, outline=BORDER, width=1, radius=18)
    cv.text((tx + 28, ty + 26), "Calibration against the fixtures", 13.5, "semibold", INK)
    cv.text(
        (tx + 28, ty + 48),
        "The fixtures know which charges are real. The rules must find all of them and no others.",
        10.5,
        "regular",
        MUTED,
    )

    col = [tx + 28, tx + 340, tx + 520, tx + 640]
    ry = ty + 92
    for index, (a, b, c, d) in enumerate(EVIDENCE):
        if index == 0:
            for pos, label in zip(col, (a, b, c, d)):
                cv.text((pos, ry), label.upper(), 8.5, "semibold", SUBTLE, tracking=1.1)
            ry += 20
            cv.line([(tx + 28, ry), (tx + 732, ry)], BORDER, 1)
            ry += 12
            continue
        truth = d == "recurring"
        cv.text((col[0], ry), a, 11.5, "regular", INK)
        cv.text((col[1], ry), b, 11.5, "regular", MUTED)
        cv.text((col[2], ry), c, 11.5, "regular", MUTED)
        cv.text((col[3], ry), "recurring" if truth else "rejected", 11.5, "semibold", ACCENT if truth else FLAG)
        ry += 28

    ry += 8
    cv.line([(tx + 28, ry), (tx + 732, ry)], BORDER, 1)
    ry += 22
    cv.text((tx + 28, ry), "Result", 12, "semibold", INK)
    cv.text((tx + 28, ry + 22), "3-month statement", 11, "regular", MUTED)
    cv.text((tx + 300, ry + 22), "14 of 14 found · 0 false positives", 11, "semibold", ACCENT)
    cv.text((tx + 28, ry + 44), "12-month statement", 11, "regular", MUTED)
    cv.text((tx + 300, ry + 44), "14 of 14 found · 0 false positives", 11, "semibold", ACCENT)

    ry += 84
    cv.text((tx + 28, ry), "What it will not do yet", 12, "semibold", INK)
    ry = cv.paragraph(
        (tx + 28, ry + 20),
        "No grand total on this screen — that single number is step 5 of the plan and takes the top of "
        "the page. No owner flags yet either; those attach to these groups in step 4.",
        700,
        10.2,
        "regular",
        MUTED,
        1.5,
    )

    cv.save("06-recurring-rules.png")


if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    image_layout()
    image_rules()
