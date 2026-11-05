# Monthly re-run — design and spec

Step 7 of the roadmap. This is the second half of the loop: upload next month's
statement, see what changed, and see what it costs you now.

The diagram is `design/09-monthly-rerun.png`, rendered by
`design/monthly-rerun.py` and proved sound by `design/check-monthly.py`. This
document is the spec the diagram is drawn from; the two are written to agree,
and the checker proves the picture cannot drift from the numbers in here.

Everything in this feature is local. There is no account, no server, no sync.
The only new thing that persists is a copy of the rows you have imported, in
your own browser, until you press one button to forget it.

---

## 1. The user story

> I upload my bank statement. Within a second I want to know one thing: how much
> do I pay every month for things that repeat? Not what I spent in total, not
> what is trending — the standing monthly cost, so I can decide whether it is
> worth cancelling something.

And then, a month later:

> I upload next month's statement. I want to know what changed — did anything get
> more expensive, did I cancel something, did I forget to pay for something — and
> I want the same number as last month, so I can see whether I am better off.

The second sentence is the whole feature. "Upload the same file again and see
the same number" is step 5. "Upload next month's file and see what changed" is
step 7.

---

## 2. The flow: three uploads, one saved history

The loop is **accumulate, then compare** — not "compare the file you just
uploaded with the file before it".

```
  November 2026            December 2026            January 2027
  statement-november.csv   statement-december.csv   statement-january.csv
  21 rows                  20 rows                  21 rows
        │                        │                        │
        └──────────── saved in this browser ──────────────┘
                                 │
                    all three months are analysed
                    together, as one history
                                 │
                    14 recurring charges, $2,406.84 a month
                                 │
                    January is compared with December
```

On every upload the app does the same four things:

1. **Parse the file** into payments (date, description, amount). The existing
   parser, unchanged.
2. **Save the month** in this browser, with its rows (§3).
3. **Analyse the saved months together with the new file.** This is the part
   that matters. The detector is given every payment on file — November,
   December and January — not just January's rows.
4. **Compare the newest month with the one before it**, over the same set of
   charges (§7).

Step 3 is why the detector's three-payment rule is not a blocker: the
repetition is found *across* the saved months, so the user does not have to
upload three files before anything happens. The first file is saved, the
second is saved, and the list appears the moment the third lands — or sooner,
if they upload a statement that already covers three months.

**Verified against the real detector**, on the shipped fixture:
one month (21 rows) → 0 recurring; two months (41 rows) → 0 recurring; three
months (62 rows) → **14 recurring charges**, and the total matches the shipped
three-month fixture exactly.

### Why the months are analysed together, and not pairwise

Pairwise ("this file vs the last file") has a specific failure: a charge that
repeats every month but whose amount drifts is not detected in *either* file
on its own, so it never appears at all. The three-payment rule needs three
occurrences, and a single statement rarely holds three of them.

Analysing the saved history together means the rule is applied to the data
that actually exists — three months of the same charge — which is what the
user experiences as "it repeats".

### The cost of accumulating

Accumulation is not free: the app now holds rows it did not hold before. §3
is about what is held, how much, and how to get rid of it. The alternative —
keeping only a summary of each month — was considered and **rejected**: a
summary of *recurring charges* cannot feed the detector, because the detector
needs to see payments of charges that are not yet known to repeat. Summary of
*what the file contained* is just the file.

---

## 3. What is stored, and where

### The key

`localStorage["spend-audit.months.v1"]` — the same pattern and the same
namespace as the existing `spend-audit.owners.v1` (`OWNERS_STORAGE_KEY` in
`lib/owners.ts`), and it is read and written through the same kind of
try/catch wrapper as `app/_components/use-owners.ts`.

### The shape

```jsonc
{
  "version": 1,
  "months": [
    {
      "month": "2026-11",              // YYYY-MM, the calendar month
      "label": "November 2026",        // for the history strip
      "source": "statement-november.csv",
      "importedAt": "2026-11-05T10:12:01.000Z",
      "payments": [
        { "date": "2026-11-02", "description": "CITY APARTMENTS RENT", "amountCents": -185000 },
        { "date": "2026-11-04", "description": "GEICO AUTO INSURANCE",  "amountCents": -12850 }
      ]
    }
  ]
}
```

Amounts are **integer cents**, not floats — the codebase already has
`toCents()` in `lib/total.ts` for exactly this reason, and a float in
`localStorage` is a rounding bug waiting for the eleventh month.

Owners stay in their own key (`spend-audit.owners.v1`) and are untouched by
this feature. They carry over month to month already, because they are keyed
by merchant, not by file.

### How much

A month of the fixture is 21 rows. Each row is about 80 bytes of JSON, so a
month is roughly **2 KB**, and twelve months is about **25 KB**.

A browser origin gets **5 MiB of `localStorage`** (MDN, *Storage quotas and
eviction criteria*). Twelve months of rows is less than half a percent of
that. The quota is not the constraint; the privacy is.

### The privacy trade-off, stated plainly

This is the one place where the feature gets worse in exchange for something.

- The app keeps **a copy of every payment row you have ever imported**, in
  the browser's local storage, on the device. It does not leave the device.
- It is not encrypted. Anyone with access to the browser profile on that
  machine can read it — the same people who can read the CSV you downloaded
  from your bank.
- It survives closing the browser. It does not survive "clear site data",
  and it does not survive private browsing, which discards it when the window
  closes (MDN).
- **"Forget saved history"** deletes it in one click (§13). This is the only
  way out, so it has to be visible, not buried.

The alternative — keep nothing, re-upload every month, and compare by hand —
costs the user their comparison and still leaves the CSV in their Downloads
folder. Keeping the rows is the honest way to make "compare three months"
possible at all.

### What is *not* stored

No totals, no summaries, no derived figures. The stored rows are the input
to the detector; anything derived from them can be recomputed, and anything
recomputed can be wrong in one place rather than two.

---

## 4. The headline: one basis (D2)

### The decision

**The headline moves from the median of all payments to the newest payment of
each charge.** One basis, everywhere.

| | before (median) | after (newest payment) |
| --- | --- | --- |
| fixture, three months | $2,401.64 | **$2,404.34** |
| what it is | the middle payment of every charge | what you paid for each charge this month |

The comparison between two months uses the same thing: each charge's payment
in that month. So the headline and the newest month of the comparison are
**the same number, computed the same way**. They cannot disagree, because
they are the same figure.

### Why

1. **The median is a lagging number.** A charge that was $123.40 for months
   and is $126.10 now still contributes $123.40 to a median-based total. The
   headline would report what you paid a month ago on the one charge whose
   price just moved — the exact charge the user came to look at.
2. **Two totals that disagree are the single most damaging thing a spending
   app can do** (TOTAL.md §10.3). Copilot's own help centre documents the
   trap from the other side: *"the spending totals seen in the Cash Flow tab
   may be different than the Categories tab"*. A headline on one basis and a
   comparison on another is the same mistake, made by us, on our own page.
3. **It is what the user means.** "What do I pay a month?" is answered by
   "what did each of these cost me last month", not by a statistic over a
   window they did not choose.

### What this costs, exactly

This is a **visible change to a shipped number**, and it needs sign-off:

| File | What changes |
| --- | --- |
| `lib/total.ts` | `summariseRecurring` must return the newest payment per charge as the monthly amount; the median moves out of the headline path |
| `app/_components/total-panel.tsx` | no markup change — it renders whatever the summary says |
| `design/TOTAL.md` §3 | "the sum of the **median monthly amount**" becomes "the sum of the **newest payment** of every detected recurring charge" |
| `design/TOTAL.md` §4 and §12 | the figures ($2,401.64 → $2,404.34) and the footer sum |
| `design/total-cost.py` | `TOTAL = 2401.64` → `2404.34` |
| `design/check-total.py` | the expected figure in `check_numbers()` and the two `find_box()` probes |
| `design/RECURRING.md` | the month-combination table (line 222) |
| `design/qa-total-panel.mjs` | the assertions that pin the context line's figures |

Nothing in `app/` currently hard-codes `$2,401.64`, so no product test breaks
on the number — but `TOTAL.md` §3's *definition* changes, and that is the
sentence the rest of the app is built on. It has to be rewritten, not just
recomputed.

### The one number the user sees

With three months of the fixture on file, the headline becomes **$2,404.34**
and the difference from today's $2,401.64 is **$2.70** — and $2.70 is exactly
one charge, `CITY POWER & WATER`, whose price moved from $123.40 to $126.10
in the newest month. The gap between the two bases is never a mystery: it is
a named row in the comparison.

---

## 5. The price-rise rule (D1)

### The decision

**One larger step is allowed in a series, and the charge is reported as a
price change instead of disappearing.**

The detector today rejects a charge whose amount moves more than
`MAX_AMOUNT_STEP` (4%) between two payments. A subscription that raises its
price by 16% is therefore rejected — and, worse, it is rejected *silently*:
it vanishes from the list, and the headline drops by its whole amount.

The rule becomes: **at most one step in a series may exceed the 4% band, and
that step may be up to 50%. Every other step must still be within 4%.** A
second large step still rejects the charge.

### Why, with the numbers

On the fixture, with one deliberate price rise (NETFLIX.COM, $15.49 → $17.99
in January):

| | today's rule | one step allowed |
| --- | --- | --- |
| recurring charges | 13 | **14** |
| rejected | 8 | **7** |
| January | $2,388.85 | **$2,406.84** |
| what the app says | "+$2.70" | "+$5.20" |

Today's rule does not merely lose the price rise — it loses the charge. It
reports "+$2.70" when the truth is "+$5.20", and $15.49 a month has left the
list without a word. That is the "two totals that disagree" failure, produced
by the detector rather than by the layout.

**Verified against the real detector on both shipped fixtures:** relaxing the
rule changes *nothing* about the other thirteen charges — 14 recurring and 7
rejected on the three-month fixture, 14 and 7 on the twelve-month fixture, and
the same seven rejections with the same reasons. **No new false positives.**
The rule is only a little more forgiving about one step; it does not let a
two-off shop in.

It also does not let a steady drift in: a charge that rises 4.5% every month
has two large steps and is still rejected.

### The precedent

Monarch has a distinct state for this: a recurring payment is **"paid, but at
a different amount than expected"** — its own colour, separate from "paid as
expected". Copilot's recurring model matches on name, date **and amount
range**, so it can hold an expected amount and compare against it. Both are
real products treating a changed amount as a first-class outcome, not as a
disappearance.

### What the page says

No new label. The row shows the amount before and after — `$15.49 → $17.99`
with `+$2.50` — which says "your price changed" without a new word to learn.
The word "price changed" is the *state* in the app's internals; on the page
the arrow is the report.

> **Open question for the lead:** if a visible label is wanted, the group
> heading could become `PRICE CHANGES` instead of `INCREASED` — but then
> increases and decreases sit in one group, and the sign of the delta has to
> do all the work.

### The alternative, and its honest wording

If the rule is **not** relaxed, the comparison must say this when a charge
disappears:

> **No longer charged** — `NETFLIX.COM` · $15.49
> *"Not seen any more — it may have ended, or its price may have moved enough
> to stop looking regular."*

That sentence is honest, but it asks the user to do the analysis the app
should have done, and it makes a price rise look like a cancellation on a
page whose whole job is to be trustworthy. It is the fallback, not the
recommendation.

---

## 6. Where the comparison lives (D3)

Three placements were drawn, in the diagram and in §11:

**A — a quiet panel under the headline. RECOMMENDED.**
The comparison is its own panel, directly under the headline card. The
history strip is the last thing in that panel. The eye moves down one step
from the number it came to read. The headline keeps the big number; the
comparison's figure is 22px, not 44px, so it can never compete with it.

**B — the comparison under the headline, the history at the foot of the page.**
The history strip moves to the bottom of the workspace, under Transactions.
It is further away and it competes with the transaction list for the last
screen, for no gain.

**C — its own "Months" view.**
Both the comparison and the history live in a separate tab. The workspace is
untouched, which is a real virtue — but "what changed?" is then a click
away, and on a phone it is another screen. The question people ask when they
re-run a statement is *what changed*, and this feature exists to answer it.

A is recommended: the question is asked at the moment the number is read, and
the answer should be one step away.

---

## 7. What the comparison says

### The shape of the panel

```
Compared with December 2026              the same 14 charges in both months
January 2027
$2,406.84  per month
+$5.20 more than December 2026 ($2,401.64)
INCREASED
  CITY POWER & WATER      $123.40 → $126.10      +$2.70
  NETFLIX.COM             $15.49 → $17.99        +$2.50
12 charges unchanged.
──────────────────────────────────────────────────────────
MONTHS ON FILE
  November 2026    December 2026    January 2027
  $2,398.94        $2,401.64        $2,406.84
  ▁                ▁                ▁
3 months saved in this browser              Forget saved history
```

### The four categories

| Category | Heading on the page | When it can appear | The row |
| --- | --- | --- | --- |
| amount went up | `INCREASED` | from the first comparison (month 3) | name · `$123.40 → $126.10` · `+$2.70` |
| amount went down | `DECREASED` | from the first comparison (month 3) | name · `$11.99 → $11.59` · `-$0.40` |
| new charge | `NEW` | from month 4 | name · `$0.00 → $9.99` · `+$9.99` |
| no longer charged | `NO LONGER CHARGED` | from month 4 | name · `$15.49` · `-$15.49` |

The first two compare payments that exist in both months. The last two are
about charges appearing and disappearing from the list, which means they need
a *previously detected set* to compare against:

- **NEW** — a charge paid three times that was not in the app's list before.
  It can only be reported once the app has seen it three times, so the
  earliest it can appear is month 4.
- **NO LONGER CHARGED** — a charge the app had already listed that was not
  paid this month. Also month 4.

So the panel is honest about its own reach: at month 3 it can only say what
moved, and it says so by showing the two categories it has. A user who
subscribes to something new in month 2 sees it named in month 4, not month 2.
That is the detector's three-payment rule, and it is better to be late and
right.

**Nothing is reported as new or stopped on the strength of one payment.**
A shop you happened to pay twice is not a subscription.

### The consistency rule

> **The sum of the per-charge changes between two months equals the difference
> between those two months' headline totals.**

In the mock: `+$2.70 + $2.50 = +$5.20 = $2,406.84 − $2,401.64`.

This is the promise that makes the comparison trustworthy, and it is
mechanical: both sides are the same set of charges, at the same amounts, in
the same month. `design/check-monthly.py` asserts it against the fixture, and
the lead intends to write a QA check against it too.

Two consequences follow, and both are rules:

1. The comparison's "this month" figure and the headline card's figure are
   **the same number**. They are not two views of it; they are one figure,
   rendered twice.
2. The "unchanged" line is not filler. "12 charges unchanged" tells the user
   that the panel covered everything, so a short list of changes means a
   quiet month rather than a broken comparison.

### The delta line, in words

`+$5.20 more than December 2026 ($2,401.64)`

- The direction is a **word**, not an arrow and not a colour. "more" and
  "less" cannot be misread, cannot be colour-blind, and do not depend on a
  translation of an icon.
- The amount is in **ink**, like every other number on the page. Green means
  income. Red means the owner flag. A price rise is not an error and a
  price cut is not a warning, so neither is coloured.
- The previous month's total is in brackets because the comparison is
  between two numbers and the user should be able to check the subtraction
  without going to the strip.

---

## 8. The history strip

The last twelve months, at the bottom of the comparison panel.

```
MONTHS ON FILE
  November 2026    December 2026    January 2027
  $2,398.94        $2,401.64        $2,406.84
  ▁                ▁                ▁
```

- **Twelve months** is the retention window (§13).
- **The bars are scaled from zero**, so a flat series looks flat. On the
  fixture the three months differ by $7.90 on $2,400 — the strip is honest
  that nothing much happened. The strip is a **trend, not a change
  detector**; the change is in the list above it, where a $2.70 difference is
  a named row.
- **The strip is a list of months and totals; the change list is a list of
  charges.** They are different jobs and they are not mixed. This follows
  LunchMoney's split — "statistics in easy-to-read lists, while trends are
  visualized in colorful charts" — with the house's own restraint on colour.
- The newest month is the one in ink; the older ones are quiet. The eye
  lands on "now".

---

## 9. Exact copy, every state

### Month 1 — November 2026 (the first file)

```
Total monthly recurring cost
No recurring charges yet
One month is not enough to tell a repeat from a one-off.
November 2026 is saved — two more months and this becomes a number.
```

### Month 2 — December 2026

```
Total monthly recurring cost
No recurring charges yet
Two months are on file. One more month of payments and we can
name your recurring charges. Nothing here is wrong.
```

### Month 3 — January 2027

```
Total monthly recurring cost
$2,406.84  per month
across 14 recurring charges · $453.85 per month has no owner
```

followed by the comparison panel (§7).

### The empty states

There are two, and they have different causes. Both never show `$0.00`.

**E1 · Not enough history** (fewer than three payments of anything):

> **No recurring charges yet**
> One month is not enough to tell a repeat from a one-off. November 2026 is
> saved — two more months and this becomes a number.

**E2 · Nothing repeats** (three or more months on file, and nothing in them
repeats three times):

> **No recurring charges found**
> Nothing repeats in this statement yet, so there is nothing to total.

E2 is the shipped copy from `design/TOTAL.md` §4.3, with one word changed:
*"in this statement"* becomes **"in this history"**, because under the
accumulate model the app is looking at three statements, not one. That
string is asserted in `design/qa-total-panel.mjs` and must be updated with it.

### The comparison panel

| Slot | Copy |
| --- | --- |
| Heading | `Compared with December 2026` |
| Right-hand note | `the same 14 charges in both months` |
| Label | `January 2027` |
| Figure | `$2,406.84` + `per month` |
| Delta line | `+$5.20 more than December 2026 ($2,401.64)` |
| Group | `INCREASED` / `DECREASED` / `NEW` / `NO LONGER CHARGED` |
| Row | `CITY POWER & WATER` · `$123.40 → $126.10` · `+$2.70` |
| Unchanged | `12 charges unchanged.` |
| Strip label | `MONTHS ON FILE` |
| Footer left | `3 months saved in this browser` |
| Footer right | `Forget saved history` |

### The flow copy

| Slot | Copy |
| --- | --- |
| Step label | `NOVEMBER 2026` / `DECEMBER 2026` / `JANUARY 2027` |
| File line | `statement-november.csv · 21 rows` |
| What happens | `Saved in this browser. One month of payments is on file.` |
| What you see | `No recurring charges yet — one month is not enough to spot a repeat.` |
| Under the flow | `The three months are analysed together — that is what makes a repeat visible. Nothing is uploaded, and nothing leaves this browser.` |

---

## 10. Typography and colour

Everything follows the house tokens in `app/globals.css`. Nothing new.

| Element | Size | Weight | Colour |
| --- | --- | --- | --- |
| Headline figure | 44px (30px mobile) | semibold | ink `#12120f` |
| Headline label | 12px | semibold | muted `#6e6e66` |
| Headline context | 12px | regular | subtle; the unclaimed clause in flag `#b4392b` |
| Comparison heading | 13.5px | semibold | ink |
| Comparison figure | 22px (20px mobile) | semibold | ink |
| Delta line | 12.5px | semibold amount, regular words | ink |
| Group headings | 9px, tracking 1.3 | semibold | muted |
| Change rows | 12px name / 11.5px amounts | semibold / regular | ink / muted |
| Unchanged line | 10.5px | regular | subtle |
| Strip label | 9px, tracking 1.3 | semibold | muted |
| Strip months / totals | 9.5px / 12px | semibold | muted / ink |
| Footer line | 10px | regular | subtle |
| "Forget saved history" | 10.5px | regular | muted, hairline underline |

**The comparison's figure is 22px against the headline's 44px.** That ratio is
the design: the comparison is the second most important thing on the page,
and it can never be mistaken for the headline.

**Colour rules, unchanged from the house:**

- Money out is **ink**. Never green, never red.
- **Red is the owner flag** and nothing else — the unclaimed clause, the
  flagged rows, the count badge.
- **Green is not used for a price rise or a price cut.** A subscription that
  got more expensive is not good news and is not bad news. The house already
  uses the accent green for one non-money thing: the tick on the file chip
  that says the file was read. The legend's colour key says
  `money out · the owner flag · income`; the file chip's tick is a
  confirmation, not a figure, and no money is ever drawn in it.
- `design/check-monthly.py` enforces all of this: every colour drawn must be
  one of the app's tokens, no text containing `$` may be green, and red may
  only appear on an owner-flag element or in the legend's own colour key.

---

## 11. Layout

```
file chip
──────────────────────────────────────────────────────────
Total monthly recurring cost      ← the headline card (unchanged position)
──────────────────────────────────────────────────────────
Compared with December 2026       ← the comparison panel (this feature)
  the change list, then the history strip
──────────────────────────────────────────────────────────
Needs an owner                    ← the action list
──────────────────────────────────────────────────────────
Recurring charges                ← the itemised list the total summarises
──────────────────────────────────────────────────────────
Transactions                      ← every raw row, untouched
```

The comparison goes **directly under the headline** and above "Needs an
owner". The order still reads as a sentence: *this is what you pay → this is
what changed → this is who has not claimed it → here is the list → here is the
raw data.*

The comparison panel is **one panel with two parts**, not two panels: the
change list, a hairline, then the history strip. It is quiet enough that the
headline is still the first thing read.

### Mobile (320px)

Same order, stacked, nothing dropped:

```
file chip
Total monthly recurring cost
  $2,406.84 per month
  across 14 recurring charges
Compared with December 2026
  $2,406.84 per month
  +$5.20 more than December
  INCREASED
    CITY POWER & WATER
    $123.40 → $126.10        +$2.70
  12 charges unchanged.
MONTHS ON FILE
  Nov 2026  Dec 2026  Jan 2027
```

The change rows stack the amount under the name at this width, so the row
still reads as one line of intent and one line of numbers. The strip keeps
its three bars; the month labels shorten to `Nov 2026`.

---

## 12. Accessibility

- **The comparison is a `role="region"`** with an accessible name — "Compared
  with December 2026" — so it can be reached by landmark navigation. It is not
  a second `role="status"` region; only the load summary and the owner
  summary are live (§7 of TOTAL.md).
- **The delta line is read as a sentence.** The amount is inside the
  sentence, not beside it: "plus 5 dollars 20, more than December 2026,
  2,401 dollars 64". A bare `+$5.20` reads as "plus 5.20" and as a number
  with no meaning.
- **The change rows are a list.** Each row is a `<li>` in a `<ul>`, so a
  screen reader announces the count and the position. The row's accessible
  name is the full sentence: "City Power and Water, 123 dollars 40, now 126
  dollars 10, up 2 dollars 70."
- **The bars are decorative.** The strip's bars carry `aria-hidden="true"`;
  the months and their totals are text. A bar chart read as a list of
  unlabeled rectangles is noise.
- **Nothing is announced on its own.** The existing `aria-live="polite"`
  regions announce the load and the owner changes. The comparison is
  announced as part of the load summary, in the same sentence as the
  headline, so the two are never announced apart: *"14 recurring charges,
  $2,406.84 per month, up $5.20 from December."*
- **Focus** — "Forget saved history" is a real `<button>`, reachable by
  keyboard, with the house's `:focus-visible` treatment (2px accent outline,
  3px offset).
- **Motion** — the strip's bars do not animate. A bar that grows from
  nothing on every render is a distraction and a vestibular risk for no gain.
- **The comparison does not change the headline's announcement.** The
  headline figure is announced once, with its basis; the comparison is
  announced with the delta.

---

## 13. Retention, and the way out (D4)

- **Twelve months** are kept. The thirteenth month replaces the first, and
  the app says nothing about it — the history strip shows twelve months and
  the user does not need a notice about a month they never saw.
- **"Forget saved history"** is in the comparison panel's footer, always
  visible, never behind a menu. It deletes `spend-audit.months.v1` and
  nothing else — **the owners are not deleted**, because an owner is the
  user's own work and clearing the history should not throw it away.
- After pressing it, the app is back to its first-run state and the copy in
  §9's month 1 applies again.
- The button asks for confirmation, because it is destructive and
  irreversible.

**Why the confirmation matters:** the browser's storage is best-effort. MDN
records that private browsing discards it when the window closes, and that
while Chrome's research shows stored data is very rarely evicted, the
guarantee is best-effort. If a user's history vanishes without warning, the
app's promise — that it knows their months — breaks silently. The "months
saved in this browser" line under the panel is the honest version of that
promise: it says where the data is, every time, not once at the start.

---

## 14. Research findings

Eight primary sources were read. Each is a vendor's own help centre or
documentation, not a review.

| # | Source | What it established |
| --- | --- | --- |
| 1 | [Copilot Money — Cash Flow Tab Overview](https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview) (dated 20 Feb 2026) | A comparison is a **setting on a range**, not a separate view: "a comparison of a selected date range with the same previous range… the dotted line charts the previous period against the current period". Ranges: Year-to-date, Month-to-date, **Last 12 months**, Last 3 months, Last 4 weeks. Also: *"the spending totals seen in the Cash Flow tab may be different than the Categories tab"* — the two-totals trap, from the other side. |
| 2 | [Copilot Money — Understanding Key Metrics for Spending](https://help.copilot.money/en/articles/6918427-understanding-key-metrics-for-spending) (8 Sep 2026) | "For the current year, we do not factor the spend of the current month into this calculation" — a complete-month average excludes the partial month. We take the opposite approach on purpose: the headline is the month you are asking about, not a smoothed average. |
| 3 | [Copilot Money — Recurrings Tab Overview](https://help.copilot.money/en/articles/9778259-recurrings-tab-overview) (1 Sep 2026) | Recurrings are a first-class list, and archived ones are kept — not deleted. A recurring is something with a history, not just a current row. |
| 4 | [Copilot Money — Optimizing Recurrings](https://help.copilot.money/en/articles/3783499-optimizing-recurrings) (27 Aug 2026) | A recurring matches on name, date **and amount range**, so it holds an *expected* amount — which is what makes "paid at a different amount" expressible at all. **The precedent for D1.** |
| 5 | [Monarch — Tracking Recurring Expenses and Bills](https://help.monarch.com/hc/en-us/articles/4890751141908-tracking-recurring-expenses-and-bills) (updated 29 Jun 2026) | Four states in the calendar: green check = paid as expected; **yellow check = "paid, but at a different amount than expected"**; blue = upcoming; red X = missed. The list splits "Upcoming" and "Complete"; there is an **All Recurring** view sorted Active/Canceled; a **Recurring Review** surfaces new merchants. **The precedent for D1 and for "new".** |
| 6 | [Monarch — Cash Flow](https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow), [Using Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports), [Monthly Progress Report](https://help.monarch.com/hc/en-us/articles/4402543752468-Monthly-Progress-Report) | The summary card shows "the raw numbers as well as the saving rate percent". "**The data will begin populating as soon as you import transactions**" — a panel that appears with the data, never a `$0.00`. Chart types include **Trend Bars** ("bar charts that track change over time"); the monthly review shows "Cash Flow Trends (**Last 4 Months**)". **The precedent for the history strip and for the empty-state wording.** |
| 7 | [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) (last modified 5 Jan 2026) | "up to 5 MiB of local storage… per origin". Storage is **best-effort**: private browsing discards it when the window closes; Chrome's research shows stored data is very rarely deleted. **The precedent for the size note and for "forget saved history".** |
| 8 | [LunchMoney — Stats and Trends](https://lunchmoney.app/features/stats-trends) and [Recurring Items](https://lunchmoney.app/features/recurring-expenses) | "statistics in easy-to-read lists, while trends are visualized in colorful charts"; a period picker (last 3 months / a year / custom); recurring items carry a **status** and start/end dates. **The precedent for separating the change list from the history strip.** |

### Sources that could not be read

These four are named in the project notes as comparable products. **None of
them could be read, and nothing in this spec rests on any of them:**

| Source | Why it could not be read |
| --- | --- |
| [YNAB](https://support.ynab.com/) | The glossary is rendered client-side; the raw page returns only its title. Its contents could not be verified. |
| [Rocket Money](https://www.rocketmoney.com/feature/manage-subscriptions) | The crawler is refused (HTTP 403); only the page title is retrievable. Its subscription-management model could not be verified. |
| [Spendee](https://www.spendee.com/) | Only pricing and marketing pages are reachable. Its recurrence model could not be verified. |
| [Simplifi](https://www.simplifi.com/) | `help.simplifi.com` and `support.simplifi.com` do not resolve. Nothing could be read. |

No claim in this document comes from any of these four.

---

## 15. Limits and open questions

**Known limits of what is designed here**

1. **The stored rows are the user's bank data, on their disk, in plain text.**
   Not encrypted, not deleted on a schedule, only by the one button. §3 states
   the trade-off; it is a real cost of this design.
2. **A re-uploaded month is replaced, not merged.** If the user uploads
   November twice with a corrected file, the second replaces the first. If
   they upload a *different* statement that happens to contain November, it
   replaces it. There is no merge and no conflict prompt.
3. **The detector still needs three payments.** Months 1 and 2 show an empty
   list with an explanation. That is honest, and it is still an empty list.
4. **"New" and "no longer charged" cannot appear until month 4.** A
   subscription started in month 2 is named in month 4.
5. **A charge that skips a month is not detected.** The detector's gap band
   is 25–35 days. A quarterly subscription paid in March and June and
   September does not appear at all, at any month.
6. **The history strip is flat on most real months.** Recurring costs do not
   move much, and the strip is honest about that. It becomes interesting
   when something is added or cancelled, which is also when the change list
   is interesting. Neither is redundant.
7. **The comparison is against the previous *calendar* month on file.** If the
   user uploads November, then January, the comparison is January against
   November — two months apart, and the words say "Compared with November
   2026" because the label is generated, not assumed. Gaps are visible.
8. **The storage quota is best-effort.** The browser may clear it. The app
   cannot detect a clear that happened while it was closed; it will simply
   find fewer months than it expected, and the comparison panel will say
   "the same 14 charges in both months" only if it really is.
9. **D2 changes a shipped number.** $2,401.64 becomes $2,404.34 on the
   fixture, and the definition in `design/TOTAL.md` §3 changes from "median"
   to "newest payment". That is a deliberate change with a stated cost, and
   it needs sign-off, not a footnote.
10. **D1 is a relaxation.** It is verified to add no false positives on both
    shipped fixtures, but it is a loosening of a safety rule, and a rule
    loosened once is a rule that can be loosened again. The "one step, up to
    50%" limit is a proposal, not a measurement.
11. **This is desk research and a design.** No user has looked at any of it.
    The claim that people want "what changed" under the headline is a
    reasonable inference from Copilot's and Monarch's own models, not a
    tested finding.

**Open questions**

- Should the price-change rule be stated on the page at all — a one-line
  "a charge that changes price is still a recurring charge" — or is the
  before → after pair enough?
- Should the history strip's bars be scaled from zero (flat when flat) or
  zoomed to the range (a visible slope that exaggerates)? The house answer
  is zero. The user's answer might be zoom. This needs a decision, not a
  preference.
- Should the comparison panel be collapsed by default after month 3, so the
  workspace does not grow every month? The panel is 318px tall on the
  mock; on a real page with 14 charges it would be longer.
- What should happen if the user uploads a file that covers a month already
  on file, with *different* rows? Replace silently, or ask?
- Should "Forget saved history" also forget the owners? The recommendation
  is no — an owner is the user's own work — but the two are both "mine", and
  a user wiping the app may expect both to go.
- Does the headline card need a `title` or a meta description now that the
  number changes monthly? Still per-user and local; still probably not.
- Can the app survive being printed or exported? Not in scope today.

---

## 16. Files

| File | What it is |
| --- | --- |
| `design/09-monthly-rerun.png` | the annotated diagram |
| `design/monthly-rerun.py` | the script that renders it — reuses `render.py`, `recurring.py` and the components from `total-cost.py` |
| `design/check-monthly.py` | the checker that proves the render is sound — no text off the canvas, no text overlapping, nothing leaking out of a panel, every colour from the app's tokens, money never green, red only on an owner flag, the figures still ink, and the totals still equal to the fixture |
| `design/MONTHLY.md` | this document |
| `app/_components/history-store.ts` | *proposed* — read and write `spend-audit.months.v1` |
| `lib/history.ts` | *proposed* — the pure functions: group payments by month, compare two months, the consistency check |
| `app/_components/compare-panel.tsx` | *proposed* — the comparison panel and the history strip |
| `lib/detect-recurring.ts` | *would change* — D1: allow one large step in a series |
| `lib/total.ts` | *would change* — D2: the newest payment, not the median |
| `design/TOTAL.md` | *would change* — §3's definition and the figures throughout |
| `design/total-cost.py`, `design/check-total.py`, `design/RECURRING.md`, `design/qa-total-panel.mjs` | *would change* — the same number, and one word of empty-state copy |
