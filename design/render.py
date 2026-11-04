"""Render approval diagrams for the Spend Audit homepage.

Outputs:
  design/01-homepage-layout.png  - annotated desktop layout + specs legend
  design/02-upload-states.png    - the four upload states side by side

Run: python design/render.py
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 2  # supersampling factor
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- palette
CANVAS = "#E9E7E0"
PAGE = "#FBFBF8"
CARD = "#FFFFFF"
CARD_ALT = "#FAFAF6"
INK = "#12120F"
INK_SOFT = "#3A3A34"
MUTED = "#6E6E66"
SUBTLE = "#9C9C92"
BORDER = "#E4E2DA"
DASHED = "#CFCDC2"
ACCENT = "#0E7C5A"
ACCENT_SOFT = "#E9F4EE"
ACCENT_LINE = "#BCDACC"
FLAG = "#B4392B"
FLAG_SOFT = "#FBEDEA"
FLAG_LINE = "#EBC9C3"
WHITE = "#FFFFFF"
ANNO = "#2A2A26"

FONT_FILES = {
    "regular": r"C:\Windows\Fonts\segoeui.ttf",
    "semibold": r"C:\Windows\Fonts\seguisb.ttf",
    "bold": r"C:\Windows\Fonts\segoeuib.ttf",
}

_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(weight: str, size: float) -> ImageFont.FreeTypeFont:
    px = max(1, int(round(size * SS)))
    key = (weight, px)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_FILES[weight], px)
    return _font_cache[key]


def s(v: float) -> int:
    return int(round(v * SS))


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w, self.h = w, h
        self.img = Image.new("RGB", (w * SS, h * SS), CANVAS)
        self.d = ImageDraw.Draw(self.img)

    # -- primitives -------------------------------------------------
    def rect(self, box, fill=None, outline=None, width=1.0, radius=0.0):
        x0, y0, x1, y1 = box
        if radius:
            self.d.rounded_rectangle(
                [s(x0), s(y0), s(x1), s(y1)],
                radius=s(radius),
                fill=fill,
                outline=outline,
                width=max(1, s(width)),
            )
        else:
            self.d.rectangle(
                [s(x0), s(y0), s(x1), s(y1)],
                fill=fill,
                outline=outline,
                width=max(1, s(width)),
            )

    def shadow(self, box, radius=16, spread=18, alpha=26, offset=6):
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        x0, y0, x1, y1 = box
        ld.rounded_rectangle(
            [s(x0 - spread / 3), s(y0 + offset), s(x1 + spread / 3), s(y1 + offset)],
            radius=s(radius),
            fill=(20, 20, 15, alpha),
        )
        layer = layer.filter(ImageFilter.GaussianBlur(s(spread / 2)))
        self.img = Image.alpha_composite(self.img.convert("RGBA"), layer).convert("RGB")
        self.d = ImageDraw.Draw(self.img)

    def text(self, xy, txt, size=13, weight="regular", fill=INK, anchor="lt", tracking=0):
        f = font(weight, size)
        x, y = s(xy[0]), s(xy[1])
        if tracking:
            total = sum(self.d.textlength(ch, font=f) for ch in txt) + s(tracking) * max(0, len(txt) - 1)
            if anchor[0] == "m":
                x -= total / 2
            elif anchor[0] == "r":
                x -= total
            cx = x
            for ch in txt:
                self.d.text((cx, y), ch, font=f, fill=fill)
                cx += self.d.textlength(ch, font=f) + s(tracking)
            return
        self.d.text((x, y), txt, font=f, fill=fill, anchor=anchor)

    def tw(self, txt, size=13, weight="regular", tracking=0):
        f = font(weight, size)
        t = self.d.textlength(txt, font=f)
        if tracking:
            t += s(tracking) * max(0, len(txt) - 1)
        return t / SS

    def wrap(self, txt, max_w, size=13, weight="regular"):
        words, lines, cur = txt.split(), [], ""
        for w in words:
            trial = (cur + " " + w).strip()
            if self.tw(trial, size, weight) <= max_w or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    def paragraph(self, xy, txt, max_w, size=13, weight="regular", fill=MUTED, leading=1.55):
        x, y = xy
        for line in self.wrap(txt, max_w, size, weight):
            self.text((x, y), line, size, weight, fill)
            y += size * leading
        return y

    def line(self, pts, fill=INK, width=1.0):
        self.d.line([(s(p[0]), s(p[1])) for p in pts], fill=fill, width=max(1, s(width)))

    # -- helpers ----------------------------------------------------
    def dash_round_rect(self, box, radius, color, width=1.5, dash=7, gap=5):
        x0, y0, x1, y1 = box
        r = radius
        pts = []
        # top edge
        pts += [(x0 + r, y0), (x1 - r, y0)]
        arc = lambda cx, cy, a0, a1: [
            (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
            for a in range(int(a0), int(a1) + 1, 3)
        ]
        pts += arc(x1 - r, y0 + r, -90, 0)
        pts += [(x1, y0 + r), (x1, y1 - r)]
        pts += arc(x1 - r, y1 - r, 0, 90)
        pts += [(x1 - r, y1), (x0 + r, y1)]
        pts += arc(x0 + r, y1 - r, 90, 180)
        pts += [(x0, y1 - r), (x0, y0 + r)]
        pts += arc(x0 + r, y0 + r, 180, 270)

        # resample + dash
        dist, on, acc = 0.0, True, 0.0
        prev = pts[0]
        for cur in pts[1:]:
            seg = math.dist(prev, cur)
            t = 0.0
            while t < seg:
                step = min(seg - t, (dash if on else gap) - acc)
                if step <= 0:
                    break
                a = (prev[0] + (cur[0] - prev[0]) * (t / seg), prev[1] + (cur[1] - prev[1]) * (t / seg))
                b = (
                    prev[0] + (cur[0] - prev[0]) * ((t + step) / seg),
                    prev[1] + (cur[1] - prev[1]) * ((t + step) / seg),
                )
                if on:
                    self.line([a, b], fill=color, width=width)
                t += step
                acc += step
                if acc >= (dash if on else gap) - 0.001:
                    on, acc = not on, 0.0
            prev = cur

    def badge(self, x, y, n, r=10.5, fill=ANNO, fg=WHITE):
        self.d.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=fill)
        self.text((x, y - r * 0.62), str(n), 10.5, "bold", fg, anchor="mt")

    def icon_upload(self, cx, cy, size=18, color=WHITE):
        # tray + arrow
        w = size
        self.line([(cx - w * 0.55, cy + w * 0.18), (cx + w * 0.55, cy + w * 0.18)], color, 2)
        self.line([(cx - w * 0.38, cy + w * 0.52), (cx + w * 0.38, cy + w * 0.52)], color, 2)
        self.line([(cx, cy + w * 0.32), (cx, cy - w * 0.55)], color, 2)
        self.line([(cx - w * 0.28, cy - w * 0.26), (cx, cy - w * 0.56), (cx + w * 0.28, cy - w * 0.26)], color, 2)

    def icon_lock(self, cx, cy, size=9, color=MUTED):
        w = size
        self.rect((cx - w * 0.62, cy - w * 0.1, cx + w * 0.62, cy + w * 0.9), fill=None, outline=color, width=1.2, radius=1.6)
        self.d.arc([s(cx - w * 0.42), s(cy - w * 0.85), s(cx + w * 0.42), s(cy + w * 0.15)], 180, 360, fill=color, width=max(1, s(1.2)))

    def icon_check(self, cx, cy, size=8, color=WHITE):
        self.line([(cx - size * 0.55, cy), (cx - size * 0.12, cy + size * 0.42), (cx + size * 0.6, cy - size * 0.45)], color, 2)

    def icon_file(self, x, y, w=16, color=MUTED):
        h = w * 1.25
        self.line([(x, y), (x + w * 0.62, y), (x + w, y + h * 0.24), (x + w, y + h), (x, y + h), (x, y)], color, 1.2)

    def save(self, name):
        out = self.img.resize((self.w, self.h), Image.LANCZOS)
        path = os.path.join(HERE, name)
        out.save(path, optimize=True)
        print("wrote", path)


def chrome(cv: Canvas, box, url):
    x0, y0, x1, y1 = box
    cv.rect(box, fill="#E4E2DB", radius=10)
    cv.rect((x0, y0 + 20, x1, y1), fill="#E4E2DB", radius=0)
    for i, c in enumerate(["#D3D1C8", "#D3D1C8", "#D3D1C8"]):
        cx = x0 + 26 + i * 16
        cv.d.ellipse([s(cx - 4.5), s(y0 + 15), s(cx + 4.5), s(y0 + 24)], fill=c)
    pill = (x0 + 130, y0 + 9, x0 + 420, y0 + 31)
    cv.rect(pill, fill="#F4F3EE", radius=11)
    cv.text((pill[0] + 14, pill[1] + 5.5), url, 10.5, "regular", SUBTLE)


# ---------------------------------------------------------------- image 1
def image_layout():
    W, H = 1720, 1440
    cv = Canvas(W, H)
    MX, MY, MW = 40, 64, 1240
    PAGE_Y1 = 1380

    # browser + page
    chrome(cv, (MX, MY, MX + MW, MY + 48), "localhost:4000")
    cv.rect((MX, MY + 48, MX + MW, PAGE_Y1), fill=PAGE, radius=10)

    # ---- 1 top bar
    hy0, hy1 = MY + 48, MY + 48 + 72
    cv.rect((MX, hy0, MX + MW, hy1), fill=CARD, radius=0)
    cv.line([(MX, hy1), (MX + MW, hy1)], BORDER, 1)
    mk = 26
    cv.rect((MX + 32, hy0 + 23, MX + 32 + mk, hy0 + 23 + mk), fill=ACCENT, radius=8)
    cv.text((MX + 32 + mk / 2, hy0 + 23 + 6), "S", 13, "bold", WHITE, anchor="mt")
    cv.text((MX + 32 + mk + 12, hy0 + 30), "Spend Audit", 15, "semibold", INK)
    lt = "Runs locally · no account"
    tw = cv.tw(lt, 12.5)
    cv.icon_lock(MX + MW - 32 - tw - 14, hy0 + 37, 8, MUTED)
    cv.text((MX + MW - 32 - tw, hy0 + 30), lt, 12.5, "regular", MUTED)
    cv.badge(MX + 16, hy0 + 16, 1)

    # ---- 2 hero
    cx = MX + MW / 2
    y = hy1 + 58
    py = (cv.tw("MONTHLY SPEND AUDIT", 10.5, "semibold", 2.4), 0)
    cv.d.ellipse([s(cx - py[0] / 2 - 14), s(y + 5), s(cx - py[0] / 2 - 6), s(y + 13)], fill=ACCENT)
    cv.text((cx + 4, y), "MONTHLY SPEND AUDIT", 10.5, "semibold", MUTED, anchor="mt", tracking=2.4)
    cv.badge(MX + 16, y + 2, 2)

    y += 26
    for line in ["See what you're quietly", "paying for every month."]:
        cv.text((cx, y), line, 52, "semibold", INK, anchor="mt")
        y += 60
    y += 12
    for line in [
        "Drop in your bank statement CSV. We surface every recurring charge,",
        "total it up, and flag the ones nobody owns.",
    ]:
        cv.text((cx, y), line, 16, "regular", MUTED, anchor="mt")
        y += 26

    # ---- 3 upload card
    card_w, card_h = 720, 316
    card_x = cx - card_w / 2
    card_y = y + 40
    cv.shadow((card_x, card_y, card_x + card_w, card_y + card_h), radius=24, spread=26, alpha=22, offset=8)
    cv.rect((card_x, card_y, card_x + card_w, card_y + card_h), fill=CARD, outline=BORDER, width=1, radius=24)

    dz = (card_x + 14, card_y + 14, card_x + card_w - 14, card_y + card_h - 14)
    cv.rect(dz, fill=CARD_ALT, radius=16)
    cv.dash_round_rect(dz, 16, DASHED, 1.4, 7, 5)

    icy = card_y + 42
    plate = 52
    cv.rect((cx - plate / 2, icy, cx + plate / 2, icy + plate), fill=ACCENT_SOFT, radius=15)
    cv.icon_upload(cx, icy + plate / 2, 17, ACCENT)
    cv.text((cx, icy + plate + 18), "Drag & drop your bank statement", 18.5, "semibold", INK, anchor="mt")
    cv.text((cx, icy + plate + 48), "CSV export from any bank · up to 10 MB", 12.5, "regular", MUTED, anchor="mt")

    bw, bh = 152, 42
    by = icy + plate + 74
    cv.shadow((cx - bw / 2, by, cx + bw / 2, by + bh), radius=10, spread=14, alpha=18, offset=4)
    cv.rect((cx - bw / 2, by, cx + bw / 2, by + bh), fill=INK, radius=10)
    cv.text((cx, by + 12.5), "Browse files", 13.5, "semibold", WHITE, anchor="mt")
    cv.text((cx, by + bh + 13), "or click anywhere in this box", 11.5, "regular", SUBTLE, anchor="mt")
    cv.badge(card_x - 22, card_y + 22, 3)
    cv.badge(cx - bw / 2 - 34, by + bh / 2 - 10, 4)

    # ---- 5 trust line
    ty = card_y + card_h + 30
    tr = "Your file stays on this device — nothing is uploaded."
    tw2 = cv.tw(tr, 12.5)
    cv.icon_lock(cx - tw2 / 2 - 14, ty + 6, 8, ACCENT)
    cv.text((cx - tw2 / 2, ty), tr, 12.5, "regular", MUTED)
    cv.badge(cx - tw2 / 2 - 44, ty - 2, 5)

    # ---- 6 steps
    y = ty + 46
    labels = [
        ("1", "Import the CSV", "Drop the file straight from online banking."),
        ("2", "See the total", "One number: monthly recurring cost."),
        ("3", "Assign owners", "Flag and clear anything unowned."),
    ]
    sw, gap = 238, 16
    total = sw * 3 + gap * 2
    x = cx - total / 2
    for num, title, sub in labels:
        cv.rect((x, y, x + sw, y + 98), fill=CARD, outline=BORDER, width=1, radius=14)
        cv.text((x + 18, y + 18), num, 10.5, "bold", ACCENT, tracking=1)
        cv.text((x + 34, y + 15), title, 13.5, "semibold", INK)
        cv.paragraph((x + 18, y + 44), sub, sw - 36, 11.5, "regular", MUTED, 1.45)
        x += sw + gap
    cv.badge(cx + total / 2 + 20, y + 10, 6)

    # ---- 7 preview
    y += 98 + 46
    pv_w = 900
    px = cx - pv_w / 2
    cv.text((px, y), "What you'll see after import", 13, "semibold", INK_SOFT)
    cv.text((px + pv_w, y), "example data", 11, "regular", SUBTLE, anchor="rt")
    y += 24
    pv_h = 240
    cv.shadow((px, y, px + pv_w, y + pv_h), radius=20, spread=22, alpha=20, offset=7)
    cv.rect((px, y, px + pv_w, y + pv_h), fill=CARD, outline=BORDER, width=1, radius=20)

    ix = px + 36
    cv.text((ix, y + 28), "TOTAL MONTHLY RECURRING", 10, "semibold", MUTED, tracking=1.8)
    cv.text((ix, y + 50), "$248.60", 44, "semibold", INK)
    cv.text((ix, y + 110), "across 9 recurring charges", 12.5, "regular", MUTED)
    cv.rect((ix, y + 142, ix + 300, y + 144), fill=BORDER, radius=0)
    cv.text((ix, y + 158), "Top group: Subscriptions", 11.5, "regular", SUBTLE)
    cv.text((ix, y + 180), "$118.97 of the total", 11.5, "regular", SUBTLE)

    dx = px + 420
    cv.line([(dx, y + 30), (dx, y + pv_h - 30)], BORDER, 1)
    rx = dx + 32
    cv.text((rx, y + 28), "NEEDS AN OWNER", 10, "semibold", FLAG, tracking=1.8)
    rows = [("Adobe Creative Cloud", "Monthly · $59.99"), ("Notion Plus", "Monthly · $19.00"), ("Figma Professional", "Monthly · $15.00")]
    ry = y + 54
    for title, sub in rows:
        cv.d.ellipse([s(rx), s(ry + 7), s(rx + 7), s(ry + 14)], fill=FLAG)
        cv.text((rx + 16, ry), title, 13, "semibold", INK)
        cv.text((rx + 16, ry + 20), sub, 11.5, "regular", MUTED)
        ry += 52
    # fade to communicate "preview only"
    overlay = Image.new("RGBA", cv.img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([s(px), s(y), s(px + pv_w), s(y + pv_h)], radius=s(20), fill=(251, 251, 248, 58))
    cv.img = Image.alpha_composite(cv.img.convert("RGBA"), overlay).convert("RGB")
    cv.d = ImageDraw.Draw(cv.img)
    cv.badge(px - 22, y + 20, 7)

    # ---- 8 footer
    fy = PAGE_Y1 - 54
    cv.line([(MX + 40, fy), (MX + MW - 40, fy)], BORDER, 1)
    cv.text((cx, fy + 20), "Spend Audit  ·  runs entirely in your browser  ·  no account, no cloud, no tracking", 11.5, "regular", SUBTLE, anchor="mt")
    cv.badge(MX + 24, fy + 22, 8)

    # ------------------------------------------------------------ legend
    lx, ly = 1352, 84
    cv.text((lx, ly), "ANATOMY", 10.5, "semibold", MUTED, tracking=2.2)
    ly += 30
    entries = [
        ("Top bar", "72 px tall. Wordmark left, “runs locally” + lock right.\nNo nav — there is only one screen."),
        ("Hero", "Eyebrow 11 px tracked, H1 52 px / 60 (two lines),\nsub 16 px muted, max 640 px wide, centred."),
        ("Upload card", "720 × 316, radius 24, 1 px border, soft shadow.\nInner dashed drop zone 16 radius, 48 px padding."),
        ("Primary action", "“Browse files”, 42 px tall, ink fill (not the accent —\nemerald is reserved for money and success)."),
        ("Trust line", "12.5 px, lock icon, directly under the card.\nThis is the trust moment — keep it above the fold."),
        ("How it works", "Three 238 px cards, one line of copy each.\nReads in one glance; no manual needed."),
        ("Value preview", "Faded example of the result screen: one big total +\nthe unowned charges. Empty state = onboarding."),
        ("Footer", "Minimal, no links. Repeats the privacy promise."),
    ]
    for i, (title, spec) in enumerate(entries, start=1):
        cv.badge(lx + 10, ly + 8, i, r=9.5)
        cv.text((lx + 28, ly), title, 13, "semibold", INK)
        ly += 19
        ly = cv.paragraph((lx + 28, ly), spec, 318, 11.2, "regular", MUTED, 1.42) + 12

    # tokens
    ly += 14
    cv.line([(lx, ly), (lx + 318, ly)], BORDER, 1)
    ly += 22
    cv.text((lx, ly), "TYPE", 10.5, "semibold", MUTED, tracking=2.2)
    ly += 22
    cv.text((lx, ly), "Geist (or Inter) · 400 + 600 only", 11.5, "regular", INK_SOFT)
    ly += 20
    cv.text((lx, ly), "Display 52/60 · body 16/26 · UI 13/18 · label 10.5 +2%", 11.2, "regular", MUTED)
    ly += 18
    cv.text((lx, ly), "Tracking −2.5% on display, 0 on body, +10% on labels", 11.2, "regular", MUTED)

    ly += 34
    cv.text((lx, ly), "COLOUR", 10.5, "semibold", MUTED, tracking=2.2)
    ly += 24
    swatches = [
        ("#FBFBF8", "page", PAGE),
        ("#FFFFFF", "surface", CARD),
        ("#12120F", "ink", INK),
        ("#6E6E66", "muted", MUTED),
        ("#0E7C5A", "money / success", ACCENT),
        ("#B4392B", "flag / alert", FLAG),
        ("#E4E2DA", "hairline", BORDER),
    ]
    sx = lx
    row_y = ly
    for i, (hexv, label, col) in enumerate(swatches):
        col_i = i % 4
        if i and i % 4 == 0:
            row_y += 54
        x = lx + col_i * 82
        cv.rect((x, row_y, x + 26, row_y + 26), fill=col, outline=BORDER, width=1, radius=7)
        cv.text((x, row_y + 32), hexv, 8.8, "semibold", INK_SOFT)
        cv.text((x, row_y + 43), label, 8.8, "regular", SUBTLE)
    ly = row_y + 66
    cv.text((lx, ly), "60% warm off-white · 30% neutral structure · 10% meaning", 11.2, "regular", MUTED)

    cv.save("01-homepage-layout.png")


# ---------------------------------------------------------------- image 2
def image_states():
    W, H = 1720, 580
    cv = Canvas(W, H)
    cv.text((60, 44), "UPLOAD STATES", 10.5, "semibold", MUTED, tracking=2.2)
    cv.text((60, 66), "One component, every state — designed before the code, not after.", 17, "semibold", INK)

    pw, ph = 360, 330
    gap = 40
    x = 60
    y = 176
    panels = [
        ("IDLE", "Default", "Dashed hairline, soft tint. Cursor + keyboard both work:\nwhole zone is a label for the real <input type=file>."),
        ("DRAG OVER", "Active", "2 px accent border, mint tint, copy swaps to\n“Release to import”. Fires in <100 ms."),
        ("REJECTED", "Error", "Names the file, the limit and the fix — never a\nbare “upload failed”. Keeps everything else intact."),
        ("IMPORTED", "Success", "File row + determinate progress + transaction count.\nReplace or clear without re-picking the month."),
    ]

    for i, (eyebrow, title, note) in enumerate(panels):
        lx = 60 + i * (pw + gap)
        cv.text((lx, y - 48), eyebrow, 10, "semibold", SUBTLE, tracking=1.8)
        cv.text((lx, y - 30), title, 13, "semibold", INK_SOFT)

    def zone(i, fill, border_color, dashed_width=1.4, dashed=True):
        px = 60 + i * (pw + gap)
        cv.shadow((px, y, px + pw, y + ph), radius=18, spread=20, alpha=18, offset=6)
        cv.rect((px, y, px + pw, y + ph), fill=CARD, outline=BORDER, width=1, radius=18)
        inner = (px + 12, y + 12, px + pw - 12, y + ph - 12)
        cv.rect(inner, fill=fill, radius=14)
        if dashed:
            cv.dash_round_rect(inner, 14, border_color, dashed_width, 7, 5)
        else:
            cv.rect(inner, fill=None, outline=border_color, width=dashed_width, radius=14)
        return px, inner

    # 1 idle
    px, inn = zone(0, CARD_ALT, DASHED)
    cx = px + pw / 2
    yy = y + 76
    cv.rect((cx - 26, yy, cx + 26, yy + 52), fill=ACCENT_SOFT, radius=15)
    cv.icon_upload(cx, yy + 26, 16, ACCENT)
    cv.text((cx, yy + 70), "Drag & drop your CSV", 14, "semibold", INK, anchor="mt")
    cv.text((cx, yy + 92), "or browse — 10 MB max", 11.5, "regular", MUTED, anchor="mt")
    cv.rect((cx - 62, yy + 114, cx + 62, yy + 150), fill=INK, radius=9)
    cv.text((cx, yy + 123), "Browse files", 12, "semibold", WHITE, anchor="mt")

    # 2 drag over
    px, inn = zone(1, "#F1F8F4", ACCENT, 2.0)
    cx = px + pw / 2
    yy = y + 76
    cv.rect((cx - 26, yy, cx + 26, yy + 52), fill=WHITE, radius=15)
    cv.icon_upload(cx, yy + 26, 16, ACCENT)
    cv.text((cx, yy + 70), "Release to import", 14, "semibold", ACCENT, anchor="mt")
    cv.text((cx, yy + 92), "statement-oct-2026.csv", 11.5, "regular", MUTED, anchor="mt")

    # 3 rejected
    px, inn = zone(2, FLAG_SOFT, FLAG_LINE, 1.4)
    cx = px + pw / 2
    yy = y + 92
    cv.rect((cx - 24, yy, cx + 24, yy + 44), fill=WHITE, radius=13)
    cv.text((cx, yy + 8), "!", 16, "bold", FLAG, anchor="mt")
    cv.text((cx, yy + 58), "That file is 24 MB", 13, "semibold", INK, anchor="mt")
    cv.text((cx, yy + 78), "Limit is 10 MB · CSV only", 11.5, "regular", MUTED, anchor="mt")
    cv.text((cx, yy + 108), "Choose another file", 11.5, "semibold", FLAG, anchor="mt")

    # 4 imported
    px, inn = zone(3, CARD, BORDER, 1.0, dashed=False)
    ix = px + 26
    yy = y + 54
    cv.rect((ix, yy, ix + 40, yy + 46), fill="#F1F1EC", radius=10)
    cv.icon_file(ix + 12, yy + 13, 15, MUTED)
    cv.text((ix + 54, yy + 3), "statement-oct-2026.csv", 12.5, "semibold", INK)
    cv.text((ix + 54, yy + 24), "1.2 MB · 128 transactions", 11, "regular", MUTED)
    cv.d.ellipse([s(px + pw - 62), s(yy + 8), s(px + pw - 42), s(yy + 28)], fill=ACCENT)
    cv.icon_check(px + pw - 52, yy + 18, 7, WHITE)

    bar = (ix, yy + 74, px + pw - 26, yy + 82)
    cv.rect(bar, fill="#EDEDE7", radius=4)
    cv.rect((bar[0], bar[1], bar[0] + (bar[2] - bar[0]) * 0.42, bar[3]), fill=ACCENT, radius=4)
    cv.text((ix, yy + 94), "Reading 54 of 128 rows…", 11.5, "regular", MUTED)
    cv.text((ix, yy + 124), "Parsing with local rules only", 10.5, "regular", SUBTLE)
    cv.rect((ix, yy + 156, ix + 104, yy + 188), fill=WHITE, outline=BORDER, width=1, radius=9)
    cv.text((ix + 52, yy + 165), "Replace file", 11.5, "semibold", INK_SOFT, anchor="mt")
    cv.text((ix + 134, yy + 165), "Remove", 11.5, "regular", SUBTLE)

    # captions
    for i, (_, _, note) in enumerate(panels):
        px = 60 + i * (pw + gap)
        cv.paragraph((px, y + ph + 24), note, pw - 8, 11.2, "regular", MUTED, 1.45)

    cv.save("02-upload-states.png")


if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    image_layout()
    image_states()
