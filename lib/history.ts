/**
 * The saved months, and the comparison between two of them.
 *
 * Pure and dependency-free, so it can be tested without a browser.
 *
 * Why this exists: the detector needs three payments of the same charge
 * before it will call anything recurring, and a single month's statement never
 * contains three. So the app keeps every month it is given, in the browser's
 * own storage, and analyses them together. The month just uploaded is then
 * compared against the one before it.
 *
 * What is kept is the payments (date, description, amount) — not a summary of
 * recurring charges. A summary cannot feed the detector, because the detector
 * has to see the payments of charges that are not yet known to repeat.
 *
 * The design and its reasoning are in `design/MONTHLY.md`.
 */

import type { Transaction } from "./parse-statement";

/** Same namespace and pattern as the owners key in `lib/owners.ts`. */
export const HISTORY_STORAGE_KEY = "spend-audit.months.v1";
/** How many months are kept. The oldest is dropped when a thirteenth arrives. */
export const HISTORY_LIMIT = 12;
/** How many months the history strip shows. */
export const STRIP_MONTHS = 6;

export type StoredPayment = {
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  description: string;
  /** Integer cents, negative for money out. Never a float. */
  amountCents: number;
};

export type MonthRecord = {
  /** The month this record is filed under, `YYYY-MM`. */
  month: string;
  /** For the history strip: "November 2026". */
  label: string;
  /** The file it came from, so the user can see what was saved. */
  source: string;
  /** When it was saved, ISO. */
  importedAt: string;
  payments: StoredPayment[];
};

export type MonthHistory = {
  version: 1;
  months: MonthRecord[];
};

export function emptyHistory(): MonthHistory {
  return { version: 1, months: [] };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11" -> "November 2026". */
export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  const name = MONTH_NAMES[index - 1];
  return name ? `${name} ${year}` : month;
}

/** "2026-11" -> "Nov 2026", for the strip where the full name will not fit. */
export function shortMonthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  const name = MONTH_NAMES[index - 1];
  return name ? `${name.slice(0, 3)} ${year}` : month;
}

function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * Read whatever is in storage. Tolerant on purpose: a corrupt or half-written
 * value must not break the app, it must just look like there is no history.
 */
export function parseHistory(raw: string | null | undefined): MonthHistory {
  if (!raw) return emptyHistory();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyHistory();
    const months = (parsed as { months?: unknown }).months;
    if (!Array.isArray(months)) return emptyHistory();

    const clean: MonthRecord[] = [];
    for (const entry of months) {
      if (typeof entry !== "object" || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.month !== "string" || !isMonthKey(record.month)) continue;
      if (!Array.isArray(record.payments)) continue;

      const payments: StoredPayment[] = [];
      for (const payment of record.payments) {
        if (typeof payment !== "object" || payment === null) continue;
        const row = payment as Record<string, unknown>;
        if (typeof row.date !== "string" || typeof row.description !== "string") continue;
        if (typeof row.amountCents !== "number" || !Number.isFinite(row.amountCents)) {
          continue;
        }
        payments.push({
          date: row.date,
          description: row.description,
          amountCents: Math.round(row.amountCents),
        });
      }

      clean.push({
        month: record.month,
        label:
          typeof record.label === "string" && record.label
            ? record.label
            : monthLabel(record.month),
        source: typeof record.source === "string" ? record.source : "",
        importedAt: typeof record.importedAt === "string" ? record.importedAt : "",
        payments,
      });
    }

    return { version: 1, months: sortMonths(clean) };
  } catch {
    return emptyHistory();
  }
}

export function serialiseHistory(history: MonthHistory): string {
  return JSON.stringify({ version: 1, months: sortMonths(history.months) });
}

function sortMonths(months: MonthRecord[]): MonthRecord[] {
  return [...months].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * File a month. A month already on file is replaced, not duplicated — uploading
 * November twice with a corrected file must not leave two Novembers behind.
 */
export function addMonth(
  history: MonthHistory,
  record: MonthRecord,
  limit: number = HISTORY_LIMIT,
): MonthHistory {
  const months = history.months.filter((month) => month.month !== record.month);
  months.push(record);
  months.sort((a, b) => a.month.localeCompare(b.month));
  return { version: 1, months: months.slice(Math.max(0, months.length - limit)) };
}

/** Every payment on file, oldest month first. */
export function allPayments(history: MonthHistory): StoredPayment[] {
  return sortMonths(history.months).flatMap((month) => month.payments);
}

/**
 * The same payments as transactions, so the detector can be run over them.
 *
 * Ids are rebuilt from the date and position: the detector does not use them,
 * and a stored payment has no original index to keep.
 */
export function paymentsToTransactions(payments: StoredPayment[]): Transaction[] {
  return payments.map((payment, index) => ({
    id: `${payment.date}-${index}`,
    date: payment.date,
    description: payment.description,
    amount: payment.amountCents / 100,
  }));
}

/** Merge payment lists, dropping exact duplicates. */
export function mergePayments(lists: StoredPayment[][]): StoredPayment[] {
  const seen = new Set<string>();
  const merged: StoredPayment[] = [];

  for (const list of lists) {
    for (const payment of list) {
      const id = `${payment.date}|${payment.description}|${payment.amountCents}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(payment);
    }
  }

  return merged;
}

/** The distinct calendar months on file, oldest first. */
export function monthsOnFile(history: MonthHistory): string[] {
  const months = new Set<string>();
  for (const month of history.months) {
    for (const payment of month.payments) months.add(payment.date.slice(0, 7));
  }
  return [...months].sort();
}

/** The payment a charge made in one calendar month, or null. */
function paymentInMonth(
  payments: { date: string; amount: number }[],
  month: string,
): number | null {
  const found = payments.filter((payment) => payment.date.startsWith(month));
  if (!found.length) return null;
  // A charge is paid once a month; if a bank has split it, the last one wins.
  const last = found[found.length - 1];
  return Math.abs(last.amount);
}

export type ChargeChange = {
  key: string;
  name: string;
  /** What it cost in the earlier month, or null if it was not charged then. */
  before: number | null;
  /** What it cost in the later month, or null if it was not charged then. */
  after: number | null;
  /** `after - before`, in cents. Never a float drift. */
  difference: number;
};

export type MonthComparison = {
  /** The later month, `YYYY-MM`. */
  currentMonth: string;
  /** The earlier month, `YYYY-MM`. */
  previousMonth: string;
  currentLabel: string;
  previousLabel: string;
  /** What the charges cost in the later month. The headline's own figure. */
  currentTotal: number;
  /** What the same charges cost in the earlier month. */
  previousTotal: number;
  /** `currentTotal - previousTotal`. */
  delta: number;
  increased: ChargeChange[];
  decreased: ChargeChange[];
  /** Charged in the later month, not in the earlier one. */
  added: ChargeChange[];
  /** Charged in the earlier month, not in the later one. */
  stopped: ChargeChange[];
  /** Charged in both, at the same amount. */
  unchanged: number;
  /** Charges present in both months — the note beside the heading. */
  carried: number;
};

/**
 * Compare the newest month on file with the one before it, over the charges
 * that were detected across the whole history.
 *
 * The promise this keeps: the per-charge changes always add up to the
 * difference between the two months' totals. Both sides are the same set of
 * charges, so the arithmetic cannot drift.
 */
export function compareMonths(
  groups: { key: string; name: string; payments: Transaction[] }[],
  currentMonth: string,
  previousMonth: string,
): MonthComparison {
  const increased: ChargeChange[] = [];
  const decreased: ChargeChange[] = [];
  const added: ChargeChange[] = [];
  const stopped: ChargeChange[] = [];

  let currentTotal = 0;
  let previousTotal = 0;
  let unchanged = 0;
  let carried = 0;

  for (const group of groups) {
    const before = paymentInMonth(group.payments, previousMonth);
    const after = paymentInMonth(group.payments, currentMonth);
    const difference = Math.round(((after ?? 0) - (before ?? 0)) * 100) / 100;
    const change: ChargeChange = { key: group.key, name: group.name, before, after, difference };

    if (before !== null) previousTotal += before;
    if (after !== null) currentTotal += after;

    if (before !== null && after !== null) {
      carried += 1;
      if (difference > 0) increased.push(change);
      else if (difference < 0) decreased.push(change);
      else unchanged += 1;
    } else if (after !== null) {
      added.push(change);
    } else if (before !== null) {
      stopped.push(change);
    }
  }

  const bySize = (a: ChargeChange, b: ChargeChange) =>
    (b.after ?? 0) - (a.after ?? 0) || a.name.localeCompare(b.name);

  return {
    currentMonth,
    previousMonth,
    currentLabel: monthLabel(currentMonth),
    previousLabel: monthLabel(previousMonth),
    currentTotal: Math.round(currentTotal * 100) / 100,
    previousTotal: Math.round(previousTotal * 100) / 100,
    delta: Math.round((currentTotal - previousTotal) * 100) / 100,
    increased: increased.sort(bySize),
    decreased: decreased.sort(bySize),
    added: added.sort(bySize),
    stopped: stopped.sort(bySize),
    unchanged,
    carried,
  };
}

/**
 * The total for one month on file, over the charges detected now.
 *
 * Used by the history strip. The newest month's figure is the headline's own
 * number, so the strip and the card can never disagree about this month.
 */
export function totalForMonth(
  groups: { payments: Transaction[] }[],
  month: string,
): number {
  let total = 0;
  for (const group of groups) {
    const amount = paymentInMonth(group.payments, month);
    if (amount !== null) total += amount;
  }
  return Math.round(total * 100) / 100;
}

/** Money in cents, for storage. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** A transaction as a stored payment. */
export function toStoredPayment(transaction: Transaction): StoredPayment {
  return {
    date: transaction.date,
    description: transaction.description,
    amountCents: toCents(transaction.amount),
  };
}

/**
 * The month a set of payments belongs to: the newest calendar month in it.
 *
 * A statement usually covers one month, but a rolling three-month export covers
 * three, and the month it is filed under is the one it ends in.
 */
export function monthKeyOf(payments: { date: string }[]): string | null {
  if (!payments.length) return null;
  let newest = payments[0].date;
  for (const payment of payments) {
    if (payment.date > newest) newest = payment.date;
  }
  return newest.slice(0, 7);
}
