# Owner flagging — design for approval

Step 4 of the build plan: *say who each recurring charge belongs to*.

Diagram: `design/07-owner-flagging.png` — the workspace mock, the three
owner-control states, the mobile layout, and the anatomy legend.

This document describes the feature as **built**. Where the diagram and the code
disagree, the code is right; where the code and this document disagree, this
document is a bug report.

---

## 1. The problem

The recurring-charges panel (step 3) tells a household what it pays every month.
It does not say **who** pays it. So the panel can tell you that Adobe Creative
Cloud costs $59.99 a month, and not whether that is your card, Sam's card, or a
charge nobody wants any more.

That is the gap this step closes. Every recurring charge gets a name attached to
it, and the ones that do not have a name are pulled to the top of the page
because they are the only thing on the screen that needs a decision.

The research below (section 8) is the reason the design is shaped the way it is:
every comparable product treats the *known-people roster* as the primary
affordance, and none of them surface "nobody owns this" as a separate screen.

---

## 2. The user story

> As someone looking at a bank statement at the end of the month,
> I want to see the recurring charges nobody has claimed yet, above everything
> else, so I can name them in one pass.
>
> When I am done, I want to see the full list of recurring charges with each
> person's name on it, so I know what the household is actually spending and
> whose money it is.

Two properties matter more than the rest:

1. **Fast triage.** The assignment happens in the list, in place. No dialog, no
   second screen, no modal. A household with fourteen recurring charges should
   be able to clear the flagged list in under a minute.
2. **Nothing is hidden.** The recurring panel still lists *every* charge,
   including the ones that were flagged. Flagging moves a charge to the top of
   the page; it never removes it from the inventory.

---

## 3. What the user sees

### 3.1 The "Needs an owner" section

Sits at the top of the workspace, **above** the recurring-charges panel.

| Part | Content |
| --- | --- |
| Heading | "Needs an owner" |
| Count badge | The number of unowned charges, in flag-soft with flag-red text |
| Right note | A small red dot and "Nobody has claimed these" |
| Row | A small red dot, the merchant name, the evidence line (`12 payments · $719.88 total`), the monthly amount with "per month" under it, and an inline owner control |
| Footer | "Name an owner to clear a charge. It leaves this list and appears in the recurring charges below with their name on it." |

The section is **removed entirely** once every charge has an owner — the
component returns `null` rather than rendering an empty state. There is no
"All good!" card and no placeholder. When there is nothing to do, the page
should look like there is nothing to do.

### 3.2 The owner column on the recurring panel

The recurring panel keeps **all** charges and gains one column at the end of
each row, after the amount:

| State | Rendering |
| --- | --- |
| No owner yet | A dashed-border pill reading "+ Add owner", neutral grey border and muted text |
| Has an owner | A filled soft pill with the owner's name and a small "×" to clear it |

The recurring list is deliberately **not** red. It is a complete inventory, not
a warning. Red appears only where something is genuinely wrong — the count
badge, the per-row marker, and the flagged list's own control.

### 3.3 The three control states

**Unowned.** A dashed neutral pill. Clicking it (or pressing Enter while it is
focused) opens the editor.

**Editing.** The pill is replaced by:

- a small text input, seeded with the current owner (empty if there is none),
  with a `datalist` of the names already in use;
- a soft-green tick button to confirm;
- a grey "×" to cancel.

Enter confirms. Escape cancels.

**Assigned.** A filled soft pill with the owner's name and a small "×" to clear
it. Clicking the pill opens the editor again, seeded with the current name, so
changing an owner is the same gesture as setting one.

### 3.4 Mobile, 320 px

- In the flagged list the amount stays on the merchant's line and the owner
  control drops onto its own line below it.
- In the recurring panel the owner control drops onto its own line below the
  row content.

---

## 4. Interaction flow

### 4.1 Assign

1. The user activates the "+ Add owner" pill (click, Enter, or Space).
2. The pill is replaced by the input, which takes focus. The caret is placed
   at the end of any existing value.
3. The input's `datalist` offers the names already used in this browser.
4. The user types a name — a suggestion, or any name at all.
5. The user presses Enter, or activates the tick button.
6. The name is stored. The charge leaves the flagged list and appears in the
   recurring panel with the name on it.
7. **Focus moves on.** In the flagged list it goes to the next "Add owner"
   button, so the user can keep triaging without reaching for the mouse. If
   that was the last charge, the section disappears and the focus goes to the
   "Recurring charges" heading below.

If the field is empty when confirmed, **nothing is stored** and the control
returns to its previous state. An empty name is not an owner.

If the user clicks away instead of confirming, the editor is dismissed and the
draft is discarded.

### 4.2 Change

Clicking an assigned pill opens the editor with the current name pre-filled and
the caret at the end. Confirming overwrites it. There is no separate "edit"
mode and no confirmation step — changing a name is as cheap as setting one.

### 4.3 Clear

Clicking the "×" on an assigned pill removes the owner outright. The charge
immediately returns to the flagged list. This is not undoable from the pill
itself, but it is trivially reversible by re-typing the name, so no
confirmation dialog is warranted.

### 4.4 Cancel

Escape in the input, or the grey "×" button, abandons the edit. The control
returns to whatever it was before — unowned, or assigned with the old name.
Nothing is stored. Clicking away from the input does the same thing.

### 4.5 When everything is owned

The flagged section unmounts. The recurring panel is now the whole story, and
every row carries a name. The focus moves to the "Recurring charges" heading,
which is where the work has gone.

### 4.6 Replacing the file

Owner names are keyed by **merchant**, not by transaction. Uploading next
month's statement therefore reuses the same names automatically — a household
does not re-type "Sam" every month. Names for merchants that have disappeared
stay in storage and reappear if that merchant comes back.

---

## 5. Data shape

### 5.1 The model

```ts
/** Merchant key to owner name. */
export type OwnerMap = Record<string, string>;
```

The **merchant key** is the same cleaned key the recurring detector groups by
(`merchantKey()` in `lib/detect-recurring.ts`): the description uppercased, with
store numbers, digits, punctuation and the trailing city or state removed. So
`AMAZON WEB SERVICES` is the key `AMAZON WEB SERVICES`, and it is stable across
months and across statements.

### 5.2 The pure helpers (`lib/owners.ts`)

| Function | Purpose |
| --- | --- |
| `parseOwners(raw)` | Read stored JSON, ignoring anything malformed. Returns `{}` for null, unparseable, non-object, or array input, and drops non-string and blank values. |
| `serialiseOwners(owners)` | Write the map back, keys sorted, blank names dropped, so the stored value stays tidy and diffs cleanly. |
| `ownerFor(owners, key)` | The owner of a charge, or `null` when nobody owns it. |
| `knownOwners(owners)` | Every distinct owner name in use, alphabetically — this is the suggestion list. |
| `unownedGroups(groups, owners)` | The recurring charges nobody owns yet. This is what the flagged panel renders. |
| `countUnowned(groups, owners)` | How many of the given charges nobody owns. |

Keeping these pure and in `lib/` rather than in the React hook means they can
be tested against the fixtures without a browser, which is how the rest of this
app is tested.

### 5.3 What the panels receive

```ts
type FlaggedPanelProps = {
  groups: RecurringGroup[];              // only the unowned ones
  roster: string[];                      // names already in use
  onAssign: (key: string, name: string) => void;
  onClear: (key: string) => void;
};

type RecurringPanelProps = {
  groups: RecurringGroup[];              // ALL charges
  totalTransactions: number;
  roster: string[];
  ownerOf: (key: string) => string | null;
  onAssign: (key: string, name: string) => void;
  onClear: (key: string) => void;
};
```

---

## 6. The localStorage contract

### 6.1 Key

```
spend-audit.owners.v1
```

Exported as `OWNERS_STORAGE_KEY` from `lib/owners.ts`. The `.v1` suffix is
there so a future change to the shape can ship under a new key without having
to guess which old values are still readable.

### 6.2 Value

A flat JSON object: **merchant key → owner name**. Both keys and values are
strings.

```json
{
  "AMAZON WEB SERVICES": "Sam",
  "CITY APARTMENTS RENT": "Alex",
  "NETFLIX COM": "Me",
  "VERIZON WIRELESS": "Alex"
}
```

The object is written with `JSON.stringify` over keys sorted by
`localeCompare`, so the stored string is stable for a given set of owners.

### 6.3 Mapping a merchant to an owner

```ts
ownerOf(key)   // -> owners[key] ?? null
```

`ownerFor` trims the stored value and returns `null` if it is empty or not a
string. A charge is **unowned** when `ownerFor(owners, group.key) === null`.

`unownedGroups` is the filter the flagged panel renders from. The flagged list
is therefore never stale — it is derived, not stored.

### 6.4 The suggestion roster

`knownOwners` returns the **distinct values** of the map, trimmed and sorted
alphabetically. Two charges owned by "Sam" produce one "Sam" in the roster.
Case-sensitive: "sam" and "Sam" are two different owners until someone
retires one of them (see the limits, section 9).

### 6.5 Writing

Every change to the map is written back to `localStorage` in an effect. Reads
and writes are both wrapped in `try`/`catch`: private browsing modes and
storage-disabled browsers throw on `localStorage` access, and in that case the
app **still works** — the owners simply live in memory for the session and are
forgotten when the tab closes. Failing silently here is deliberate: an owner
flag is not worth an error dialog over a tool whose whole promise is that
nothing leaves the device.

### 6.6 Privacy

This is a local-only app. Owner names are names of people in the household.
They are stored in the browser and never transmitted. Clearing site data clears
them. This is stated on the page ("Stays on this device — nothing is uploaded")
and should not be changed without updating that line.

---

## 7. Accessibility

### 7.1 Keyboard order

The page order is the visual order:

1. The file chip's controls.
2. The flagged section, row by row, top to bottom.
3. The recurring panel, row by row, top to bottom.
4. The transaction list.

Within a recurring row, the **owner control comes after the disclosure button**
in the DOM. This is deliberate and is the one structural rule worth stating
plainly: the disclosure button is a `<button>` that expands the payments, and a
nested interactive control inside a button is not independently focusable and
cannot be operated by a screen reader. The owner control therefore sits beside
the button as a sibling, not inside it.

Within a flagged row the order is: dot (decorative) → merchant and evidence
(text) → amount (text) → owner control.

### 7.2 Focus

Focus is kept deliberately — a keyboard user triaging a list should never lose
their place.

- Activating the "+ Add owner" pill replaces it with the input, which takes
  focus (`autoFocus`, so it lands as the input mounts).
- The caret is placed at the end of the existing value, so typing replaces the
  tail rather than the start.
- **Confirming or cancelling returns focus to the control.** The pill that
  opened the editor is replaced by the assigned pill, so the control focuses
  its own button. The tick and the cancel button both call
  `preventDefault()` on `mousedown`, which keeps the focus on the input while
  they are clicked and stops the blur handler from eating their click.
- **The assigned pill's name is a button**, labelled
  `"<name> owns <merchant>. Change the owner."`, and it is what the caret
  lands on after a name is confirmed. The pill used to focus its "×" button,
  which parked the caret on a destructive control: a second press of Enter
  undid the name just given. The name is now the control that reopens the
  editor, so confirming is safe and editing is one click away.
- **Leaving the editor dismisses it**, but only when the focus leaves the
  whole control. `onBlur` sits on the wrapper rather than on the input, and
  it checks whether the focus moved somewhere inside the control. Tabbing
  from the input to the tick button therefore keeps the editor open and
  makes the tick and cancel buttons reachable by keyboard; tabbing past the
  control, or clicking away, closes it and discards the draft.
- **In the flagged list, focus moves to the next claim.** A row that has been
  claimed leaves the list, and the button under the caret leaves with it, so
  the panel focuses the next "Add an owner" button instead. If there is no
  next one — because the section has just emptied — focus moves to the
  **"Recurring charges" heading** below, which is where the work has gone.
  Both headings carry `tabIndex={-1}` so they can receive focus
  programmatically without joining the tab order.
- **In the recurring list, the caret stays on the owner control**, whether it
  was just confirmed or just cleared.

### 7.3 ARIA

| Element | Attribute | Value |
| --- | --- | --- |
| Flagged section | `aria-labelledby` | `"flagged-heading"` |
| Flagged heading | `tabIndex={-1}` | So focus can be moved to it programmatically without adding it to the tab order |
| Recurring heading | `tabIndex={-1}` | Same — it is the fallback target when the flagged section empties |
| Flagged count | `role="status"` `aria-live="polite"` (screen-reader only) | "3 recurring charges need an owner." |
| Flagged row marker | `aria-hidden="true"` | The red dot is decorative; the heading already carries the meaning |
| "Add owner" button | `aria-label` | "Add an owner for Amazon Web Services" — the visible text alone would be ambiguous with fourteen identical buttons on the page |
| Owner input | `aria-label` | "Owner for Amazon Web Services" |
| Owner input | `list` | The id of a `<datalist>` holding the roster |
| Confirm button | `aria-label` | "Save owner for Amazon Web Services" |
| Cancel button | `aria-label` | "Cancel owner for Amazon Web Services" |
| Assigned pill | `aria-label` on the "×" | "Remove Sam as owner of Netflix.com" |
| Assigned name | `title` | The full name, for names long enough to truncate |

The section and the panel are `<section>` elements with headings, so they are
landmarks and can be jumped to. The live region is `role="status"` rather than
`role="alert"`: assigning an owner is a routine action and should not
interrupt.

### 7.4 Announcements

- On load, and whenever the statement changes: "N recurring charges need an
  owner." (polite, so it waits for a pause in speech).
- The recurring panel keeps its own existing announcement: "N recurring charges
  found."
- **There is currently no announcement when an owner is assigned or cleared.**
  This is a real gap — see section 9.

### 7.5 Colour and contrast

- The flag red `#b4392b` is used for the count badge, the row markers and the
  flagged list's control. It is never the only signal: every flagged row also
  has a heading and a count badge saying how many there are.
- The unowned pill in the recurring panel is neutral grey and muted text, so
  the recurring list is not a wall of red.
- Money out is ink, never red. Green stays reserved for income and for the
  confirm action, and the owner pill is a neutral warm grey.
- The flag red on flag-soft (`#fbedee`) is used for the count badge's text;
  that pairing measures 5.2:1, above the 4.5:1 required for body text. For
  reference, flag red on white is 5.9:1 and muted on white is 5.1:1.

---

## 8. Research findings

Research was done with the `apify/rag-web-browser` actor over Google, plus
direct fetches of the pages it surfaced. **Six findings are verified from
primary sources** (the vendors' own documentation). Two further points could
not be verified and are marked as such.

### 8.1 Splitwise treats recurring expenses as a first-class feature — but ownership is a *split*, not an owner

Splitwise's own site lists "Recurring expenses" among its headline features,
alongside "Split expenses", "Equal or unequal splits", "Split by % or shares"
and "Categorize expenses". Recurring expenses are a paid (Pro) feature.
<https://www.splitwise.com/>

The mechanism is confirmed on Splitwise's own helpdesk: you tap the date field
when adding a bill and choose how often it repeats, and the app generates the
copies automatically. A long-running feature request on the same forum was
answered by pointing at the existing recurring-bill feature rather than
building anything new.
<https://feedback.splitwise.com/forums/162446-general/suggestions/7802040-recurring-expense>

**What this tells us:** recurring expenses and "who is involved" are modelled
separately and composed. The recurring part is about *when*. The split part is
about *who owes what*. There is no single "owner" concept — because in a group
expense app the payer is one of several people, and the app's job is to work
out the pairwise debts.

**What we took from it:** the split of concerns. Our recurring detection
already answers "when and how much"; ownership is a separate, orthogonal
attribute attached to the same group. Also: recurring bills need no special UI
beyond the group they belong to.

### 8.2 Splitwise's roster is a picker of known people, not free text

A third-party Splitwise help centre (Theory7 — **not** Splitwise's own
documentation, see the caveat below) describes the add-expense flow: you enter
a description and amount, then **select who paid and who is part of the
expense**, and the app divides it evenly by default. Tapping "Split equally"
switches to exact amounts, percentages, or excluding certain people. It also
notes that a member need not use the app — they then receive email updates.
<https://www.theory7.net/support/en-us/tips-tricks/splitwise-app-share-costs-with-friends>

**Caveat:** this is a third-party blog, not Splitwise's own documentation, so
the exact UI wording is not authoritative. The underlying pattern — a roster of
known people, chosen from a list rather than typed — is, however, corroborated
by Splitwise's own feature list (a group with members, split among them).

**What we took from it:** the suggestion list. Free typing is allowed, but the
fast path is picking from people you have already used. Our roster is exactly
this: the distinct owner names already in storage.

### 8.3 Google's family sharing is the closest analogue — and it is per-person, not per-item

Google One's family sharing has one **plan manager** who owns the shared
subscription and a roster of up to five other members who are invited into a
family group. The roster is managed explicitly ("Invite family", "Manage
family group"), and each member's share of the storage is separately
inspectable ("Review which members take up space"). If the manager leaves,
members lose access.
<https://support.google.com/googleone/answer/9004015>

The consumer page sells it the same way: family sharing as an allowance per
plan, with the group sharing one payment method and one set of digital
purchases.
<https://one.google.com/about/>

**What we took from it:** that a shared subscription does not have *one* owner
— it has a roster and a way to see who is on it. Our roster (the distinct
owner names) is the same idea, and our decision to expose the roster as
suggestions rather than as a separate "family" object keeps the model small.

### 8.4 Apple goes further: the owner of a shared subscription can be re-pointed per person

Apple's Family Sharing lets the family organiser pay for everyone's purchases
by default, but **a family member can put their own payment method first so
the organiser isn't paying for their purchases**. Subscriptions are managed
per person under "Manage Family Access".
<https://support.apple.com/en-us/108107>

**What we took from it:** the vocabulary. "Whose is it" is a per-person
attribution of a shared thing, which is precisely the user's phrasing in this
feature's brief — *"this Netflix is mine, the gym is Sam's, Adobe is nobody's"*.
The "×" that clears an owner is the same operation as putting a different
payment method first.

### 8.5 Apple's "Ask to Buy" is the clearest verified example of a *pending* item surfaced to the owner

Apple's Family Sharing includes "Ask to Buy": a member can request a purchase,
and the request goes to the organiser as something they need to approve. The
organiser can approve or decline it.
<https://support.apple.com/en-us/108774>

**What we took from it:** the pattern of a request that is waiting on someone.
Our flagged section is the same shape — a queue of items that are blocked on
one decision — and it justifies pulling them to the top of the page and giving
them a count, rather than burying a status dot in each row.

### 8.6 Vendor patterns for recurring bills support "template with a saved split"

Split The Bill (a vendor blog, so treat as design opinion rather than fact)
describes recurring bills as templates with the split saved on the template,
which regenerate each month with the same split. It also argues for a shared
"house fund" line item for recurring household money, and warns that the
workflow breaks when a roommate changes.
<https://split-the-bill.app/blog/how-to-split-bills-with-roommates>

Settle Up Now's store listing describes expenses as carrying "titles,
categories, receipts, payers, and equal or custom splits", with PDF reports
showing "individual member contributions and shares".
<https://play.google.com/store/apps/details?id=com.a2z.settleupnow>

Adobe's team licensing goes further still: team licences are assigned to named
users through an admin console that can add, transfer or revoke them, whereas
individual licences have no sharing or reassignment capability.
<https://blog.shi.com/next-generation-infrastructure/adobe-creative-cloud-team-versus-individual-licenses/>

**What we took from it:** that a recurring template carries a saved assignment,
which is exactly our "keyed by merchant, so it survives month to month"
decision. Adobe's transfer/revoke is the precedent for our change and clear.

### 8.7 What we could NOT verify

- **No household or expense app was found that surfaces unowned items in a
  separate list.** Every product we checked either requires an owner at
  creation time (Splitwise will not let you save an expense without a payer)
  or models the shared thing as owned by a single account with a roster
  (Google One, Apple). The nearest analogue we found is YNAB's
  "to be categorized" bucket, but its support pages are JavaScript-rendered and
  the actor returned empty bodies, so we could not read the text and are **not**
  citing it as a source. Our top-of-page flagged section is therefore a
  **design inference from the brief, not a copied pattern.**
- **No source was found for a free-text field that suggests already-known
  people.** Splitwise's equivalent is a member picker, not a typeahead. The
  "type freely, get suggestions" combination is our own design, derived from
  the roster pattern in 8.2 and 8.3.
- `web_search` was unavailable in this session, so all research went through
  the Apify actor and direct page fetches. Vendor claims in third-party blogs
  are marked above and are not treated as authoritative.

---

## 9. Limits and open questions

### Limits of what is built

1. **One owner per charge.** A charge cannot be split between two people. The
   research shows the alternative model (Splitwise, Settle Up) is a full
   split-and-settle system with balances, pairwise debts and settlement flows.
   That is a much larger feature and is out of scope here. If a household
   shares one Netflix plan, one of them has to be named as the owner and the
   fact that it is shared is lost.
2. **No announcements on assign or clear.** The live region only announces the
   *count* of unowned charges on load. A screen-reader user who assigns "Sam"
   to Adobe gets no confirmation that it worked. The count does change, but the
   live region's text is only re-rendered when the section re-renders, and
   because the section unmounts entirely at zero it may not announce at all.
   **This should be fixed.**
   — *Fixed after review.* The live region now lives in the workspace rather
   than inside the section, so it survives the section emptying. It announces
   "N recurring charges need an owner." as the count changes and "Every
   recurring charge has an owner." at the end.
3. **After confirming in the recurring list, focus lands on the "×" that
   clears the owner.** The assigned pill is not itself a button — only its "×"
   is — so the control focuses that one. A user who presses Enter to confirm
   and then Enter again, without moving the caret, has just cleared the owner
   they set. The focus is not lost, but it is parked on a destructive control.
   Giving the assigned pill its own button (rather than only a "×") would let
   the focus land somewhere neutral.
   — *Fixed after review.* The name in the assigned pill is now a button that
   reopens the editor, and that is where the caret lands after confirming.
4. **Tabbing out of the editor cancels it.** The input's `onBlur` dismisses
   the editor, and Tab is a blur. Because the tick and cancel buttons sit
   inside the editing subtree, the button the user was tabbing towards is
   removed by the same keystroke, and the focus falls to the document body.
   The two buttons are therefore reachable by pointer but not by Tab, and the
   editor cannot be left with the keyboard without losing the caret. This is
   the one keyboard path the QA script does not cover.
   — *Fixed after review.* The blur handler moved to the wrapper and only
   dismisses the editor when the focus leaves the whole control. Tabbing to
   the tick keeps it open; tabbing past it closes it. The QA script now
   covers both paths.
5. **Names are free text and are case-sensitive.** "sam", "Sam" and "Sam " are
   three owners until the user clears them. `knownOwners` does not
   case-fold, deliberately — "Sam" and "SAM" may genuinely be two people — but
   the roster will show both and it looks like a bug.
   — *Partly fixed after review.* The roster now folds case, so "sam" and
   "Sam" are shown once and offered as one suggestion. The stored owners
   themselves are still free text, so two people who differ only in case can
   still be entered — that is left as a real limit.
6. **The roster is global, not per-charge.** There is no way to say "this is
   one of our shared subscriptions" or to mark a charge as belonging to the
   household rather than a person. The only available answers are a person's
   name or nobody.
7. **Storage can fail silently.** In a private window or with storage
   disabled, the app works but forgets the owners when the tab closes. There is
   no warning, because the alternative is an error dialog in a tool whose
   selling point is that nothing leaves the device. This is a deliberate
   trade-off, but it means "survives between months" is not guaranteed.
8. **Merchant keys are exact.** The key comes from the cleaned description, so
   a statement that writes `AMAZON WEB SERVICES` one month and `AMAZON WEB
   SVC` the next produces two charges with two owner slots. The detector
   deliberately does exact matching (see `design/RECURRING.md` §2) so that
   `AMAZON MARKETPLACE` and `AMAZON REFUND` stay separate — but the cost is
   that owners must sometimes be re-entered when a bank abbreviates.
9. **The flagged list and the recurring panel show the same charges.** A
   charge that is flagged appears in both places. This is intentional (the
   flagged list is a triage view, the panel is the inventory) but it means the
   page shows a merchant name twice until it is assigned.
10. **No undo.** Clearing an owner is immediate and there is no undo toast. It
    is recoverable by re-typing the name, but a stray click loses it.
11. **The datalist is a native browser control.** It cannot be styled, its
    appearance and keyboard behaviour differ between browsers, and it does not
    support a "use this new name anyway" option the way a custom combobox
    would. It is the cheapest thing that works, and it is the part of this
    feature most likely to need replacing.

### Open questions

- **Should a charge be able to have no owner *on purpose*?** "Adobe is nobody's"
  is a legitimate answer — the household may have decided to cancel it. Today
   the only way to express that is to assign it to a person called "Nobody",
   which then shows up in the suggestion roster for every other charge. A
   separate "not ours" state would be cleaner, but it is a second concept in
  the same column and the brief did not ask for it.
- **Should owners be per-charge or per-merchant?** Today a merchant has one
  owner. A household could plausibly want "Netflix is mine, but the family
  plan is Sam's" — same merchant, different months. The merchant key does not
  capture a time range, so this cannot be expressed.
- **Should there be a way to rename an owner across all their charges?** If a
  user types "samm" in one place and "Sam" in another, there is no way to see
  that they are the same person, let alone merge them. A roster management
  screen would need to list every charge each name is attached to.
- **What happens to names for merchants that no longer appear?** They stay in
  storage indefinitely. A "forget unused names" action would be reasonable
  but needs a definition of "unused" (absent from the last statement? absent
  for N months?).
- **Does the flagged section belong above the file chip?** It is currently
  below it, which is right for a summary but means the file chip is the first
  thing a returning user sees. Keeping the count visible next to the file
  name would help.
- **Should the count badge be red at all?** The heading is ink and the badge
  carries the red. A red badge is a stronger signal than a red heading. It
  was kept because the count is the single most actionable number on the
  page, but it is the first thing to revisit if the page feels loud.

---

## 10. Approval checklist

### Verified in the browser

`design/qa-owners-panel.mjs` drives the built feature in headless Chrome
against `test-data/statement-3-months.csv` and checks, at 1440 px and at
320 px:

- the flagged panel appears, is headed "Needs an owner", and counts and lists
  the charges;
- the recurring panel still lists **all** charges — the count does not shrink;
- nothing overflows horizontally at either width;
- an input appears, takes focus, and is labelled;
- Enter assigns; the charge leaves the flagged list; the count follows; the
  recurring panel still has every charge;
- the owner name shows on the row;
- the owner survives a reload and is stored under `spend-audit.owners.v1`;
- clearing returns the charge to the flagged list;
- assigning from the recurring list works, and previous owners are offered as
  suggestions;
- Escape cancels;
- the disclosure button still expands the payments;
- the owner control is **not** nested inside the disclosure button;
- when every charge has an owner the flagged panel is gone and the recurring
  panel is untouched;
- the caret lands on the next claim after assigning, and leaves the vanished
  section for the recurring charges heading when the last one is claimed;
- clicking away dismisses the editor, while tabbing inside it keeps it open
  and reaches the confirm button;
- tabbing past the control closes the editor without dropping the caret;
- confirming does not park the caret on the destructive clear button.

`design/qa-owners-layout.mjs` checks the geometry of both panels at 1440 px,
768 px and 320 px: the flagged panel sits above the recurring panel, the
amount and the control share a line on desktop and the control drops below on
mobile, and nothing overflows at any width.

### Checklist

- [x] The "Needs an owner" section sits above the recurring panel
- [x] It lists only charges with no owner, and is removed entirely when empty
- [x] Each flagged row: marker, merchant, evidence line, monthly amount, inline control
- [x] The recurring panel keeps every charge and gains an owner column at the end
- [x] Unowned = neutral dashed "+ Add owner"; assigned = soft filled pill with "×"
- [x] The editing state: input, suggestions of names already used, confirm button
- [x] Enter confirms, Escape cancels
- [x] Red is used only for the count badge, the row marker and the flagged list's control
- [x] Names are stored in localStorage keyed by merchant, and survive between months
- [x] At 320 px the owner control drops onto its own line
- [x] The owner control is not nested inside the disclosure button
- [x] The stated limits, especially the one-owner-per-charge limit
