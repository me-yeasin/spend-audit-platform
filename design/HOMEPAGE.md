# Homepage — v1 design spec (for approval)

Reference renders: [01-homepage-layout.png](01-homepage-layout.png) · [02-upload-states.png](02-upload-states.png)

## Direction

**Quiet ledger.** A calm, editorial fintech surface: warm off-white paper, near-black ink, one emerald accent that only ever means money/success, and a single dominant action. Nothing decorative, nothing that looks like a dashboard before there is data.

Why this reads as trusted: generous whitespace, one typeface in two weights, hairline borders instead of heavy shadows, a visible privacy promise next to the upload, and an empty state that previews the result instead of showing a blank box.

## Layout (desktop, 1440 max content, centred)

| # | Element | Spec |
|---|---------|------|
| 1 | Top bar | 72 px. Wordmark left, lock + "Runs locally · no account" right. No navigation. |
| 2 | Hero | Eyebrow 11 px tracked + dot · H1 52/60 two lines · sub 16/26, max 640 px · 88 px top padding. |
| 3 | Upload card | 720 × 316, radius 24, 1 px border, soft shadow. Inner dashed zone (radius 16, 1.4 px dashed). |
| 4 | Primary action | "Browse files", 152 × 42, ink fill, radius 10. Emerald is *not* used here. |
| 5 | Trust line | 12.5 px with lock icon, 30 px under the card. Must stay above the fold. |
| 6 | How it works | Three 238 px cards: Import → See the total → Assign owners. One line of copy each. |
| 7 | Value preview | 900 × 240 faded panel: big total + "Needs an owner" rows. Communicates the outcome before upload. |
| 8 | Footer | Hairline + one 11.5 px line repeating the privacy promise. No links. |

Mobile (≤ 640): single column, card goes full width with 16 px page gutters, H1 drops to 34/40, steps stack, preview hides behind a "See an example" disclosure.

## Tokens

```
page      #FBFBF8      surface   #FFFFFF      ink     #12120F
muted     #6E6E66      subtle    #9C9C92      hairline #E4E2DA
accent    #0E7C5A  (money, success, focus)
accent-bg #E9F4EE
flag      #B4392B  (unowned / errors)   flag-bg #FBEDEA
radius    24 card · 16 drop zone · 10 buttons · 8 chips
shadow    0 8px 24px rgba(18,18,15,.06)
space     4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 88
type      Geist (fallback Inter) · 400 + 600 only
          display 52/60 −2.5% · body 16/26 · UI 13/18 · label 10.5 +10% uppercase
```

## Upload component — states

1. **Idle** — dashed hairline, soft tint, upload glyph, two-line hint, `Browse files`.
2. **Drag over** — 2 px accent border, mint tint, copy swaps to “Release to import”, filename shown.
3. **Rejected** — flag tint + dashed flag border, message names the file and the limit, single recovery link. Never a bare "upload failed".
4. **Imported** — file row (name, size, transaction count, check badge), determinate progress, "Reading 54 of 128 rows…", Replace / Remove.

All states keep a real `<input type="file" accept=".csv">` underneath, keyboard reachable, hint linked with `aria-describedby`, status announced in a live region.

## Copy

- H1: “See what you're quietly paying for every month.”
- Sub: “Drop in your bank statement CSV. We surface every recurring charge, total it up, and flag the ones nobody owns.”
- Zone: “Drag & drop your bank statement” / “CSV export from any bank · up to 10 MB”
- Trust: “Your file stays on this device — nothing is uploaded.”
- Steps: Import the CSV · See the total · Assign owners

## What step 1 builds

UI only, no parsing:

- new `app/page.tsx` composition + small components (`Wordmark`, `UploadCard`, `TrustLine`, `HowItWorks`, `ResultPreview`)
- tokens as CSS variables in `app/globals.css`, Tailwind v4 `@theme`
- real drag-over / drop / file-input events wired to component state (file shown, not parsed)
- error state for wrong type / oversize, success state listing the chosen file name
- responsive pass + keyboard/focus states
- placeholder preview values (fixed demo numbers), clearly labelled "example data"
