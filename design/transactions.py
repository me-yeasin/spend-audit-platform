"""Render the transaction-list flow and anatomy for approval.

Outputs:
  design/03-transaction-flow.png   - landing -> importing -> parsed workspace
  design/04-transaction-list.png   - annotated panel, mobile, and edge states

Run: python design/transactions.py
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
    CARD_ALT,
    DASHED,
    FLAG,
    FLAG_SOFT,
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

OCT = [
    ("27 Oct 2026", "AMAZON REFUND", 15.49),
    ("24 Oct 2026", "HOME DEPOT #6521", -64.88),
    ("20 Oct 2026", "VERIZON WIRELESS", -85.00),
    ("18 Oct 2026", "CITY POWER & WATER", -111.40),
    ("15 Oct 2026", "PAYROLL DEPOSIT ACME CORP", 4200.00),
    ("14 Oct 2026", "CHATGPT SUBSCRIPTION", -20.00),
    ("12 Oct 2026", "AMAZON WEB SERVICES", -42.30),
]
SEP = [
    ("14 Sep 2026", "PAYROLL DEPOSIT ACME CORP", 4200.00),
    ("12 Sep 2026", "NETFLIX.COM", -15.49),
]


def ellipsize(cv: Canvas, text: str, max_w: float, size: float, weight: str = "regular") -> str:
    if cv.tw(text, size, weight) <= max_w:
        return text
    out = text
    while out and cv.tw(out + "…", size, weight) > max_w:
        out = out[:-1]
    return out.rstrip() + "…"


def arrow(cv: Canvas, x: float, y: float, size: float = 9, color: str = SUBTLE) -> None:
    cv.line([(x - size, y), (x + size * 0.55, y)], color, 1.4)
    cv.line([(x - size * 0.1, y - size * 0.55), (x + size * 0.6, y), (x - size * 0.1, y + size * 0.55)], color, 1.4)


def money(cv: Canvas, x: float, y: float, amount: float, size: float = 12.5, anchor: str = "rt") -> None:
    text = ("+" if amount > 0 else "") + f"${abs(amount):,.2f}"
    color = ACCENT if amount > 0 else INK_SOFT
    cv.text((x, y), text, size, "semibold" if amount > 0 else "regular", color, anchor=anchor)


# ---------------------------------------------------------------- mini pages
def mini_header(cv: Canvas, x: float, y: float, w: float) -> float:
    cv.rect((x, y, x + w, y + 40), fill=CARD)
    cv.line([(x, y + 40), (x + w, y + 40)], BORDER, 1)
    cv.rect((x + 18, y + 13, x + 32, y + 27), fill=ACCENT, radius=4)
    cv.text((x + 25, y + 15.5), "S", 7, "bold", WHITE, anchor="mt")
    cv.text((x + 40, y + 15), "Spend Audit", 8.5, "semibold", INK)
    cv.icon_lock(x + w - 62, y + 20, 5.4, MUTED)
    cv.text((x + w - 54, y + 15), "100% local", 7.5, "regular", MUTED)
    return y + 40


def mini_hero(cv: Canvas, x: float, y: float, w: float) -> float:
    cx = x + w / 2
    cv.d.ellipse([s(cx - 28), s(y + 2), s(cx - 22), s(y + 8)], fill=ACCENT)
    cv.text((cx - 16, y), "MONTHLY SPEND AUDIT", 6.6, "semibold", MUTED, anchor="lt", tracking=1.2)
    y += 16
    for line in ["See what you're quietly", "paying for every month."]:
        cv.text((cx, y), line, 19, "semibold", INK, anchor="mt")
        y += 23
    y += 6
    for line in ["Drop in your bank statement CSV. We surface", "every recurring charge and flag what's unowned."]:
        cv.text((cx, y), line, 8.2, "regular", MUTED, anchor="mt")
        y += 12
    return y


def mini_upload(cv: Canvas, x: float, y: float, w: float, state: str = "idle", progress: float = 0.62) -> float:
    h = 150
    cv.shadow((x, y, x + w, y + h), radius=12, spread=12, alpha=16, offset=4)
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=12)
    inner = (x + 8, y + 8, x + w - 8, y + h - 8)
    cv.rect(inner, fill=CARD_ALT, radius=8)
    cv.dash_round_rect(inner, 8, DASHED, 0.9, 4, 3)
    cx = x + w / 2

    if state == "reading":
        cy = y + 42
        cv.rect((cx - 13, cy - 13, cx + 13, cy + 13), fill=ACCENT_SOFT, radius=7)
        cv.icon_upload(cx, cy, 8.5, ACCENT)
        cv.text((cx, cy + 22), "Reading your statement", 10.5, "semibold", INK, anchor="mt")
        cv.text((cx, cy + 37), "statement-3-months.csv", 7, "regular", MUTED, anchor="mt")
        bar = (cx - 110, cy + 54, cx + 110, cy + 58)
        cv.rect(bar, fill="#ECEBE3", radius=2)
        cv.rect((bar[0], bar[1], bar[0] + 220 * progress, bar[3]), fill=ACCENT, radius=2)
        cv.text((cx - 110, cy + 65), "Parsing on your device", 6.4, "regular", SUBTLE)
        cv.text((cx + 110, cy + 65), f"{int(progress * 100)}%", 6.4, "regular", SUBTLE, anchor="rt")
    else:
        cy = y + 38
        cv.rect((cx - 15, cy - 15, cx + 15, cy + 15), fill=ACCENT_SOFT, radius=8)
        cv.icon_upload(cx, cy, 9, ACCENT)
        cv.text((cx, cy + 22), "Drag & drop your bank statement", 10.5, "semibold", INK, anchor="mt")
        cv.text((cx, cy + 36), "CSV export from any bank · up to 10 MB", 7, "regular", MUTED, anchor="mt")
        cv.rect((cx - 44, cy + 48, cx + 44, cy + 68), fill=INK, radius=5)
        cv.text((cx, cy + 52.5), "Browse files", 7.4, "semibold", WHITE, anchor="mt")

    return y + h


def mini_chip(cv: Canvas, x: float, y: float, w: float, name: str = "statement-3-months.csv") -> float:
    h = 52
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=12)
    cv.rect((x + 10, y + 10, x + 38, y + 42), fill="#F3F2EC", radius=6)
    cv.icon_file(x + 17, y + 17, 11, MUTED)
    cv.text((x + 48, y + 13), name, 8.6, "semibold", INK)
    cv.text((x + 48, y + 27), "2 KB · 62 rows", 7.2, "regular", MUTED)
    cv.d.ellipse([s(x + w - 34), s(y + 17), s(x + w - 18), s(y + 33)], fill=ACCENT)
    cv.icon_check(x + w - 26, y + 25, 4.6, WHITE)
    return y + h


def mini_transactions(cv: Canvas, x: float, y: float, w: float, rows: int = 8) -> float:
    cv.text((x + 14, y), "Transactions", 10.5, "semibold", INK)
    cv.rect((x + 82, y + 1, x + 100, y + 15), fill="#F1F0E9", radius=7)
    cv.text((x + 91, y + 4), "62", 7, "semibold", MUTED, anchor="mt")
    cv.text((x + w - 12, y + 4), "Newest first ↓", 6.8, "regular", SUBTLE, anchor="rt")

    yy = y + 34
    cv.line([(x, yy - 10), (x + w, yy - 10)], BORDER, 1)
    cv.text((x + 14, yy - 22), "DATE", 5.8, "semibold", SUBTLE, tracking=0.8)
    cv.text((x + 92, yy - 22), "DESCRIPTION", 5.8, "semibold", SUBTLE, tracking=0.8)
    cv.text((x + w - 12, yy - 22), "AMOUNT", 5.8, "semibold", SUBTLE, tracking=0.8, anchor="rt")

    data = OCT + SEP
    row_h = 28
    drawn = 0
    divider_after = len(OCT)
    for i, (d, desc, amt) in enumerate(data[:rows]):
        ry = yy + drawn * row_h
        cv.line([(x + 14, ry + row_h - 1), (x + w - 12, ry + row_h - 1)], "#EFEEE7", 0.7)
        cv.text((x + 14, ry + 8), d, 7, "regular", MUTED)
        cv.text((x + 92, ry + 7.5), ellipsize(cv, desc, w - 210, 7.6), 7.6, "regular", INK)
        money(cv, x + w - 12, ry + 6.5, amt, 7.6)
        drawn += 1
        if i + 1 == min(divider_after, rows) and i + 1 < rows:
            dy = yy + drawn * row_h
            cv.rect((x, dy, x + w, dy + 18), fill="#F7F6F0", radius=0)
            cv.text((x + 14, dy + 5), "SEPTEMBER 2026", 5.8, "semibold", MUTED, tracking=1)
            cv.text((x + w - 12, dy + 5), "21 transactions", 5.8, "regular", SUBTLE, anchor="rt")
            drawn += 0.64

    footer_y = yy + drawn * row_h + 10
    cv.line([(x, footer_y), (x + w, footer_y)], BORDER, 1)
    cv.text((x + 14, footer_y + 8), "62 transactions · 1 Aug – 27 Oct 2026", 6.4, "regular", SUBTLE)
    return footer_y + 26


def flow_frame(cv: Canvas, x: float, y: float, w: float, h: float, variant: str) -> None:
    cv.shadow((x, y, x + w, y + h), radius=14, spread=18, alpha=18, offset=6)
    cv.rect((x, y, x + w, y + h), fill=PAGE, outline=BORDER, width=1, radius=14)
    cv.rect((x, y, x + w, y + 22), fill="#E8E6DF", radius=14)
    cv.rect((x, y + 12, x + w, y + 22), fill="#E8E6DF", radius=0)
    for i in range(3):
        cv.d.ellipse([s(x + 12 + i * 9), s(y + 7), s(x + 18 + i * 9), s(y + 13)], fill="#D3D1C8")
    cv.rect((x + 52, y + 5, x + 150, y + 17), fill="#F5F4EF", radius=6)
    cv.text((x + 58, y + 7), "localhost:4000", 6.2, "regular", SUBTLE)

    inner_y = mini_header(cv, x, y + 22, w)
    px = x + 22
    pw = w - 44

    if variant == "landing":
        inner_y = mini_hero(cv, px, inner_y + 22, pw) + 18
        inner_y = mini_upload(cv, px + 18, inner_y, pw - 36) + 14
        cv.icon_lock(x + w / 2 - 55, inner_y + 2, 4.6, ACCENT)
        cv.text((x + w / 2 - 47, inner_y - 1), "Your file stays on this device", 6.2, "regular", MUTED)
        inner_y += 20
        sw = (pw - 12) / 3
        for i in range(3):
            sx = px + i * (sw + 6)
            cv.rect((sx, inner_y, sx + sw, inner_y + 40), fill=CARD, outline=BORDER, width=0.8, radius=6)
            cv.text((sx + 8, inner_y + 7), str(i + 1), 5.6, "bold", ACCENT)
            cv.text((sx + 15, inner_y + 6.5), ["Import the CSV", "See the total", "Assign owners"][i], 6.2, "semibold", INK)
            cv.text((sx + 8, inner_y + 20), ["Drop the export.", "One clear number.", "Flag what's unowned."][i], 5.2, "regular", MUTED)
        inner_y += 56
        cv.text((px, inner_y), "What you'll see after import", 6.8, "semibold", INK_SOFT)
        cv.text((px + pw, inner_y), "Example data", 5.8, "regular", SUBTLE, anchor="rt")
        inner_y += 12
        cv.rect((px, inner_y, px + pw, inner_y + 74), fill=CARD, outline=BORDER, width=0.8, radius=8)
        cv.text((px + 12, inner_y + 12), "TOTAL MONTHLY RECURRING", 5, "semibold", MUTED, tracking=0.6)
        cv.text((px + 12, inner_y + 22), "$248.60", 15, "semibold", INK)
        cv.text((px + 12, inner_y + 43), "across 9 recurring charges", 5.8, "regular", MUTED)
        cv.line([(px + pw / 2, inner_y + 10), (px + pw / 2, inner_y + 64)], BORDER, 0.8)
        cv.text((px + pw / 2 + 12, inner_y + 12), "NEEDS AN OWNER", 5, "semibold", FLAG, tracking=0.6)
        for i in range(3):
            cv.d.ellipse([s(px + pw / 2 + 12), s(inner_y + 26 + i * 13), s(px + pw / 2 + 16), s(inner_y + 30 + i * 13)], fill=FLAG)
            cv.text((px + pw / 2 + 21, inner_y + 24 + i * 13), ["Adobe Creative Cloud", "Notion Plus", "Figma Professional"][i], 5.6, "regular", INK)

    elif variant == "importing":
        inner_y = mini_hero(cv, px, inner_y + 22, pw) + 18
        inner_y = mini_upload(cv, px + 18, inner_y, pw - 36, state="reading", progress=0.62) + 14
        cv.text((x + w / 2, inner_y), "Everything below waits — nothing to read yet", 6.2, "regular", SUBTLE, anchor="mt")
        inner_y += 24
        for bh in (46, 46, 46):
            gx = px + 8
            cv.rect((gx, inner_y, gx + pw - 16, inner_y + bh), fill="#F4F3ED", radius=6)
            cv.text((gx + 10, inner_y + 8), "···", 7, "regular", "#C9C7BC")
            inner_y += bh + 8

    else:  # workspace
        chip_y = inner_y + 14
        inner_y = mini_chip(cv, px, chip_y, pw) + 12
        panel_y = inner_y
        cv.shadow((px, panel_y, px + pw, panel_y + 352), radius=10, spread=12, alpha=14, offset=4)
        cv.rect((px, panel_y, px + pw, panel_y + 352), fill=CARD, outline=BORDER, width=1, radius=10)
        mini_transactions(cv, px + 1, panel_y + 12, pw - 2, rows=8)


def caption(cv: Canvas, x: float, y: float, step: str, title: str, lines: list[str]) -> None:
    cv.text((x, y), step.upper(), 9.5, "semibold", SUBTLE, tracking=1.6)
    cv.text((x, y + 14), title, 13, "semibold", INK)
    yy = y + 34
    for line in lines:
        cv.text((x, yy), line, 10.5, "regular", MUTED)
        yy += 15


# ---------------------------------------------------------------- image 1
def image_flow():
    W, H = 1720, 980
    cv = Canvas(W, H)

    cv.text((60, 52), "TRANSACTION LIST — FLOW", 10.5, "semibold", MUTED, tracking=2.2)
    cv.text((60, 74), "What happens after a file lands: the page stops selling and starts showing.", 17, "semibold", INK)

    fw, fh = 480, 560
    y = 140

    labels = [
        (60, "Step 1", "Landing", "Hero, upload card, steps and the example preview. Nothing parsed yet."),
        (620, "Step 2", "Dropping the file", "Card enters its reading state. The list area waits underneath."),
        (1180, "Step 3", "Parsed workspace", "Hero collapses, the file becomes a chip, transactions take the stage."),
    ]
    for x, step, title, note in labels:
        flow_frame(cv, x, y, fw, fh, ["landing", "importing", "workspace"][labels.index((x, step, title, note))])
        caption(cv, x + 2, y + fh + 20, step, title, [note])

    for ax in (560, 1120):
        arrow(cv, ax, y + fh / 2, 9, SUBTLE)

    fy = 860
    cv.line([(60, fy), (1660, fy)], BORDER, 1)
    notes = [
        ("No new route", "The list lives on the same page, below the upload card — nothing to navigate to."),
        ("Newest first", "Month groups descend; rows inside a group descend by day."),
        ("Long lists scroll", "The column header stays pinned; the panel footer always shows the range."),
    ]
    nx = 60
    for head, body in notes:
        cv.text((nx, fy + 20), head, 11.5, "semibold", INK)
        cv.text((nx, fy + 38), body, 10.2, "regular", MUTED)
        nx += 545

    cv.save("03-transaction-flow.png")


# ---------------------------------------------------------------- image 2
def desktop_panel(cv: Canvas, x: float, y: float, w: float) -> float:
    """Annotated desktop panel. Returns its bottom edge."""
    header = 84
    col_row = 12
    row_h = 40
    divider_h = 24
    footer = 44
    start_y = y + header + col_row
    h = header + col_row + len(OCT) * row_h + divider_h + len(SEP) * row_h + footer

    cv.shadow((x, y, x + w, y + h), radius=18, spread=20, alpha=18, offset=7)
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=18)

    # header
    cv.text((x + 24, y + 24), "Transactions", 15, "semibold", INK)
    cv.rect((x + 132, y + 25, x + 160, y + 44), fill="#F1F0E9", radius=9)
    cv.text((x + 146, y + 29), "62", 8.6, "semibold", MUTED, anchor="mt")
    cv.text((x + w - 24, y + 29), "Newest first ↓", 9.5, "regular", SUBTLE, anchor="rt")

    # column row
    ch = y + header
    cv.text((x + 24, ch), "DATE", 8.5, "semibold", SUBTLE, tracking=1.2)
    cv.text((x + 164, ch), "DESCRIPTION", 8.5, "semibold", SUBTLE, tracking=1.2)
    cv.text((x + w - 24, ch), "AMOUNT", 8.5, "semibold", SUBTLE, tracking=1.2, anchor="rt")
    cv.line([(x + 24, ch + col_row), (x + w - 24, ch + col_row)], BORDER, 1)

    ry = start_y
    for i, (date, desc, amt) in enumerate(OCT):
        cv.line([(x + 24, ry + row_h - 1), (x + w - 24, ry + row_h - 1)], "#EFEEE7", 1)
        cv.text((x + 24, ry + 13), date, 10.5, "regular", MUTED)
        cv.text((x + 164, ry + 11.5), desc, 11.5, "regular", INK)
        money(cv, x + w - 24, ry + 11, amt, 11.5)
        ry += row_h

    # month divider
    div_y = ry
    cv.rect((x + 1, div_y, x + w - 1, div_y + divider_h), fill="#F7F6F0", radius=0)
    cv.text((x + 24, div_y + 7), "SEPTEMBER 2026", 8.5, "semibold", MUTED, tracking=1.2)
    cv.text((x + w - 24, div_y + 7), "21 transactions", 8.5, "regular", SUBTLE, anchor="rt")
    ry += divider_h

    for date, desc, amt in SEP:
        cv.line([(x + 24, ry + row_h - 1), (x + w - 24, ry + row_h - 1)], "#EFEEE7", 1)
        cv.text((x + 24, ry + 13), date, 10.5, "regular", MUTED)
        cv.text((x + 164, ry + 11.5), desc, 11.5, "regular", INK)
        money(cv, x + w - 24, ry + 11, amt, 11.5)
        ry += row_h

    # footer
    fy = y + h - footer
    cv.line([(x + 24, fy), (x + w - 24, fy)], BORDER, 1)
    cv.text((x + 24, fy + 14), "62 transactions · 1 Aug – 27 Oct 2026", 9.5, "regular", SUBTLE)
    cv.text((x + w - 24, fy + 14), "Showing all", 9.5, "regular", SUBTLE, anchor="rt")

    # numbered callouts, outside the panel so nothing is covered
    cv.badge(x - 20, y + 24, 1, r=9)
    cv.badge(x - 20, ch + 4, 2, r=9)
    cv.badge(x + w + 18, start_y + 18, 3, r=9)
    cv.badge(x - 20, div_y + 12, 4, r=9)
    cv.badge(x - 20, start_y + row_h * 2 + 18, 5, r=9)
    cv.badge(x + w + 18, fy + 16, 6, r=9)

    return y + h


def mobile_panel(cv: Canvas, x: float, y: float) -> float:
    w = 330
    row_h = 62
    head = 46
    h = head + 5 * row_h + 44
    cv.shadow((x, y, x + w, y + h), radius=18, spread=16, alpha=16, offset=6)
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=18)

    cv.text((x + 18, y + 18), "Transactions", 13, "semibold", INK)
    cv.rect((x + 114, y + 19, x + 136, y + 35), fill="#F1F0E9", radius=8)
    cv.text((x + 125, y + 22.5), "62", 7.6, "semibold", MUTED, anchor="mt")
    cv.text((x + w - 18, y + 22), "Newest ↓", 8, "regular", SUBTLE, anchor="rt")
    cv.line([(x + 18, y + head), (x + w - 18, y + head)], BORDER, 1)

    ry = y + head
    for date, desc, amt in OCT[:5]:
        cv.line([(x + 18, ry + row_h), (x + w - 18, ry + row_h)], "#EFEEE7", 1)
        cv.text((x + 18, ry + 12), ellipsize(cv, desc, w - 140, 10.5, "semibold"), 10.5, "semibold", INK)
        cv.text((x + 18, ry + 32), date, 8.6, "regular", MUTED)
        money(cv, x + w - 18, ry + 16, amt, 10.5)
        ry += row_h

    cv.line([(x + 18, ry + 8), (x + w - 18, ry + 8)], BORDER, 1)
    cv.text((x + 18, ry + 20), "62 transactions", 8.6, "regular", SUBTLE)
    cv.text((x + w - 18, ry + 20), "Showing all", 8.6, "regular", SUBTLE, anchor="rt")
    return y + h


def state_panel(cv: Canvas, x: float, y: float, w: float, kind: str) -> float:
    h = 210
    cv.rect((x, y, x + w, y + h), fill=CARD, outline=BORDER, width=1, radius=14)
    cv.text((x + 18, y + 16), "Transactions", 12.5, "semibold", INK)
    cv.text((x + w - 18, y + 20), "62", 8, "regular", SUBTLE, anchor="rt")
    cv.line([(x + 18, y + 40), (x + w - 18, y + 40)], BORDER, 1)

    if kind == "loading":
        for i in range(4):
            ry = y + 54 + i * 30
            cv.rect((x + 18, ry, x + 104, ry + 8), fill="#EFEEE7", radius=4)
            cv.rect((x + 118, ry, x + w - 90, ry + 8), fill="#EFEEE7", radius=4)
            cv.rect((x + w - 74, ry, x + w - 18, ry + 8), fill="#EFEEE7", radius=4)
        cv.text((x + 18, y + h - 26), "Skeleton while the CSV is parsed", 8.6, "regular", SUBTLE)

    elif kind == "empty":
        cx = x + w / 2
        cv.rect((cx - 17, y + 66, cx + 17, y + 100), fill="#F4F3ED", radius=9)
        cv.icon_file(cx - 7, y + 74, 14, SUBTLE)
        cv.text((cx, y + 112), "No transactions found", 11.5, "semibold", INK, anchor="mt")
        cv.text((cx, y + 130), "This file has no rows we recognise.", 8.6, "regular", MUTED, anchor="mt")
        cv.text((cx, y + 145), "It needs Date, Description and Amount.", 8.6, "regular", MUTED, anchor="mt")

    else:
        cx = x + w / 2
        cv.rect((cx - 17, y + 62, cx + 17, y + 96), fill=FLAG_SOFT, radius=9)
        cv.text((cx, y + 70), "!", 12, "bold", FLAG, anchor="mt")
        cv.text((cx, y + 108), "Couldn't read this statement", 11.5, "semibold", INK, anchor="mt")
        cv.text((cx, y + 126), "Columns must be Date, Description, Amount.", 8.6, "regular", MUTED, anchor="mt")
        cv.text((cx, y + 141), "Try exporting the CSV again.", 8.6, "regular", MUTED, anchor="mt")
        cv.text((cx, y + 162), "Choose another file", 9, "semibold", FLAG, anchor="mt")

    return y + h


def image_anatomy():
    W, H = 1720, 1260
    cv = Canvas(W, H)

    cv.text((60, 52), "TRANSACTION LIST — ANATOMY", 10.5, "semibold", MUTED, tracking=2.2)
    cv.text((60, 74), "One panel, month groups, three edge cases.", 17, "semibold", INK)

    # desktop panel
    px, py, pw2 = 84, 150, 900
    bottom = desktop_panel(cv, px, py, pw2)

    # mobile panel + caption
    mx, my = 1060, 150
    mh = mobile_panel(cv, mx, my)
    cv.text((mx, mh + 22), "MOBILE", 9.5, "semibold", MUTED, tracking=1.8)
    cv.text((mx, mh + 42), "Rows become two lines: description on top,", 9.8, "regular", MUTED)
    cv.text((mx, mh + 56), "date left and amount right beneath it.", 9.8, "regular", MUTED)
    cv.text((mx, mh + 70), "Panel sits edge-to-edge inside 20 px gutter.", 9.8, "regular", MUTED)

    # legend
    lx, ly = 1060, 640
    cv.text((lx, ly), "DESKTOP PANEL", 9.5, "semibold", MUTED, tracking=1.8)
    ly += 26
    entries = [
        (1, "Panel", "900 px max, radius 20, hairline border, soft shadow."),
        (2, "Header + column row", "“Transactions”, count pill and sort label. The column row pins\nwhile the list scrolls."),
        (3, "Amount column", "Right aligned, tabular figures. Income is emerald and signed +;\nspend is ink and signed −."),
        (4, "Month group", "Tinted strip: month name plus that month's transaction count.\nNewest month first."),
        (5, "Row", "40 px tall in the mock; 44 px in the build. Date muted,\ndescription truncates, amount right."),
        (6, "Footer", "Total count and covered date range confirm nothing was hidden."),
    ]
    for n, title, body in entries:
        cv.badge(lx + 8, ly + 4, n, r=8.5)
        cv.text((lx + 24, ly - 2), title, 11.5, "semibold", INK)
        ly += 15
        ly = cv.paragraph((lx + 24, ly), body, 500, 9.8, "regular", MUTED, 1.45) + 12

    # edge states
    sy = 980
    cv.text((60, sy - 34), "EDGE STATES", 9.5, "semibold", MUTED, tracking=1.8)
    specs = [
        (60, "loading", "Loading", "Shown while a large CSV is parsed."),
        (416, "empty", "No rows", "Valid CSV, but no transactions found."),
        (772, "error", "Unreadable", "Missing or unexpected columns."),
    ]
    for sx, kind, title, note in specs:
        state_panel(cv, sx, sy, 330, kind)
        cv.text((sx + 2, sy + 224), title, 11, "semibold", INK)
        cv.text((sx + 2, sy + 240), note, 9.5, "regular", MUTED)

    cv.save("04-transaction-list.png")


if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    image_flow()
    image_anatomy()
