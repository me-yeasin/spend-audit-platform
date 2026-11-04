// Unit checks for the recurring-charge detector, run against the real
// fixtures with the real parser. No browser involved.
//
// Usage: node design/qa-recurring.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseStatement } from "../lib/parse-statement.ts";
import { detectRecurring, merchantKey, merchantName } from "../lib/detect-recurring.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "test-data");

/** The 14 charges generate.mjs creates on purpose. */
const GROUND_TRUTH = new Set([
  "CITY APARTMENTS RENT",
  "CITY POWER WATER",
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
]);

/** Merchants that repeat but are one-off spending in disguise. */
const ONE_OFFS = new Set([
  "WHOLE FOODS MARKET",
  "STARBUCKS STORE",
  "UBER TRIP HELP UBER COM",
  "SWEETGREEN",
  "CVS PHARMACY",
  "HOME DEPOT",
  "AMAZON MARKETPLACE",
]);

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function equal(name, actual, expected) {
  check(name, actual === expected, `expected ${expected}, got ${actual}`);
}

async function load(file) {
  const text = await readFile(path.join(dataDir, file), "utf8");
  const result = parseStatement(text);
  if (result.status === "unreadable") throw new Error(`${file}: ${result.reason}`);
  return result.transactions;
}

// ---------------------------------------------------------------- keys
console.log("\nmerchant key and name");
equal("uppercases and strips store numbers", merchantKey("Starbucks Store 08421"), "STARBUCKS STORE");
equal(
  "strips hash number and city tail",
  merchantKey("WHOLE FOODS MARKET #123, AUSTIN TX"),
  "WHOLE FOODS MARKET",
);
equal("keeps distinct amazon merchants apart", merchantKey("AMAZON WEB SERVICES") !== merchantKey("AMAZON MARKETPLACE"), true);
equal("keeps refund apart from purchase", merchantKey("AMAZON REFUND") !== merchantKey("AMAZON MARKETPLACE"), true);
equal("display name drops the store number", merchantName("CVS PHARMACY #7712"), "CVS PHARMACY");
equal("display name keeps a trailing plus", merchantName("APPLE ICLOUD+"), "APPLE ICLOUD+");
equal("display name drops a trailing number", merchantName("STARBUCKS STORE 08421"), "STARBUCKS STORE");
equal("display name drops the city tail", merchantName("WHOLE FOODS MARKET #123, AUSTIN TX"), "WHOLE FOODS MARKET");
equal("display name keeps the bank's casing", merchantName("CITY APARTMENTS RENT"), "CITY APARTMENTS RENT");
equal("display name leaves mixed case alone", merchantName("Whole Foods Market"), "Whole Foods Market");

// ---------------------------------------------------------------- fixtures
for (const file of ["statement-3-months.csv", "statement-12-months.csv"]) {
  console.log(`\n${file}`);
  const transactions = await load(file);
  const { groups, rejected } = detectRecurring(transactions);
  const found = new Set(groups.map((group) => group.key));

  equal("finds every recurring charge", groups.length, GROUND_TRUTH.size);
  check(
    "no charge is missed",
    [...GROUND_TRUTH].every((key) => found.has(key)),
    [...GROUND_TRUTH]
      .filter((key) => !found.has(key))
      .join(", "),
  );
  check(
    "no one-off spending is accepted",
    [...ONE_OFFS].every((key) => !found.has(key)),
    [...ONE_OFFS]
      .filter((key) => found.has(key))
      .join(", "),
  );
  check(
    "income is never a recurring charge",
    groups.every((group) => !group.key.includes("PAYROLL") && !group.key.includes("REFUND")),
  );

  const rent = groups.find((group) => group.key === "CITY APARTMENTS RENT");
  equal("rent keeps its monthly amount", rent?.monthlyAmount, 1850);
  equal("rent counts every payment", rent?.occurrences, file.includes("3-months") ? 3 : 12);
  equal("rent totals its payments", rent?.total, file.includes("3-months") ? 5550 : 22200);

  const utility = groups.find((group) => group.key === "CITY POWER WATER");
  check("a drifting bill is still recurring", Boolean(utility));
  check("a drifting bill is flagged as varying", utility?.varies === true);

  const netflix = groups.find((group) => group.key === "NETFLIX COM");
  equal("a steady subscription is not flagged as varying", netflix?.varies, false);
  equal("a steady subscription keeps its amount", netflix?.monthlyAmount, 15.49);
  check(
    "payments are listed newest first",
    (netflix?.payments ?? []).every(
      (payment, index, all) => index === 0 || all[index - 1].date >= payment.date,
    ),
  );
  check(
    "grouped payments all belong to the group",
    (netflix?.payments ?? []).every((payment) => payment.description === "NETFLIX.COM"),
  );

  check(
    "groups are ordered by the size of the charge",
    groups.every((group, index) => index === 0 || groups[index - 1].monthlyAmount >= group.monthlyAmount),
  );

  check(
    "every rejected charge explains itself",
    rejected.every((charge) => charge.reason.length > 0),
  );
  check(
    "no rejected charge is actually recurring",
    rejected.every((charge) => !GROUND_TRUTH.has(charge.key)),
    rejected
      .filter((charge) => GROUND_TRUTH.has(charge.key))
      .map((charge) => charge.key)
      .join(", "),
  );
}

// ---------------------------------------------------------------- edge cases
console.log("\nedge cases");
const empty = detectRecurring([]);
equal("no transactions means no groups", empty.groups.length, 0);

const twoPayments = detectRecurring([
  { id: "a", date: "2026-08-01", description: "NETFLIX.COM", amount: -15.49 },
  { id: "b", date: "2026-09-01", description: "NETFLIX.COM", amount: -15.49 },
]);
equal("two payments are not enough", twoPayments.groups.length, 0);
check(
  "and it says why",
  twoPayments.rejected[0]?.reason.includes("2 payments") === true,
  twoPayments.rejected[0]?.reason,
);

const quarterly = detectRecurring([
  { id: "a", date: "2026-01-01", description: "DOMAIN RENEWAL", amount: -40 },
  { id: "b", date: "2026-04-01", description: "DOMAIN RENEWAL", amount: -40 },
  { id: "c", date: "2026-07-01", description: "DOMAIN RENEWAL", amount: -40 },
]);
equal("a quarterly charge is not monthly", quarterly.groups.length, 0);

const drifting = detectRecurring([
  { id: "a", date: "2026-08-01", description: "GYM", amount: -40 },
  { id: "b", date: "2026-09-01", description: "GYM", amount: -70 },
  { id: "c", date: "2026-10-01", description: "GYM", amount: -40 },
]);
equal("a big jump in amount is rejected", drifting.groups.length, 0);

const income = detectRecurring([
  { id: "a", date: "2026-08-01", description: "PAYROLL DEPOSIT ACME CORP", amount: 4200 },
  { id: "b", date: "2026-09-01", description: "PAYROLL DEPOSIT ACME CORP", amount: 4200 },
  { id: "c", date: "2026-10-01", description: "PAYROLL DEPOSIT ACME CORP", amount: 4200 },
]);
equal("salary is not a recurring charge", income.groups.length, 0);

const lateMonth = detectRecurring([
  { id: "a", date: "2026-08-02", description: "CLOUD HOSTING", amount: -42.3 },
  { id: "b", date: "2026-09-02", description: "CLOUD HOSTING", amount: -42.3 },
  { id: "c", date: "2026-10-02", description: "CLOUD HOSTING", amount: -42.3 },
  { id: "d", date: "2026-11-02", description: "CLOUD HOSTING", amount: -42.3 },
]);
equal("a young subscription is still found", lateMonth.groups.length, 1);
equal("and it counts every payment", lateMonth.groups[0]?.occurrences, 4);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nfailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failures.length ? 1 : 0);
