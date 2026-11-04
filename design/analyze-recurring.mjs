// Dev-only: measure the signals that separate real subscriptions from
// frequently-repeated one-off spending, using the real parser.
// Usage: node design/analyze-recurring.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseStatement } from "../lib/parse-statement.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "test-data");

/** Merchant key: uppercase, no store numbers, no city/state tail, no punctuation. */
export function merchantKey(description) {
  return description
    .toUpperCase()
    .replace(/[#*]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/,.*$/, "")
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GROUND_TRUTH = new Set([
  "CITY APARTMENTS RENT",
  "NETFLIX COM",
  "SPOTIFY AB",
  "ADOBE CREATIVE CLOUD",
  "NOTION LABS",
  "FIGMA PROFESSIONAL",
  "PLANET FITNESS",
  "GOOGLE ONE",
  "APPLE ICLOUD",
  "AMAZON WEB SERVICES",
  "CHATGPT SUBSCRIPTION",
  "VERIZON WIRELESS",
  "GEICO AUTO INSURANCE",
  "CITY POWER WATER",
]);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const dayNumber = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

function analyse(transactions) {
  const groups = new Map();

  for (const tx of transactions) {
    if (tx.amount >= 0) continue; // money out only
    const key = merchantKey(tx.description);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const totalMonths = months.size;
  const rows = [];

  for (const [key, items] of groups) {
    items.sort((a, b) => a.date.localeCompare(b.date));
    const amounts = items.map((t) => Math.abs(t.amount));
    const monthSet = new Set(items.map((t) => t.date.slice(0, 7)));

    const gaps = [];
    for (let i = 1; i < items.length; i += 1) {
      gaps.push(Math.round(dayNumber(items[i].date) - dayNumber(items[i - 1].date)));
    }

    const medianGap = gaps.length ? median(gaps) : 0;
    const inBand = gaps.filter((g) => g >= 25 && g <= 35).length;
    const gapRegularity = gaps.length ? inBand / gaps.length : 0;

    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sd = Math.sqrt(
      amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / amounts.length,
    );
    const stepChanges = [];
    for (let i = 1; i < amounts.length; i += 1) {
      stepChanges.push(Math.abs(amounts[i] - amounts[i - 1]) / amounts[i - 1]);
    }

    const firstMonth = items[0].date.slice(0, 7);
    const lastMonth = items[items.length - 1].date.slice(0, 7);
    const [fy, fm] = firstMonth.split("-").map(Number);
    const [ly, lm] = lastMonth.split("-").map(Number);
    const spanMonths = (ly - fy) * 12 + (lm - fm) + 1;

    rows.push({
      key,
      occurrences: items.length,
      months: monthSet.size,
      coverage: monthSet.size / totalMonths,
      spanMonths,
      spanCoverage: monthSet.size / spanMonths,
      medianGap,
      gapRegularity,
      spread: max / min,
      cv: sd / mean,
      maxStep: stepChanges.length ? Math.max(...stepChanges) : 0,
      recurring: GROUND_TRUTH.has(key),
      sample: items[items.length - 1].description,
    });
  }

  return rows.sort((a, b) => b.occurrences - a.occurrences);
}

const pad = (v, n) => String(v).padEnd(n);
const num = (v, n, d = 2) => String(v.toFixed(d)).padStart(n);

for (const file of ["statement-3-months.csv", "statement-12-months.csv"]) {
  const text = await readFile(path.join(dataDir, file), "utf8");
  const result = parseStatement(text);
  if (result.status === "unreadable") throw new Error(`${file}: ${result.reason}`);

  const rows = analyse(result.transactions);
  const months = new Set(result.transactions.map((t) => t.date.slice(0, 7))).size;

  console.log(`\n=== ${file} — ${result.transactions.length} transactions, ${months} months ===`);
  console.log(
    pad("merchant", 30) +
      "occ  span  cover  gap  reg  maxstep  truth",
  );

  for (const r of rows) {
    console.log(
      pad(r.key.slice(0, 29), 30) +
        String(r.occurrences).padStart(3) +
        String(r.spanMonths).padStart(6) +
        num(r.spanCoverage, 7) +
        String(r.medianGap).padStart(5) +
        num(r.gapRegularity, 5) +
        num(r.maxStep, 9) +
        "  " +
        (r.recurring ? "RECURRING" : "one-off"),
    );
  }

  // The proposed rule set: three consecutive months of history, monthly
  // cadence, and amounts that only drift gently.
  const MIN_OCCURRENCES = 3;
  const MAX_STEP = 0.04;
  const MIN_SPAN_COVERAGE = 0.9;

  const evaluate = (label, rule) => {
    const picked = rows.filter(rule);
    const tp = picked.filter((r) => r.recurring).length;
    const fp = picked.filter((r) => !r.recurring);
    const missed = rows.filter((r) => r.recurring && !picked.includes(r));
    console.log(
      `  ${label}: ${tp} correct, ${fp.length} false positive, ${missed.length} missed` +
        (fp.length ? `  [FP: ${fp.map((r) => r.key).join(", ")}]` : "") +
        (missed.length ? `  [missed: ${missed.map((r) => r.key).join(", ")}]` : ""),
    );
  };

  evaluate(">=3 occ, monthly gap, step<=4%, span>=90%", (r) =>
    r.occurrences >= MIN_OCCURRENCES &&
    r.medianGap >= 25 &&
    r.medianGap <= 35 &&
    r.gapRegularity >= 0.8 &&
    r.maxStep <= MAX_STEP &&
    r.spanCoverage >= MIN_SPAN_COVERAGE,
  );

  evaluate("same, but step<=6%", (r) =>
    r.occurrences >= MIN_OCCURRENCES &&
    r.medianGap >= 25 &&
    r.medianGap <= 35 &&
    r.gapRegularity >= 0.8 &&
    r.maxStep <= 0.06 &&
    r.spanCoverage >= MIN_SPAN_COVERAGE,
  );

  evaluate(">=2 occ, monthly gap, step<=4%, span>=90%", (r) =>
    r.occurrences >= 2 &&
    r.medianGap >= 25 &&
    r.medianGap <= 35 &&
    r.gapRegularity >= 0.8 &&
    r.maxStep <= MAX_STEP &&
    r.spanCoverage >= MIN_SPAN_COVERAGE,
  );
}
