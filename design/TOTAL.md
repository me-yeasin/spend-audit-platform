# Total monthly recurring cost — design and spec

Step 5 of the roadmap. This is the headline of the app: one number, in the largest
type on the page, telling the user what they quietly pay every month in repeating
charges.

Built in `app/_components/total-panel.tsx`, with the arithmetic in `lib/total.ts`
and the matching sum repeated in the foot of the list in
`app/_components/recurring-panel.tsx`. The diagram is `design/08-total-cost.png`,
rendered by `design/total-cost.py`.

---

## 1. The user story

> I upload my bank statement. Within a second I want to know one thing: how much
> do I pay every month for things that repeat? Not what I spent in total, not
> what is trending — the standing monthly cost, so I can decide whether it is
> worth cancelling something.

As a returning user, once a month:

> I open the app with last month's file and I want the same number to still be
> there, and I want to see which part of it nobody has agreed to pay for.

The number is the product. Everything else in the workspace exists to let the
user check it or act on it.

---

## 2. Where the card sits

```
file chip
─────────────────────────────────────────────
Total monthly recurring cost      ← the headline card (this feature)
─────────────────────────────────────────────
Needs an owner                    ← the action list
─────────────────────────────────────────────
Recurring charges                ← the itemised list the total summarises
─────────────────────────────────────────────
Transactions                      ← every raw row, untouched
```

The card is the **first thing in the workspace**, above "Needs an owner", above
"Recurring charges", above the transaction list. It is the only thing on the page
that is not a list.

The order is deliberate and reads as a sentence: *this is what you pay → this is
who has not claimed it → here is the list it came from → here is the raw data.*

---

## 3. The number

### What it is

The sum of the **median monthly amount** of every detected recurring charge —
the same figure each row of the Recurring charges panel already shows in its
"per month" column.

```ts
monthly = Σ group.monthlyAmount   // rounded to cents
```

With the test fixtures (`test-data/statement-3-months.csv`, 62 transactions) it
reads:

| Charge | Median monthly |
| --- | ---: |
| CITY APARTMENTS RENT | $1,850.00 |
| GEICO AUTO INSURANCE | $128.50 |
| CITY POWER & WATER | $123.40 |
| VERIZON WIRELESS | $85.00 |
| ADOBE CREATIVE CLOUD | $59.99 |
| AMAZON WEB SERVICES | $42.30 |
| PLANET FITNESS | $24.99 |
| CHATGPT SUBSCRIPTION | $20.00 |
| NOTION LABS | $19.00 |
| NETFLIX.COM | $15.49 |
| FIGMA PROFESSIONAL | $15.00 |
| SPOTIFY AB | $11.99 |
| GOOGLE ONE | $2.99 |
| APPLE ICLOUD+ | $2.99 |
| **Total** | **$2,401.64** |

14 charges. The same figure comes out of the 12-month fixture, because the two
statements hold the same subscriptions — a useful property, not a coincidence:
the tool measures the standing monthly cost, not the cost of the file you
happened to upload.

`CITY POWER & WATER` is the only charge whose amount moves (120.70 → 123.40 →
126.10). Its median is $123.40, which is what the total uses.

### Why it is the sum of the rows

The headline is not a separate calculation of "what you spend per month". It is
literally the addition of the numbers on screen. The user can add up the column
in the list below and get the figure above it. That is the whole trust
mechanism, and it is why the same helper (`sumMonthly`) builds both the
headline and the list footer.

This is not a style preference — it is what the research says to do. Copilot
Money's own help centre warns that "the spending totals seen in the Cash Flow
tab may be different than the Categories tab"
([Cash Flow Tab Overview](https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview)).
Two totals that can disagree destroy confidence in both. Spend Audit must never
be able to produce two different answers to "what do I pay every month".

---

## 4. Exact copy, every state

### 4.1 Recurring charges found

```
Total monthly recurring cost
$2,401.64  per month
across 14 recurring charges
```

With unclaimed money:

```
Total monthly recurring cost
$2,401.64  per month
across 14 recurring charges · $451.15 per month has no owner
```

The separator is `·` (middle dot, U+00B7) with a space either side.

Singular: with one charge the count reads `across 1 recurring charge` and the
live-region sentence reads `across 1 recurring charge`.

**The unclaimed clause only appears when it tells the user something.** It is
rendered when *some* charges have an owner and some do not — that is, when
the figure is a meaningful part of the total rather than the whole of it.

It is deliberately **not** shown in the starting state, where nothing has been
assigned yet. There the line would read

```
across 14 recurring charges · $2,401.64 per month has no owner
```

which prints the headline figure twice in a row and reads like a mistake
rather than a finding. Before the user has named anybody, "everything is
unowned" is not a discovery — it is the state of an untouched list, and the
"Needs an owner" section directly below already says so, item by item. The
clause earns its place the moment claiming starts: it then reports the part
of the bill that nobody has taken responsibility for, which is the number the
user is actually looking for.

### 4.2 Every charge has an owner

The `· $451.15 per month has no owner` clause disappears entirely. The line ends
at `across 14 recurring charges`. Nothing replaces it — there is no "all
claimed" badge, no tick, no green. Green is reserved for income, and the
absence of a flag is not a thing that needs celebrating. The disappearance of
the whole "Needs an owner" section is itself the confirmation that there is
nothing left to do.

### 4.3 No recurring charges

```
Total monthly recurring cost
No recurring charges found
Nothing repeats in this statement yet, so there is nothing to total.
```

Deliberately **not** `$0.00`. `$0.00 per month` is a claim: it says you pay
nothing. The truth is that the statement did not contain enough repetition for
the detector to be confident, which is a different statement entirely. The
Recurring charges panel already uses the same wording
(`No recurring charges found`, `app/_components/recurring-panel.tsx:78`), so the
two sections agree in voice.

The empty state keeps the same label, the same card, the same padding. Only the
content changes. The card never collapses or disappears — its position at the
top of the workspace is structural.

### 4.4 The list footer

The Recurring charges panel footer carries the same number, on the right:

```
14 recurring charges grouped from 62 transactions        $2,401.64 per month in total
```

Left in subtle (11.5px), right in ink-soft with the amount in semibold
`tabular-nums`. This is the second place the number appears, and it is what
makes the card and the list read as one thing rather than two cards that
happen to be adjacent.

### 4.5 The whole panel in one place

For reference, the exact strings, with the separator marked:

| Slot | String |
| --- | --- |
| Label | `Total monthly recurring cost` |
| Figure | `$2,401.64` (from `formatCost`, en-US USD, always two decimals) |
| Unit | `per month` |
| Context | `across 14 recurring charges` |
| Separator | `·` |
| Unclaimed | `$451.15 per month has no owner` — only when some charges are owned and some are not |
| Empty heading | `No recurring charges found` |
| Empty body | `Nothing repeats in this statement yet, so there is nothing to total.` |
| Footer left | `14 recurring charges grouped from 62 transactions` |
| Footer right | `$2,401.64 per month in total` |

---

## 5. Typography

Geist Sans only. All sizes in px, as Tailwind arbitrary values.

| Element | Weight | Size | Colour | Notes |
| --- | --- | --- | --- | --- |
| Label | 500 | 12 | `muted` `#6e6e66` | `tracking` normal |
| Figure | 600 | 44 desktop / 32 mobile | `ink` `#12120f` | `tracking-[-0.02em]`, `tabular-nums`, `leading-[1.1]` on sm+ |
| Unit "per month" | 400 | 13 desktop / 12.5 mobile | `subtle` `#73736a` | baseline-aligned with the figure |
| Context line | 400 | 12 | `subtle` `#73736a` | the unclaimed clause switches to `flag` `#b4392b` |
| Empty heading | 600 | 28 desktop / 24 mobile | `ink-soft` `#3a3a34` | `tracking-[-0.01em]` |
| Empty body | 400 | 12 | `subtle` `#73736a` | |
| Footer left | 400 | 11.5 | `subtle` | |
| Footer right amount | 600 | 11.5 | `ink-soft` | `tabular-nums` |

**Scale at each breakpoint**

- **Desktop (≥640px)** — figure 44px. It is the largest type on the page by a
  wide margin: the next largest text in the workspace is the 15px panel
  headings, so the figure is nearly 3× them. That ratio is the point. If the
  gap ever closes, the card has stopped being the headline.
- **Mobile (<640px)** — figure 32px. Still comfortably the largest type on the
  screen (panel headings are 15px). 32px was chosen over a smaller step so the
  number still reads as a headline at 320px, where the card is 280px wide.

**The unit is baseline-aligned, not optically aligned.** The figure and "per
month" sit on the same baseline (`flex items-baseline gap-2`). "per month" is
13px next to a 44px figure, which is roughly a 3.4:1 ratio — small enough to
read as a caption, large enough not to look like a footnote.

**Tabular figures.** `tabular-nums` on the figure, on the footer amount and on
the row amounts. Without it the digits of `$2,401.64` shift sideways when the
number changes on a new upload (a `1` is narrower than a `2` in a proportional
font), and a headline that visibly jitters when the file changes reads as
unstable.

**Money is always ink.** Money out is never green. Green (`#0e7c5a`) is
reserved for income and for the confirm action in the owner control. The total
is money leaving the account, so it is ink like everything else on the card.

**Letter-spacing.** The figure is `tracking-[-0.02em]` (−0.88px at 44px).
Large figures with default tracking look loose and unconsidered; a slight
negative track tightens the group and reads as one number rather than a row of
digits.

### Contrast

Measured against the card surface `#ffffff`:

| Colour | Ratio | AA (normal text) |
| --- | ---: | --- |
| `ink` `#12120f` on white | 17.4:1 | pass |
| `muted` `#6e6e66` on white (the label) | 5.1:1 | pass |
| `subtle` `#73736a` on white (unit + context) | 4.8:1 | pass |
| `flag` `#b4392b` on white (the unclaimed clause) | 5.9:1 | pass |

The label is `muted` and the rest of the supporting text is `subtle`. That is a
deliberate two-step: the label is what the card *is*, the context line is
supporting detail. The `flag` red passes AA as normal text at 12px, so the
unclaimed clause is not relying on colour alone to be readable — the words
"has no owner" carry the meaning if the colour is missed.

The app has a `design/contrast.mjs` checker; the same tokens should be run
through it if any of the greys above change.

---

## 6. Layout

The card is the standard panel: `rounded-[20px] border border-hairline
bg-surface`, with the same shadow the other panels use.

```
padding:  px-5 py-5   (mobile)
          px-6 py-6   (desktop)
label → 6px → figure + unit → 10px → context line
```

The gap between the label and the figure is `mt-1.5` (6px); between the figure
and the context line `mt-2.5` (10px). The figure's own `leading-[1.1]` keeps
its line box tight so the card does not feel airy. At 320px the card is 280px
wide and the label, the figure and the context line stack — the figure and
"per month" stay on one line because `$2,401.64 per month` at 32px is about
202px, inside the 240px of content width.

---

## 7. Accessibility

### What the figure is

The figure is a `<span>` inside a `<p>`, inside a `<section>` labelled by the
`<h2 id="total-heading">` whose text is the visible label. The heading is a
real heading at level 2, so screen readers announce "Total monthly recurring
cost, heading level 2" and the number follows in the same region.

The DOM order is: label (h2) → `$2,401.64` → `per month` → `across 14
recurring charges`. Read linearly, that is "Total monthly recurring cost, two
thousand four hundred one dollars and sixty-four cents, per month, across
fourteen recurring charges" — a complete sentence with no markup needed.

**The figure is a currency amount, and it is read as one.** `formatCost` uses
`Intl.NumberFormat("en-US", { style: "currency", currency: "USD",
minimumFractionDigits: 2, maximumFractionDigits: 2 })`, so the text is
`$2,401.64` — a symbol, a grouped integer and two decimals. Screen readers
announce that as a currency amount. `Math.abs` is applied, so the value is
always positive and never carries a `+` or `−` sign; the direction of the money
comes from the context, not from a sign.

### `aria-live` behaviour

The card does **not** hold a live region of its own. The workspace keeps two
visually hidden regions on the page from the start — one for what was loaded,
one for what still needs an owner:

```tsx
<div role="status" aria-live="polite" className="sr-only">
  {loadSummary}
</div>
<div role="status" aria-live="polite" className="sr-only">
  {ownerSummary}
</div>
```

`role="status"` implies `aria-live="polite"`, so neither ever interrupts the
user. The first reads:

> "62 transactions loaded, newest first. 14 recurring charges, $2,401.64 per
> month."

and the second:

> "14 recurring charges need an owner."

The announcements are full sentences, not bare numbers: "$2,401.64" with no
unit and no count is much harder to act on when heard without the screen.

**Why the regions live outside the panels.** A live region is only reliably
announced when its text changes *after* it exists. A region mounted already
populated — which is what happens when the workspace appears on the first
upload — is usually silent. So both regions are rendered on the landing page
too, empty, and are already on the screen by the time a file is read. The
first total is therefore announced with the first upload.

The two regions are split so that each change is said once: the load summary
changes when a file is read, the owner summary changes when a charge is
claimed. Assigning an owner does not re-announce the total, and loading a
file does not re-announce the whole owner list.

### Landmarks

`TotalPanel` renders `<section aria-labelledby="total-heading">`, so the
region's name comes from the visible heading. The wrapper that gives it
spacing in `home-screen.tsx` is a plain `<div>`, not a `<section>` with an
`aria-label` of its own — otherwise the page would list "Total monthly
recurring cost" **twice** in the landmark list, one region inside the other.

The same rule applies to every panel on the page: the spacing wrappers in
`home-screen.tsx` are plain `<div>`s, and each panel names itself from its own
heading. No two landmarks on the page share a name, which is checked by
`design/interactions.mjs`.

### The unclaimed clause

It is a `<span class="text-flag">` inside the context paragraph — one text
node, no separate list, no role. It is read inline: "across 14 recurring
charges, $451.15 per month has no owner." The red is a reinforcement, not the
message; the words carry it.

### Keyboard and pointer

There is nothing to focus in the total card. It is static text with no
controls, so it adds no tab stops and does not interrupt the Tab order that
runs file chip → owner controls → recurring rows → transaction rows.

### Focus and motion

No focus ring is needed (nothing is focusable) and nothing animates. When the
number changes on a new upload it changes instantly — an animated count-up
would be a nice touch but would fight the `tabular-nums` requirement and
would delay the live-region announcement.

---

## 8. Empty states

| Situation | What the card shows |
| --- | --- |
| No recurring charges found | `No recurring charges found` + `Nothing repeats in this statement yet, so there is nothing to total.` |
| Recurring charges found, none assigned yet | Figure + `per month` + `across N recurring charges` |
| Recurring charges found, all owned | Figure + `per month` + `across N recurring charges` |
| Recurring charges found, some unowned | Figure + `per month` + `across N recurring charges · $X per month has no owner` |
| No file uploaded yet | The card is not rendered at all — the workspace does not exist until a file is imported, and the landing screen keeps its own hero. |

The first two rows read the same on purpose. Until the user has named anybody,
the whole of the total is unclaimed, and repeating the headline figure as an
unclaimed figure says nothing that the "Needs an owner" list below does not
already say more clearly. The clause appears at the point where it starts
describing a *part* of the bill rather than all of it.

The empty state is calm and honest: it names what was looked for and says why
there is no number, without apologising and without a false zero.

---

## 9. The second fact: should the unclaimed figure be there?

**Recommendation: keep it, quiet, on the same line.** The research supports
the pattern; it just does not support putting a breakdown inside the card.

Why it earns its place:

- It answers a genuinely different question. The headline is "what do I pay".
  The unclaimed figure is "how much of that has nobody agreed to pay for".
  A user who names owners is trying to change the second number; the first
  number will not move. Both need to be visible at once.
- It is a **subset** of the headline, never a restatement of it. That
  relationship is legible at a glance and it is checkable: the unclaimed
  figure must always be smaller than or equal to the figure above it.
- Every comparable app puts the headline and its breakdown in *different*
  places, not in the same card — see finding 4 below. The unclaimed figure is
  the one place where Spend Audit can answer two questions in one line
  without a chart, a sparkline or a second card.

Conditions that keep it from becoming noise, all of which the build already
meets:

1. Same line as the count, same 12px. Never a second large number.
2. Same red as the owner flag, and no badge, no bold, no background. It must
   not pull more attention than the figure.
3. Only rendered when there is something unowned. When everything is claimed
   the clause disappears rather than showing `$0.00`.
4. Always a subset of the headline.
5. It is never the first thing a user sees — the "Needs an owner" panel
   directly below is where the action is, and the number only tells the user
   how much the action is worth.

**The one case I would change.** On a fresh import, before anybody has claimed
anything, the unowned figure *equals* the headline: the card reads "across 14
recurring charges · $2,401.64 per month has no owner", which prints the same
number twice on one line and says nothing the count does not already imply.
The clause should be suppressed when the unowned amount equals the total
(nothing claimed yet) — it carries no information there, and the "Needs an
owner" section below already says it in full. This is a one-line change to
`total-panel.tsx` and it is the only change I would make to the card.

**What I would not add.** A percentage ("19% has no owner"), a second large
figure, a mini bar, a per-category breakdown, or a trend line against last
month. All of them turn one honest number into a dashboard, and the research
shows the apps that do that are the ones whose headline nobody trusts.

---

## 10. Research findings

All URLs were fetched during this task. Where a page's body text is rendered
client-side and could only be read through the server-rendered description, or
where a source could not be reached at all, that is stated plainly.

### 1. The headline is a *named* quantity, never a bare amount

Copilot Money puts "Free to Spend" at the top of its spending-progress graph,
written as "ex: *$1,380 left*" — the figure always arrives with the word that
says what it is and what it means.

> "The top of the Dashboard tab features a graph with spending progress for the
> month. At the top of this graph is the **Free to Spend** value (ex: _$1,380
> left_)."
> — <https://help.copilot.money/en/articles/6045480-dashboard-tab-overview>

Rocket Money makes the same move: "Safe to Spend … turns all your spending data
into one simple answer: exactly how much you can afford to spend right now
without compromising your financial obligations", and ships it as a home-screen
widget as well.

> <https://www.rocketmoney.com/learn/personal-finance/tracking-expenses-with-rocket-money>

**Applied here:** the figure is never alone. It sits under the label "Total
monthly recurring cost", it is followed by the unit "per month", and it is
followed by a count. A user who sees only "$2,401.64" learns nothing; a user
who sees the whole card learns everything.

### 2. Secondary figures exist, but they live one level down, and they are defined in words

Copilot's "Key Metrics" are "Total spent per year" and "Average monthly
spend", each with a written definition — and the average deliberately excludes
the current month.

> "To calculate your average monthly spend, we sum all complete months and
> divide by the number of complete months to determine your average monthly
> spend per year. … **For the current year, we do not factor the spend of the
> current month into this calculation** for a more accurate view of average
> monthly spend for a complete month."
> — <https://help.copilot.money/en/articles/6918427-understanding-key-metrics-for-spending>

**Applied here:** our one secondary figure (the unclaimed amount) is defined by
its own sentence — "$451.15 per month has no owner" — rather than being left
for the reader to interpret. It is not a percentage or a trend, both of which
need explanation.

### 3. Two totals that can disagree are the single most damaging thing a spending app can do

> "the spending totals seen in the Cash Flow tab may be different than the
> Categories tab"
> — <https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview>

**Applied here:** the headline and the list footer are built from the same
function (`sumMonthly`), so they are the same number by construction. This is
the reason the footer repeats the total rather than a rounded variant of it.

### 4. The headline and the breakdown live in different surfaces — not in the same card

Monarch's dashboard is a set of peer widgets the user can reorder and remove:
"Getting started guide, Weekly Recap, Investments, Budget, Net worth, Savings
goals, Credit score, Spending trend, Transactions, **Recurring Transactions**,
Business tracking". Recurring transactions get their own page, with a monthly
calendar or list view and an "All Recurring" list "sorted by 'Active' and
'Canceled'".

> <https://help.monarch.com/hc/en-us/articles/360058127551-Customizing-Your-Dashboard>
> <https://help.monarch.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills>

**Applied here:** this is the direct answer to "should the itemised list go
inside the total card?" — no. Every app that shows both puts the breakdown on
its own surface. Spend Audit's "Recurring charges" panel *is* that surface,
and it sits immediately below. Putting 14 rows inside the headline card would
make the page twice as long and state the same fact twice on screen.

What those apps *do* instead is put a summary and a list side by side —
Monarch's mobile recurring view shows "a summary card and a list of all
upcoming recurring transactions" — which is the same move as repeating the
total in the list footer.

### 5. When a second figure is shown, it is a different quantity and it is qualified

Monarch's Cash Flow summary card shows income, total spent and the difference
between them, "as well as the saving rate percent in the summary card" — a
different measure (net, a rate) rather than a subset of the headline.

> <https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow>

**Applied here:** the unclaimed figure is a *subset* of the headline, which is a
different relationship from Monarch's net-of-income. It is the right shape for
our question, but it means the subset relationship has to be explicit — which
is why the phrase says "has no owner" rather than being a bare second number.

### 6. A headline that can change state needs colour with a defined meaning, and the colour is earned

YNAB's "Ready to Assign" has "four states", and the glossary explains what
each one means: "If your Ready to Assign is red, you've overassigned. This
means you need to remove money from your categories until it's back to zero."
Its per-category column is "Available", described as "the money you have
available to spend".

> <https://support.ynab.com/en_us/ynab-glossary-a-guide-BJd80SORq>
> <https://support.ynab.com/en_us/assigning-your-money-a-guide-SypgkrNJi>
> *(Both pages render their body text client-side; the quotations above are
> those pages' own server-rendered descriptions, which were retrieved in full.
> The full article bodies were not readable from this environment.)*

**Applied here:** red means exactly one thing in Spend Audit — a charge
somebody has not claimed. The unclaimed figure uses it, the "Needs an owner"
dot uses it, the count badge uses it. Because red is reserved, the one red
number in the headline card reads instantly.

### 7. Currency symbol placement is a real localisation problem, and decimal alignment is undocumented

Splitwise's support team, on a request to support other locales:

> "Many languages uses ',' for decimal divider and the SEK symbol 'kr' is
> placed after the amount: '1,5 kr' instead of 'kr 1.5'"
> — <https://feedback.splitwise.com/forums/162446-general/suggestions/5565305-better-internationalization>

Splitwise's summary of balances is also a per-person breakdown — "an overview
of how much someone owes to someone else for which reason" — rather than one
total, and the monthly total sits in a separate "Trends" view.

> <https://feedback.splitwise.com/forums/162446-general/suggestions/3330296-detailed-summary-of-debts>

**Applied here:** Spend Audit is USD-only by design (multi-currency is
explicitly out of scope), and the symbol always precedes the number. But
`tabular-nums` is not a nicety — it is what stops the decimals from moving
underneath the symbol when the figure changes between months.

### 8. No verified example of any of these apps rendering "$0.00" as a headline

Monarch's closest documented behaviour is that the report is available before
any data exists: "The data will begin populating as soon as you import
transactions or sync your first financial account into Monarch." The panel is
present; the numbers are not.

> <https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow>

**Unverified:** I found no primary source describing any of the five apps
rendering a literal "$0.00" headline in its empty state. The observation that
they avoid it is an inference from the Monarch wording above, not a documented
statement. The design decision not to show "$0.00" rests on the argument in
§4.3, not on this finding.

### 9. Splitwise's dashboard typography could not be verified

`splitwise.com`'s landing page is marketing copy with no UI detail, and the
Splitwise help centre domain (`help.splitwise.com`) does not resolve from this
environment. **Marked unverified:** any claim about the size of Splitwise's
balance number, or its position on the page. Findings 7 above use Splitwise's
own support forum, which was reachable, and make no claim about type scale.

---

## 11. Limits and open questions

**Known limits of what is built**

1. ~~**The first total may not be announced.**~~ **Fixed.** The two live
   regions now live on the workspace, outside the panels, so they exist before
   the first file is read and the first upload is announced. (§7)
2. ~~**Two landmarks named "Total monthly recurring cost".**~~ **Fixed.** The
   spacing wrappers are plain `<div>`s; each panel names itself from its own
   heading, and no two landmarks share a name. (§7)
3. ~~**The context line can break mid-phrase on a narrow screen.**~~ **Fixed.**
   The two facts are flex items that stack below 640px, so the flag clause gets
   its own line instead of breaking inside a phrase.
4. ~~**The separator can start a line.**~~ **Fixed** with the same change: the
   `·` is hidden below 640px, where the two facts are on separate lines.
5. **The figure's leading is now set at every size.** `leading-[1.1]` applies at
   both 32px (mobile) and 44px (desktop), so the card does not change its
   rhythm between breakpoints.
6. **`formatCost` is fixed to en-US USD** while dates use en-GB
   ("27 Oct 2026"). Consistent with the no-multi-currency scope, but the mix is
   visible.
7. **The total is a median, not a true monthly rate.** A charge that repeats
   every month but grew every month (120.70 → 123.40 → 126.10) contributes its
   median ($123.40) to a total that will actually be $126.10 next month. The
   sum is honest about the *current* standing cost, not a forecast.
8. **The total is only as good as the detector.** A charge that repeats twice a
   month, or whose amount drifts more than 4% between payments, is not counted.
   The card says "14 recurring charges", not "your monthly commitments", and
   the label "recurring cost" is doing real work in that sentence.
9. **The unclaimed figure depends on browser local storage.** On a new device
   nothing is claimed yet, so the clause is not shown at all — see §4.1 for why
   it is suppressed in that state.
10. **The owner state is per merchant key, not per statement.** If a merchant
    is renamed by the bank between months the key changes and the owner is
    lost. Not caused by this feature, but it changes the number in the flag
    clause.

**Open questions**

- Should the card be the only thing on the landing screen before a file is
  uploaded, or does it stay absent until there is something to total? Currently
  absent.
- Should the total appear in the page title or a meta description? Probably
  not — it is per-user and local — but worth a decision.
- Is there a case for showing the **previous** month's total next to this one
  ("$2,401.64, up $42.10 from last month")? That is step 7, monthly re-run,
  and it needs a place to live that does not crowd this card. The honest answer
  from the research is that it belongs in its own comparison, not as a second
  figure here.
- Should the unclaimed clause be dropped entirely if research with real users
  says people read it as a second headline? The research here is desk research
  only; no user testing has been done.
- Does the card need to survive being printed or exported to a PDF? Not in
  scope today.

---

## 12. Files

| File | What it is |
| --- | --- |
| `app/_components/total-panel.tsx` | the card |
| `lib/total.ts` | `sumMonthly` and `summariseRecurring` — the arithmetic |
| `app/_components/home-screen.tsx` | where the card sits in the workspace |
| `app/_components/recurring-panel.tsx` | the footer that repeats the sum |
| `design/08-total-cost.png` | the annotated diagram |
| `design/total-cost.py` | the script that renders it |
| `design/check-total.py` | the checker that proves the render is sound — no text off the canvas, no text overlapping, nothing leaking out of a panel, the figure still ink and the unclaimed clause still flag red, and the total still equal to the fixture |
| `design/TOTAL.md` | this document |
