// Unit checks for the saved months: what is stored, how a month is filed, and
// the arithmetic of the comparison. No browser involved.
//
// Usage: node design/qa-history.mjs
import {
  HISTORY_LIMIT,
  addMonth,
  allPayments,
  compareMonths,
  emptyHistory,
  mergePayments,
  monthKeyOf,
  monthLabel,
  monthsOnFile,
  parseHistory,
  paymentsToTransactions,
  serialiseHistory,
  shortMonthLabel,
  toCents,
  toStoredPayment,
  totalForMonth,
} from "../lib/history.ts";

let passed = 0;
const failures = [];

function equal(label, actual, expected) {
  const ok = String(actual) === String(expected);
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures.push(`${label}: got ${actual}, expected ${expected}`);
  else passed += 1;
}

function truthy(label, value) {
  console.log(`${value ? "  ok  " : "  FAIL"}  ${label}`);
  if (!value) failures.push(`${label}: expected truthy`);
  else passed += 1;
}

/** A payment, in the shape storage holds it. */
function pay(date, description, cents) {
  return { date, description, amountCents: cents };
}

/** A filed month. */
function month(key, payments, source = `${key}.csv`) {
  return {
    month: key,
    label: monthLabel(key),
    source,
    importedAt: "2026-11-05T10:12:01.000Z",
    payments,
  };
}

// ---------------------------------------------------------------- the labels
console.log("\nlabels");
equal("a month key becomes a full label", monthLabel("2026-11"), "November 2026");
equal("and a short one for the strip", shortMonthLabel("2026-11"), "Nov 2026");
equal("January rolls over the year", monthLabel("2027-01"), "January 2027");
equal("a malformed key is left alone", monthLabel("2026-13"), "2026-13");

// ------------------------------------------------------------- filing a month
console.log("\nfiling a month");
const november = month("2026-11", [pay("2026-11-02", "NETFLIX.COM", -1549)]);
const december = month("2026-12", [pay("2026-12-02", "NETFLIX.COM", -1549)]);
const january = month("2027-01", [pay("2027-01-02", "NETFLIX.COM", -1799)]);

let history = emptyHistory();
history = addMonth(history, january);
equal("a month is filed", history.months.length, 1);
history = addMonth(history, november);
equal("months are kept oldest first", history.months.map((m) => m.month).join(","), "2026-11,2027-01");
history = addMonth(history, december);
equal(
  "three months are in order",
  history.months.map((m) => m.month).join(","),
  "2026-11,2026-12,2027-01",
);

const refiled = addMonth(history, month("2026-11", [pay("2026-11-02", "NETFLIX.COM", -1699)]));
equal("refiling a month does not duplicate it", refiled.months.length, 3);
equal(
  "it replaces the earlier filing",
  refiled.months.find((m) => m.month === "2026-11").payments[0].amountCents,
  -1699,
);

const crowded = Array.from({ length: HISTORY_LIMIT + 3 }, (_, index) =>
  month(`2025-${String((index % 12) + 1).padStart(2, "0")}`, [pay("2025-01-01", "RENT", -100000)]),
).reduce((acc, record) => addMonth(acc, record), emptyHistory());
equal("the history is capped", crowded.months.length, HISTORY_LIMIT);
equal(
  "and the oldest are the ones dropped",
  crowded.months[0].month > "2024-12",
  true,
);

// ------------------------------------------------------------------ storage
console.log("\nstorage");
equal("an empty history serialises", serialiseHistory(emptyHistory()), '{"version":1,"months":[]}');
const round = parseHistory(serialiseHistory(history));
equal("a round trip keeps the months", round.months.length, 3);
equal("and the payments", round.months[2].payments[0].amountCents, -1799);
equal("nothing stored is an empty history", parseHistory(null).months.length, 0);
equal("corrupt JSON is an empty history", parseHistory("{not json").months.length, 0);
equal("a non-object is an empty history", parseHistory("[1,2,3]").months.length, 0);

const tolerant = parseHistory(
  JSON.stringify({
    version: 1,
    months: [
      { month: "2026-11", payments: [{ date: "2026-11-02", description: "A", amountCents: -100 }] },
      { month: "not-a-month", payments: [] },
      { month: "2026-12", payments: "nope" },
      { month: "2026-10", payments: [{ date: "2026-10-02", description: "B", amountCents: "bad" }] },
    ],
  }),
);
equal("a month that is not a month is skipped", tolerant.months.length, 2);
equal(
  "and a payment that is not a payment is skipped",
  tolerant.months.find((m) => m.month === "2026-10").payments.length,
  0,
);
equal("amounts are whole cents", parseHistory('{"version":1,"months":[{"month":"2026-11","payments":[{"date":"2026-11-02","description":"A","amountCents":-100.4}]}]}').months[0].payments[0].amountCents, -100);

// ------------------------------------------------------------ the union
console.log("\nthe union of the months");
equal("every payment is gathered", allPayments(history).length, 3);
equal(
  "months on file are the distinct calendar months",
  monthsOnFile(history).join(","),
  "2026-11,2026-12,2027-01",
);
equal(
  "a file is filed under its newest month",
  monthKeyOf([pay("2026-08-01", "RENT", -100), pay("2026-10-01", "RENT", -100)]),
  "2026-10",
);
equal("no payments means no month", monthKeyOf([]), null);

const transactions = paymentsToTransactions([pay("2026-11-02", "NETFLIX.COM", -1549)]);
equal("cents become dollars", transactions[0].amount, -15.49);
equal("and keep their date", transactions[0].date, "2026-11-02");

equal(
  "duplicate payments are merged",
  mergePayments([
    [pay("2026-11-02", "A", -100)],
    [pay("2026-11-02", "A", -100), pay("2026-11-03", "B", -200)],
  ]).length,
  2,
);

equal("cents round a float", toCents(15.495), 1550);
equal("a transaction becomes a stored payment", toStoredPayment({ id: "x", date: "2026-11-02", description: "A", amount: -15.49 }).amountCents, -1549);

// ------------------------------------------------------------- the comparison
console.log("\nthe comparison");
const groups = [
  {
    key: "CITY POWER WATER",
    name: "CITY POWER & WATER",
    payments: [
      { id: "1", date: "2026-11-03", description: "CITY POWER & WATER", amount: -120.7 },
      { id: "2", date: "2026-12-03", description: "CITY POWER & WATER", amount: -123.4 },
      { id: "3", date: "2027-01-03", description: "CITY POWER & WATER", amount: -126.1 },
    ],
  },
  {
    key: "NETFLIX COM",
    name: "NETFLIX.COM",
    payments: [
      { id: "1", date: "2026-11-02", description: "NETFLIX.COM", amount: -15.49 },
      { id: "2", date: "2026-12-02", description: "NETFLIX.COM", amount: -15.49 },
      { id: "3", date: "2027-01-02", description: "NETFLIX.COM", amount: -17.99 },
    ],
  },
  {
    key: "STABLE",
    name: "STABLE CO",
    payments: [
      { id: "1", date: "2026-11-04", description: "STABLE CO", amount: -40 },
      { id: "2", date: "2026-12-04", description: "STABLE CO", amount: -40 },
      { id: "3", date: "2027-01-04", description: "STABLE CO", amount: -40 },
    ],
  },
  {
    key: "CHEAPER",
    name: "CHEAPER CO",
    payments: [
      { id: "1", date: "2026-11-05", description: "CHEAPER CO", amount: -11.99 },
      { id: "2", date: "2026-12-05", description: "CHEAPER CO", amount: -11.99 },
      { id: "3", date: "2027-01-05", description: "CHEAPER CO", amount: -11.59 },
    ],
  },
  {
    // Charged from January, so it is new against December.
    key: "NEWCOMER",
    name: "NEWCOMER",
    payments: [
      { id: "1", date: "2027-01-06", description: "NEWCOMER", amount: -9.99 },
      { id: "2", date: "2027-02-06", description: "NEWCOMER", amount: -9.99 },
    ],
  },
  {
    // Charged until December, so January has no payment for it.
    key: "GONE",
    name: "GONE CO",
    payments: [
      { id: "1", date: "2026-11-07", description: "GONE CO", amount: -15.49 },
      { id: "2", date: "2026-12-07", description: "GONE CO", amount: -15.49 },
    ],
  },
];

const comparison = compareMonths(groups, "2027-01", "2026-12");
equal("it names the two months", `${comparison.previousLabel} to ${comparison.currentLabel}`, "December 2026 to January 2027");
equal("two charges increased", comparison.increased.map((c) => c.name).join(","), "CITY POWER & WATER,NETFLIX.COM");
equal("one fell", comparison.decreased.map((c) => c.name).join(","), "CHEAPER CO");
equal("one is new", comparison.added.map((c) => c.name).join(","), "NEWCOMER");
equal("one stopped", comparison.stopped.map((c) => c.name).join(","), "GONE CO");
equal("and one did not move", comparison.unchanged, 1);
equal("four are carried across", comparison.carried, 4);

equal("the earlier total", comparison.previousTotal, 206.37);
equal("the later total", comparison.currentTotal, 205.67);
equal("the change", comparison.delta, -0.7);

// The promise: the rows always add up to the difference between the totals.
const rowSum = Math.round(
  [...comparison.increased, ...comparison.decreased, ...comparison.added, ...comparison.stopped]
    .reduce((sum, change) => sum + change.difference, 0) * 100,
) / 100;
equal("the rows add up to the change", rowSum, comparison.delta);
equal(
  "a rise is a positive difference",
  comparison.increased.find((c) => c.name === "NETFLIX.COM").difference,
  2.5,
);
equal(
  "a fall is a negative difference",
  comparison.decreased[0].difference,
  -0.4,
);
equal("a new charge is all increase", comparison.added[0].difference, 9.99);
equal("a stopped charge is all decrease", comparison.stopped[0].difference, -15.49);

// A month with nothing in it is not a zero on the page.
const quiet = compareMonths(groups, "2027-02", "2027-01");
equal("a month where almost nothing was charged is still compared", quiet.currentTotal, 9.99);
equal(
  "the rows still add up",
  Math.round(quiet.stopped.reduce((sum, change) => sum + change.difference, 0) * 100) / 100,
  quiet.delta,
);

// ---------------------------------------------------------------- the strip
console.log("\nthe history strip");
equal("a month's total is its payments", totalForMonth(groups, "2027-01"), 205.67);
equal("an earlier month is its own", totalForMonth(groups, "2026-12"), 206.37);
equal("the newest month matches the comparison", totalForMonth(groups, "2027-01"), comparison.currentTotal);
equal("a month before the charges existed is zero", totalForMonth(groups, "2026-10"), 0);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nfailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failures.length ? 1 : 0);
