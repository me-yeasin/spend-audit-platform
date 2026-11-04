// Generates bank-statement fixtures for testing the upload card states.
// Run: node test-data/generate.mjs
import { mkdir, writeFile } from "node:fs/promises";

const OUT = new URL("./", import.meta.url);

const pad = (n) => String(n).padStart(2, "0");
const money = (n) => (n < 0 ? "-" : "") + Math.abs(n).toFixed(2);
const csvCell = (value) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const HEADER = "Date,Description,Amount";

/** Recurring charges: same description and amount every month. */
const RECURRING = [
  { day: 1, name: "CITY APARTMENTS RENT", amount: -1850.0 },
  { day: 2, name: "NETFLIX.COM", amount: -15.49 },
  { day: 3, name: "SPOTIFY AB", amount: -11.99 },
  { day: 5, name: "ADOBE CREATIVE CLOUD", amount: -59.99 },
  { day: 6, name: "NOTION LABS", amount: -19.0 },
  { day: 7, name: "FIGMA PROFESSIONAL", amount: -15.0 },
  { day: 8, name: "PLANET FITNESS", amount: -24.99 },
  { day: 9, name: "GOOGLE ONE", amount: -2.99 },
  { day: 10, name: "APPLE ICLOUD+", amount: -2.99 },
  { day: 12, name: "AMAZON WEB SERVICES", amount: -42.3 },
  { day: 14, name: "CHATGPT SUBSCRIPTION", amount: -20.0 },
  { day: 20, name: "VERIZON WIRELESS", amount: -85.0 },
  { day: 22, name: "GEICO AUTO INSURANCE", amount: -128.5 },
];

/** Variable but recurring: the utility bill lands every month, amount drifts. */
const utilityBill = (monthIndex) => ({
  day: 18,
  name: "CITY POWER & WATER",
  amount: -(96.4 + monthIndex * 2.7),
});

const ONE_OFFS = [
  { day: 4, name: "WHOLE FOODS MARKET #123, AUSTIN TX", amount: -87.43 },
  { day: 11, name: "STARBUCKS STORE 08421", amount: -6.75 },
  { day: 13, name: "UBER TRIP HELP.UBER.COM", amount: -18.2 },
  { day: 17, name: "SWEETGREEN #402", amount: -22.1 },
  { day: 19, name: "CVS PHARMACY #7712", amount: -14.3 },
  { day: 24, name: "HOME DEPOT #6521", amount: -64.88 },
  { day: 26, name: "AMAZON MARKETPLACE", amount: -39.99 },
];

const INCOME = { day: 15, name: "PAYROLL DEPOSIT ACME CORP", amount: 4200.0 };

/** Build one calendar month of transactions (deterministic, no randomness). */
function monthRows(year, month /* 1-12 */, monthIndex) {
  const rows = [];

  for (const charge of RECURRING) {
    rows.push({
      date: `${year}-${pad(month)}-${pad(charge.day)}`,
      name: charge.name,
      amount: charge.amount,
    });
  }

  const utility = utilityBill(monthIndex);
  rows.push({
    date: `${year}-${pad(month)}-${pad(utility.day)}`,
    name: utility.name,
    amount: utility.amount,
  });

  rows.push({
    date: `${year}-${pad(month)}-${pad(INCOME.day)}`,
    name: INCOME.name,
    amount: INCOME.amount,
  });

  ONE_OFFS.forEach((item, index) => {
    // skip a couple per month so months are not identical
    if ((monthIndex + index) % 5 === 0) return;
    rows.push({
      date: `${year}-${pad(month)}-${pad(item.day)}`,
      name: item.name,
      amount: item.amount - (monthIndex % 3) * 1.15,
    });
  });

  if (monthIndex % 4 === 1) {
    rows.push({
      date: `${year}-${pad(month)}-27`,
      name: "AMAZON REFUND",
      amount: 15.49,
    });
  }

  return rows;
}

function toCsv(rows) {
  const sorted = [...rows].sort((a, b) =>
    a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date),
  );
  return [
    HEADER,
    ...sorted.map((r) => [r.date, csvCell(r.name), money(r.amount)].join(",")),
  ].join("\n") + "\n";
}

/** Nov 2025 .. Oct 2026 */
function rollingMonths(count, endYear, endMonth) {
  const months = [];
  let year = endYear;
  let month = endMonth;
  for (let i = 0; i < count; i += 1) {
    months.unshift({ year, month });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

const months = rollingMonths(12, 2026, 10);

// 1. three recent months — the everyday test file
const threeMonths = months
  .slice(-3)
  .flatMap((m, i) => monthRows(m.year, m.month, i + 9));
await writeFile(new URL("statement-3-months.csv", OUT), toCsv(threeMonths));

// 2. twelve months — for month-over-month and re-run testing
const twelveMonths = months.flatMap((m, i) => monthRows(m.year, m.month, i));
await writeFile(new URL("statement-12-months.csv", OUT), toCsv(twelveMonths));

// 3. empty file — triggers the "file is empty" error
await writeFile(new URL("empty.csv", OUT), "");

// 4. fake PDF — triggers the wrong-type error
await writeFile(
  new URL("statement.pdf", OUT),
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
);

// 5. large file — exercises the reading/progress state (gitignored)
const largeRows = [];
for (let i = 0; i < 24000; i += 1) {
  const day = (i % 28) + 1;
  const month = (i % 12) + 1;
  const year = 2024 + (i % 3);
  largeRows.push({
    date: `${year}-${pad(month)}-${pad(day)}`,
    name: `MERCHANT ${pad(i % 120)} PAYMENT`,
    amount: -(((i * 37) % 9000) / 100 + 1),
  });
}
await writeFile(new URL("large-statement.csv", OUT), toCsv(largeRows));

// 6. oversized file — triggers the 10 MB limit error (gitignored)
const oversizeLine = "2026-10-15,OVERSIZED TEST MERCHANT,-19.99\n";
const targetBytes = 11 * 1024 * 1024;
const oversize =
  HEADER + "\n" + oversizeLine.repeat(Math.ceil(targetBytes / oversizeLine.length) + 1);
await writeFile(new URL("oversized-statement.csv", OUT), oversize);

// 7. valid header but no transactions — exercises the "no rows" list state
await writeFile(new URL("header-only.csv", OUT), HEADER + "\n");

// 8. no recognisable columns — exercises the "couldn't read" list state
await writeFile(new URL("unreadable.csv", OUT), "Foo,Bar,Baz\n1,2,3\n4,5,6\n");

const summary = [
  ["statement-3-months.csv", "valid · 3 recent months"],
  ["statement-12-months.csv", "valid · 12 months"],
  ["empty.csv", "0 bytes · empty error"],
  ["statement.pdf", "wrong type · error"],
  ["large-statement.csv", "24,000 rows · reading state (gitignored)"],
  ["oversized-statement.csv", "~11 MB · size-limit error (gitignored)"],
  ["header-only.csv", "valid header, no rows · empty list state"],
  ["unreadable.csv", "no recognisable columns · unreadable list state"],
];
console.log(summary.map(([f, d]) => `  ${f.padEnd(26)} ${d}`).join("\n"));
