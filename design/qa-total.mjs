// Dev-only: unit checks for the headline total.
// Usage: node design/qa-total.mjs
import { parseStatement } from "../lib/parse-statement.ts";
import { detectRecurring } from "../lib/detect-recurring.ts";
import { sumMonthly, summariseRecurring } from "../lib/total.ts";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "test-data");

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
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, same, same ? "" : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const text = await readFile(path.join(dataDir, "statement-3-months.csv"), "utf8");
const parsed = parseStatement(text);
if (parsed.status === "unreadable") throw new Error(parsed.reason);
const groups = detectRecurring(parsed.transactions).groups;

// ---------------------------------------------------------------- totals
console.log("\nthe headline total");
const total = summariseRecurring(groups, () => false);
check("it covers every recurring charge", total.charges, groups.length);
check("it counts the payments", total.payments, groups.reduce((sum, g) => sum + g.occurrences, 0));

const handSum = groups.reduce((sum, group) => sum + group.monthlyAmount, 0);
check(
  "it equals the sum of the monthly amounts in the list",
  total.monthly,
  Math.round(handSum * 100) / 100,
);
check("the list footer and the headline agree", sumMonthly(groups), total.monthly);

console.log("\nrounding");
equal("a sum with thirds lands on cents", sumMonthly([]), 0);
check(
  "no stray decimals",
  Number.isInteger(total.monthly * 100),
  true,
  `monthly was ${total.monthly}`,
);

console.log("\nthe unowned part");
check("with no owners every charge is unowned", total.unownedCharges, groups.length);
check(
  "and the unowned money is the whole total",
  total.unownedMonthly,
  total.monthly,
);

const rent = groups.find((group) => group.key === "CITY APARTMENTS RENT");
const partly = summariseRecurring(groups, (key) => key === rent.key);
check("one owner leaves one charge unowned", partly.unownedCharges, groups.length - 1);
check(
  "the headline does not change when a charge is claimed",
  partly.monthly,
  total.monthly,
);
check(
  "the unowned money is the total minus the owned charge",
  partly.unownedMonthly,
  Math.round((total.monthly - rent.monthlyAmount) * 100) / 100,
);

console.log("\nno charges at all");
const empty = summariseRecurring([], () => false);
equal("an empty statement has no charges", empty.charges, 0);
equal("and no money", empty.monthly, 0);
equal("and nothing unowned", empty.unownedCharges, 0);
equal("and an empty sum", sumMonthly([]), 0);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nfailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failures.length ? 1 : 0);
