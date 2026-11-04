/**
 * Recurring charge detection.
 *
 * Pure, dependency-free and framework-agnostic so it can be tested against the
 * fixtures without a browser. It groups spending that repeats on a monthly
 * rhythm and reports what each group costs.
 *
 * The rules, and why each one is here:
 *
 *   1. Money out only            a cost, not income — payroll must not count.
 *   2. At least three payments   two charges can always be coincidence.
 *   3. Monthly cadence           25-35 days apart, at least four gaps in five
 *                                 land inside that band.
 *   4. Gentle drift only         each payment within 4% of the one before, so a
 *                                 creeping utility bill survives and a shopping
 *                                 swing does not.
 *   5. Present the whole time    present in at least 90% of the months of its
 *                                 own span, so a habit with gaps is rejected
 *                                 while a young subscription is not.
 *
 * Matching is exact on a cleaned description. Fuzzy matching would merge
 * "AMAZON WEB SERVICES", "AMAZON MARKETPLACE" and "AMAZON REFUND", which are
 * three different things.
 */

import type { Transaction } from "./parse-statement";

export type RecurringGroup = {
  /** Cleaned merchant key. */
  key: string;
  /** Display name, taken from the statement. */
  name: string;
  /** How many payments were found. */
  occurrences: number;
  /** How many distinct calendar months they cover. */
  months: number;
  /** The typical payment, taken from the median so one odd month cannot skew it. */
  monthlyAmount: number;
  /** Sum of every payment in the group. */
  total: number;
  /** True when the amounts drifted rather than staying flat. */
  varies: boolean;
  /** The individual payments, newest first. */
  payments: Transaction[];
};

export type RecurringResult = {
  groups: RecurringGroup[];
  /** Payments that were part of a recurring group. */
  recurringCount: number;
  /** Charges that repeat but were rejected, kept for the diagnostics panel. */
  rejected: RejectedCharge[];
};

export type RejectedCharge = {
  key: string;
  name: string;
  occurrences: number;
  reason: string;
};

/** Minimum payments before a charge may be called recurring. */
export const MIN_OCCURRENCES = 3;
/** Largest gap, in days, that still counts as "about a month". */
const MAX_GAP_DAYS = 35;
const MIN_GAP_DAYS = 25;
/** Share of gaps that must land inside the monthly band. */
const MIN_GAP_REGULARITY = 0.8;
/** Largest change between two consecutive payments, as a fraction. */
const MAX_AMOUNT_STEP = 0.04;
/** Share of months in the charge's own span that must contain a payment. */
const MIN_SPAN_COVERAGE = 0.9;

const DAY_MS = 86_400_000;

/**
 * Reduce a statement description to a merchant key.
 *
 * Uppercased, with store numbers, digits, punctuation and the trailing
 * city/state removed.
 */
export function merchantKey(description: string): string {
  return description
    .toUpperCase()
    .replace(/[#*]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/,.*$/, "")
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The merchant name as it should read on screen.
 *
 * Only the noise is removed: store numbers, a trailing number, punctuation and
 * the trailing city or state. The casing the bank used is kept exactly as
 * written, because a tool that handles money has no business renaming a
 * merchant — "Cvs Pharmacy" would be wrong, and the transaction list below
 * shows the same names in the same form.
 */
export function merchantName(description: string): string {
  return description
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*[#*]\s*\d+.*$/, "")
    .replace(/\s+\d{3,}$/, "")
    .replace(/[.,;]+$/, "")
    .trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function dayNumber(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
}

/** Months between two "YYYY-MM" keys, inclusive. */
function monthsBetween(first: string, last: string): number {
  const [firstYear, firstMonth] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  return (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1;
}

type Candidate = {
  key: string;
  name: string;
  items: Transaction[];
  amounts: number[];
  gaps: number[];
  months: Set<string>;
  occurrences: number;
  spanMonths: number;
  spanCoverage: number;
  medianGap: number;
  gapRegularity: number;
  maxStep: number;
};

function collect(transactions: Transaction[]): Map<string, Candidate> {
  const groups = new Map<string, Candidate>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue; // rule 1: money out only

    const key = merchantKey(transaction.description);
    if (!key) continue;

    let candidate = groups.get(key);
    if (!candidate) {
      candidate = {
        key,
        name: merchantName(transaction.description),
        items: [],
        amounts: [],
        gaps: [],
        months: new Set<string>(),
        occurrences: 0,
        spanMonths: 0,
        spanCoverage: 0,
        medianGap: 0,
        gapRegularity: 0,
        maxStep: 0,
      };
      groups.set(key, candidate);
    }

    candidate.items.push(transaction);
    candidate.amounts.push(Math.abs(transaction.amount));
    candidate.months.add(transaction.date.slice(0, 7));
  }

  return groups;
}

function measure(candidate: Candidate): Candidate {
  candidate.items.sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 1; i < candidate.items.length; i += 1) {
    candidate.gaps.push(
      Math.round(dayNumber(candidate.items[i].date) - dayNumber(candidate.items[i - 1].date)),
    );
  }

  candidate.medianGap = candidate.gaps.length ? median(candidate.gaps) : 0;
  candidate.gapRegularity = candidate.gaps.length
    ? candidate.gaps.filter((gap) => gap >= MIN_GAP_DAYS && gap <= MAX_GAP_DAYS).length /
      candidate.gaps.length
    : 0;

  candidate.maxStep = 0;
  for (let i = 1; i < candidate.amounts.length; i += 1) {
    const previous = candidate.amounts[i - 1];
    if (previous === 0) continue;
    const step = Math.abs(candidate.amounts[i] - previous) / previous;
    if (step > candidate.maxStep) candidate.maxStep = step;
  }

  const first = candidate.items[0]?.date.slice(0, 7);
  const last = candidate.items[candidate.items.length - 1]?.date.slice(0, 7);
  candidate.spanMonths = first && last ? monthsBetween(first, last) : 0;
  candidate.spanCoverage = candidate.spanMonths
    ? candidate.months.size / candidate.spanMonths
    : 0;

  return candidate;
}

function rejectReason(candidate: Candidate): string | null {
  if (candidate.occurrences < MIN_OCCURRENCES) {
    return `only ${candidate.occurrences} payment${candidate.occurrences === 1 ? "" : "s"}`;
  }
  if (candidate.medianGap < MIN_GAP_DAYS || candidate.medianGap > MAX_GAP_DAYS) {
    return `payments are ${candidate.medianGap} days apart`;
  }
  if (candidate.gapRegularity < MIN_GAP_REGULARITY) {
    return "the gaps between payments are not even";
  }
  if (candidate.maxStep > MAX_AMOUNT_STEP) {
    return `the amount changes by ${Math.round(candidate.maxStep * 100)}%`;
  }
  if (candidate.spanCoverage < MIN_SPAN_COVERAGE) {
    return `missing ${candidate.spanMonths - candidate.months.size} of ${candidate.spanMonths} months`;
  }
  return null;
}

/**
 * Find the charges that repeat.
 *
 * Money out only, monthly cadence, steady amounts, and present for nearly the
 * whole time they appear for.
 */
export function detectRecurring(transactions: Transaction[]): RecurringResult {
  const groups: RecurringGroup[] = [];
  const rejected: RejectedCharge[] = [];

  for (const raw of collect(transactions).values()) {
    const candidate = measure(raw);
    candidate.occurrences = candidate.items.length;

    const reason = rejectReason(candidate);
    if (reason) {
      rejected.push({
        key: candidate.key,
        name: candidate.name,
        occurrences: candidate.occurrences,
        reason,
      });
      continue;
    }

    const amounts = candidate.amounts;
    const monthlyAmount = median(amounts);
    const total = amounts.reduce((sum, amount) => sum + amount, 0);

    groups.push({
      key: candidate.key,
      name: candidate.name,
      occurrences: candidate.occurrences,
      months: candidate.months.size,
      monthlyAmount,
      total,
      varies: candidate.maxStep > 0.005,
      payments: [...candidate.items].sort((a, b) => b.date.localeCompare(a.date)),
    });
  }

  groups.sort((a, b) => b.monthlyAmount - a.monthlyAmount || a.name.localeCompare(b.name));
  rejected.sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));

  return {
    groups,
    recurringCount: groups.reduce((sum, group) => sum + group.occurrences, 0),
    rejected,
  };
}
