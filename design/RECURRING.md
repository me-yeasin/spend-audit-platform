# Recurring charge detection — design for approval

Step 3 of the build plan: *find what repeats and group it*.
Status: **approved and implemented** (see the commit history). The design below is
what was built, with the one change noted in section 4.

Diagrams:

- `design/05-recurring-charges.png` — where the panel sits, row anatomy, expanded group, mobile
- `design/06-recurring-rules.png` — the five rules and the calibration evidence

---

## 1. What this step delivers

The plan asks for three things, and this step delivers exactly those three:

> It groups them together so the user can see them as a category instead of individual rows.
> It counts how many times each charge appears and shows the total amount for each.

So a new **Recurring charges** panel appears above the transaction list. Each row is one
recurring charge: how many times it was charged, what it costs per month, and what it added up
to across the statement.

Deliberately **not** in this step, because the plan puts them later:

| Feature | Plan step | Why not now |
| --- | --- | --- |
| One big monthly total | 5 | It owns the top of the page; building it here would strand it |
| Owner flags | 4 | Flags attach to these groups, so the group shape must be right first |
| No-owner list | 6 | Depends on flags |
| Monthly re-run | 7 | Depends on the total |

The transaction list is **not** changed by this step. Every raw row stays visible below the
panel, so nothing appears to vanish. The panel is the grouped view, not a replacement.

---

## 2. The rules

A charge is recurring only if it passes all five. Each rule exists because removing it lets a
false positive through, which is measured below.

| # | Rule | Threshold | Why |
| --- | --- | --- | --- |
| 1 | Money out only | `amount < 0` | The plan's number is a *cost*. Payroll must not inflate it |
| 2 | At least three payments | `occurrences >= 3` | Two charges can always be coincidence. Plaid's docs recommend ≥180 days of history for recurring streams ([Transactions API](https://plaid.com/docs/api/products/transactions/#recurring-transactions)) |
| 3 | Monthly cadence | median gap 25–35 days, and ≥80% of gaps inside that band | A monthly charge lands once a month. Weekly and annual cadences are left for a later step |
| 4 | Gentle drift only | every consecutive payment differs from the previous by ≤4% | A utility bill creeps up 2–3% a month and must survive; a shopping swing of 34% must not |
| 5 | Present the whole time | appears in ≥90% of the months between its first and last payment | A habit with gaps is not a subscription |

Rule 5 is measured across the charge's **own span**, not the whole statement. A subscription
that started two months ago is present in 100% of its own two months, so it is still found —
which is why the rule does not punish a young subscription the way a whole-file ratio would.

**Merchant matching** is an exact match on a cleaned description: uppercased, store numbers,
digits, punctuation and the trailing city/state removed. This keeps `AMAZON WEB SERVICES`,
`AMAZON MARKETPLACE` and `AMAZON REFUND` as three separate charges. Fuzzy matching would
merge them, so it is deliberately not used.

---

## 3. Calibration

The fixtures know the truth: `test-data/generate.mjs` creates 14 genuine recurring charges and
7 merchants that merely repeat (`WHOLE FOODS`, `STARBUCKS`, `UBER`, `SWEETGREEN`, `CVS`,
`HOME DEPOT`, `AMAZON MARKETPLACE`). `design/analyze-recurring.mjs` measures the signals and
scores the rules.

| Fixture | Result |
| --- | --- |
| `statement-3-months.csv` | 14 of 14 found, 0 false positives, 0 missed |
| `statement-12-months.csv` | 14 of 14 found, 0 false positives, 0 missed |

The signal that separates the two groups is the size of the biggest jump between consecutive
payments:

| Charge | Payments | Biggest jump | Verdict |
| --- | --- | --- | --- |
| Netflix.com | 12 | 0% | recurring |
| City Power & Water | 12 | 3% | recurring |
| Amazon Marketplace | 10 | 6% | rejected |
| Sweetgreen | 10 | 10% | rejected |
| Uber Trip | 10 | 11% | rejected |
| Cvs Pharmacy | 9 | 16% | rejected |
| Starbucks Store | 10 | 34% | rejected |

Sensitivity — each threshold earns its place:

| Weakened rule | Consequence |
| --- | --- |
| Jump tolerance 4% → 6% | Sweetgreen is accepted |
| Three payments → two | Amazon Marketplace is accepted |
| Gap band ignored | Home Depot and Whole Foods are accepted |

---

## 4. Interface

### Panel

- Sits directly under the file chip, above the transaction list.
- Header: **Recurring charges** with a count pill, and `Largest first` on the right.
- One row per recurring charge, 64px tall on desktop.
- Footer notes how the groups were built.

### Row

| Part | Example | Style |
| --- | --- | --- |
| Merchant | `Netflix.com` | 13.5 semibold, ink |
| Evidence | `12 payments · $185.88 total` | 11.5 regular, muted |
| Cadence | `Monthly` chip, plus `amount varies` when the charge drifts | 10 semibold on `#f1f0e9` |
| Amount | `$15.49` with `per month` underneath | 13.5 semibold, tabular figures |
| Expand | chevron | rotates when open |

The monthly amount is the **median** of the payments, so one odd month cannot skew it.
The evidence line carries the total, which is what the plan asks this step to show.

**One change from the diagram:** merchant names keep the casing the bank used, rather than
being title cased. Automatic title casing turns "CVS" into "Cvs" and "APPLE ICLOUD+" into
"Apple Icloud+", and a tool that handles money has no business renaming a merchant. The
transaction list below already shows the same names in the same form, so the two agree.
Only the noise is removed: store numbers, a trailing number and the trailing city or state.

### Expanded group

Opening a row reveals its individual payments — date and amount — nested underneath. This is
how the plan's "a category instead of individual rows" is satisfied without deleting anything:
the raw payments stay one click away.

### Mobile

Same panel, two-line rows: name and amount on the first line, cadence and payment count on the
second. No horizontal scroll at 320px.

### Empty state

A statement with no repeats shows a calm empty message inside the panel — `No recurring charges
found` with a line explaining that a charge needs three payments a month to be recognised.
The transaction list still renders below it.

---

## 5. Shape of the code

| File | Change |
| --- | --- |
| `lib/detect-recurring.ts` | **New.** Pure function: transactions → groups. No React, no DOM. |
| `lib/parse-statement.ts` | Unchanged. |
| `lib/format.ts` | Added `formatCost` — a cost shown without a sign. |
| `app/_components/recurring-panel.tsx` | **New.** Presentational panel with expandable groups. |
| `app/_components/use-statement-import.ts` | Computes the groups once per import, alongside the parse. |
| `app/_components/home-screen.tsx` | Renders the panel between the chip and the transaction list. |
| `app/_components/icons.tsx` | Added `ChevronIcon`. |
| `design/qa-recurring.mjs` | **New.** Unit checks for the detector against the fixtures. |
| `design/qa-recurring-panel.mjs` | **New.** Browser checks for the panel. |
| `design/contrast.mjs` | Extended to cover the new panel's text. |

The detector stays a pure module so it can be tested against the fixtures directly with Node,
without a browser. That is how the calibration above is measured, and how the same file will be
used by the QA script.

### Data shape

```ts
type RecurringGroup = {
  key: string;          // cleaned merchant key
  name: string;         // display name
  occurrences: number;  // payments found
  months: number;       // distinct months
  monthlyAmount: number; // median payment
  total: number;        // sum of all payments
  varies: boolean;      // amounts drifted
  payments: Transaction[]; // the individual rows
};
```

---

## 6. Known limits, stated plainly

1. **Three months of history are needed.** A brand-new subscription with one or two payments is
   not detected yet. This is a deliberate trade: two charges cannot be told apart from
   coincidence. Plaid asks for 180 days for the same reason.
2. **Only monthly cadence is recognised.** Weekly subscriptions (a gym, a coffee plan) and annual
   ones (insurance, domain renewals) are not detected in this step. Rule 3 can be widened later
   once the monthly path is proven.
3. **A price jump over 4% in one month drops the charge.** Netflix raising its price by $3 on
   $15 is a 19% step and would be missed. We would rather show 13 charges than 14 where one is
   wrong, per the "no false positives" choice — and this is the first rule to revisit if it
   proves too strict in real statements.
4. **The thresholds are calibrated against synthetic fixtures.** The one-off merchants in our
   fixtures drift by only a few percent, which is *tamer* than real shopping. Real statements
   separate more easily than our test data does, so these numbers should hold — but they are
   tuned to our data, not proven against a real bank.
5. `web_search` was unavailable in the session where this was written, so vendor rules beyond
   Plaid's documented history recommendation were not independently verified.

---

## 7. Approval checklist

- [ ] The five rules, including the three-payment minimum
- [ ] Panel above the transaction list, list left unchanged
- [ ] Row anatomy: name, evidence line, cadence chip, monthly amount
- [ ] Median as the monthly amount
- [ ] Expanding a group to reveal its payments
- [ ] Monthly cadence only for now
- [ ] The stated limits, especially the 3-month requirement and the 4% drift ceiling
