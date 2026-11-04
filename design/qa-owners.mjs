// Dev-only: unit checks for the owner logic.
// Usage: node design/qa-owners.mjs
import { parseStatement } from "../lib/parse-statement.ts";
import { detectRecurring } from "../lib/detect-recurring.ts";
import {
  countUnowned,
  knownOwners,
  ownerFor,
  parseOwners,
  serialiseOwners,
  unownedGroups,
} from "../lib/owners.ts";
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

// ---------------------------------------------------------------- parsing
console.log("\nreading a stored map");
equal("nothing stored means no owners", parseOwners(null), {});
equal("broken json is ignored", parseOwners("{not json"), {});
equal("an array is ignored", parseOwners("[]"), {});
equal("a non object is ignored", parseOwners('"hello"'), {});
equal("a valid map is read", parseOwners('{"NETFLIX COM":"Sam"}'), { "NETFLIX COM": "Sam" });
equal("blank names are dropped", parseOwners('{"A":"  "}'), {});
equal("non string values are dropped", parseOwners('{"A":42,"B":"Kim"}'), { B: "Kim" });

// ---------------------------------------------------------------- writing
console.log("\nwriting a map");
equal("a map round trips", parseOwners(serialiseOwners({ A: "Kim" })), { A: "Kim" });
equal(
  "keys are written in a stable order",
  serialiseOwners({ B: "Kim", A: "Sam" }),
  '{"A":"Sam","B":"Kim"}',
);
equal("blank names are not written", serialiseOwners({ A: "   " }), "{}");

// ---------------------------------------------------------------- lookup
console.log("\nlooking up an owner");
const owners = { "NETFLIX COM": "Sam", "SPOTIFY AB": "  " };
equal("a named charge has an owner", ownerFor(owners, "NETFLIX COM"), "Sam");
equal("an unnamed charge has none", ownerFor(owners, "SPOTIFY AB"), null);
equal("an unknown charge has none", ownerFor(owners, "GONE"), null);

console.log("\nthe roster of names already in use");
equal("names are unique and sorted", knownOwners({ A: "Zoe", B: "Sam", C: "Zoe" }), ["Sam", "Zoe"]);
equal("an empty map has no names", knownOwners({}), []);
equal(
  "the same name in different case is one person",
  knownOwners({ A: "sam", B: "Sam", C: "Kim" }),
  ["Kim", "sam"],
);

// ---------------------------------------------------------------- groups
console.log("\ncharges with nobody owning them");
const text = await readFile(path.join(dataDir, "statement-3-months.csv"), "utf8");
const parsed = parseStatement(text);
if (parsed.status === "unreadable") throw new Error(parsed.reason);
const groups = detectRecurring(parsed.transactions).groups;

equal("with no owners every charge is unowned", countUnowned(groups, {}), groups.length);
equal("and they are all listed", unownedGroups(groups, {}).length, groups.length);

const rent = groups.find((group) => group.key === "CITY APARTMENTS RENT");
const netflix = groups.find((group) => group.key === "NETFLIX COM");
const withOneOwner = { [rent.key]: "Sam" };
equal("one owner removes one charge", countUnowned(groups, withOneOwner), groups.length - 1);
check(
  "the owned charge is the one that leaves",
  !unownedGroups(groups, withOneOwner).some((group) => group.key === rent.key),
);
check(
  "the others stay",
  unownedGroups(groups, withOneOwner).some((group) => group.key === netflix.key),
);

const allOwned = Object.fromEntries(groups.map((group) => [group.key, "Sam"]));
equal("when everyone owns something, none are flagged", countUnowned(groups, allOwned), 0);
equal("and the flagged list is empty", unownedGroups(groups, allOwned), []);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nfailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failures.length ? 1 : 0);
