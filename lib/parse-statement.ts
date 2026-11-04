/**
 * CSV statement parsing.
 *
 * Pure, dependency-free and framework-agnostic so it can be unit tested and
 * reused server-side later. It is deliberately tolerant of the shapes banks
 * actually export: quoted fields, currency symbols, thousands separators,
 * parenthesised negatives, several date formats and separate debit/credit
 * columns.
 */

export type Transaction = {
  /** Stable id: `${isoDate}-${index}`. */
  id: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  description: string;
  /** Negative for money out, positive for money in. */
  amount: number;
};

export type ParseResult =
  | { status: "ok"; transactions: Transaction[]; skippedRows: number }
  | { status: "empty"; transactions: Transaction[]; skippedRows: number }
  | { status: "unreadable"; reason: string };

const DATE_KEYS = ["date", "transaction date", "posted date", "posting date", "trans date"];
const DESCRIPTION_KEYS = [
  "description",
  "details",
  "narrative",
  "merchant",
  "memo",
  "payee",
  "name",
];
const AMOUNT_KEYS = ["amount", "value", "transaction amount", "amount (usd)"];
const DEBIT_KEYS = ["debit", "withdrawal", "money out"];
const CREDIT_KEYS = ["credit", "deposit", "money in"];

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** RFC-4180 style CSV reader: quoted fields, escaped quotes, CRLF. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

function normaliseHeader(cell: string) {
  return cell.trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(headers: string[], keys: string[]) {
  return headers.findIndex((header) => keys.includes(normaliseHeader(header)));
}

function parseAmount(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, "");

  // trailing minus ("19.99-") and currency symbols
  const trailingMinus = /-\s*$/.test(text);
  text = text.replace(/[^0-9.,-]/g, "");

  // thousands separators: keep the last separator if it looks like a decimal
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // 1.234,56 -> European decimal comma
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (lastComma > -1 && text.split(",").length > 2) {
    text = text.replace(/,/g, "");
  }

  const value = Number.parseFloat(text);
  if (Number.isNaN(value)) return null;

  return negative || trailingMinus ? -Math.abs(value) : value;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const stamp = Date.UTC(year, month, day);
  const date = new Date(stamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Accepts ISO, slash dates, "27 Oct 2026" and "Oct 27, 2026". */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    return toIsoDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;

    // Day-first when unambiguous, otherwise US month-first.
    const day = first > 12 ? first : second > 12 ? second : second;
    const month = first > 12 ? second : first;
    return toIsoDate(year, month - 1, day);
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    return toIsoDate(Number(match[3]), month, Number(match[1]));
  }

  match = text.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    return toIsoDate(Number(match[3]), month, Number(match[2]));
  }

  return null;
}

type Columns = {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  hasHeader: boolean;
};

function detectColumns(row: string[]): Columns | null {
  const headers = row.map(normaliseHeader);
  const date = findColumn(headers, DATE_KEYS);
  const description = findColumn(headers, DESCRIPTION_KEYS);
  const amount = findColumn(headers, AMOUNT_KEYS);
  const debit = findColumn(headers, DEBIT_KEYS);
  const credit = findColumn(headers, CREDIT_KEYS);

  if (date > -1 && description > -1 && (amount > -1 || debit > -1 || credit > -1)) {
    return { date, description, amount, debit, credit, hasHeader: true };
  }
  return null;
}

/**
 * Parses a statement into transactions, newest first.
 * Header row is optional: without one we assume `date, description, amount`.
 */
export function parseStatement(text: string): ParseResult {
  const rows = readCsv(text);
  if (rows.length === 0) {
    return { status: "unreadable", reason: "The file has no rows." };
  }

  let columns = detectColumns(rows[0]);
  let startRow = 1;

  if (!columns) {
    // No header: treat the first row as data with positional columns.
    const looksLikeData = parseDate(rows[0][0] ?? "") !== null;
    if (!looksLikeData) {
      return {
        status: "unreadable",
        reason: "No Date, Description or Amount columns were found.",
      };
    }
    columns = { date: 0, description: 1, amount: 2, debit: -1, credit: -1, hasHeader: false };
    startRow = 0;
  }

  const transactions: Transaction[] = [];
  let skippedRows = 0;

  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    const date = parseDate(row[columns.date] ?? "");
    const description = (row[columns.description] ?? "").trim();

    let amount: number | null = null;
    if (columns.amount > -1) {
      amount = parseAmount(row[columns.amount] ?? "");
    }
    if (amount === null && (columns.debit > -1 || columns.credit > -1)) {
      const debit = columns.debit > -1 ? parseAmount(row[columns.debit] ?? "") : null;
      const credit = columns.credit > -1 ? parseAmount(row[columns.credit] ?? "") : null;
      const value = (credit ?? 0) - Math.abs(debit ?? 0);
      amount = value === 0 && debit === null && credit === null ? null : value;
    }

    if (date === null || !description || amount === null) {
      skippedRows += 1;
      continue;
    }

    transactions.push({
      id: `${date}-${i}`,
      date,
      description,
      amount,
    });
  }

  if (transactions.length === 0) {
    if (skippedRows > 0) {
      // Rows existed but none of them were usable.
      return {
        status: "unreadable",
        reason: "Rows were found, but none had a valid date, description and amount.",
      };
    }
    // The columns were understood — there is simply nothing to list.
    return { status: "empty", transactions: [], skippedRows };
  }

  transactions.sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1,
  );

  return { status: "ok", transactions, skippedRows };
}
