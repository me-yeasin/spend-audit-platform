// Dev-only: verify the monthly re-run — that a month is saved, that the
// detector runs over the months on file rather than the file in hand, that the
// comparison appears with the third month, that its rows add up to the delta,
// and that "Forget saved history" is the way out.
//
// Usage: node design/qa-comparison-panel.mjs [url]
import puppeteer from "puppeteer-core";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.argv[2] ?? "http://localhost:4000";
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "test-data");
const outDir = path.join(here, "shots");
await mkdir(outDir, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const failures = [];
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${actual}`);
  if (!ok) failures.push(`${label}: got ${actual}, expected ${expected}`);
};
const contains = (label, haystack, needle) => {
  const ok = String(haystack).includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${ok}`);
  if (!ok) failures.push(`${label}: "${haystack}" does not contain "${needle}"`);
};
const truthy = (label, value) => {
  const ok = Boolean(value);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${ok}`);
  if (!ok) failures.push(`${label}: expected truthy`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // A full-page shot of a long statement can take a while.
  protocolTimeout: 180_000,
  args: ["--hide-scrollbars", "--disable-gpu"],
});

const drop = async (page, file) => {
  const content = await readFile(path.join(dataDir, file), "utf8");
  await page.evaluate(
    ({ name, body }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([body], name, { type: "text/csv" }));
      window.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
    },
    { name: file, body: content },
  );
  // The reader waits long enough to be perceived as progress.
  await new Promise((resolve) => setTimeout(resolve, 1400));
};

const read = (page) =>
  page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.innerText ?? null;
    const amount = document.querySelector("[data-total-amount]")?.innerText ?? null;
    const panel = document.querySelector("[data-comparison-panel]");
    const months = [...document.querySelectorAll("[data-comparison-month]")].map((el) => ({
      month: el.dataset.comparisonMonth,
      text: el.innerText.replace(/\s+/g, " ").trim(),
    }));
    const rows = [...document.querySelectorAll("[data-change-row]")].map((el) => ({
      key: el.dataset.changeRow,
      name: el.querySelector("[data-change-name]")?.innerText ?? "",
      delta: Number(el.querySelector("[data-change-delta]")?.dataset.changeDelta ?? 0),
    }));
    return {
      totalPanel: text("[data-total-panel]"),
      amount,
      comparison: panel ? panel.innerText : null,
      comparisonAmount: document.querySelector("[data-comparison-amount]")?.innerText ?? null,
      deltaLine: document.querySelector("[data-comparison-delta]")?.innerText ?? null,
      months,
      rows,
      forget: document.querySelector("[data-forget-history]")?.tagName ?? null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

// ---------------------------------------------------------------- month one
const page = await browser.newPage();
page.on("pageerror", (error) => console.log("  [pageerror]", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.log("  [console]", message.text());
});
await page.setViewport({ width: 1440, height: 1000 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });

await drop(page, "statement-2026-11.csv");
let state = await read(page);

console.log("\n--- month 1: November 2026 ---");
contains("one month says there are no recurring charges yet", state.totalPanel, "No recurring charges yet");
contains("and explains why", state.totalPanel, "One month is not enough to tell a repeat from a one-off.");
contains("and says the month is saved", state.totalPanel, "November 2026 is saved");
check("no comparison panel after one month", state.comparison, null);
check("no $0.00 is shown", state.amount.includes("$0.00"), false);

// ---------------------------------------------------------------- month two
await drop(page, "statement-2026-12.csv");
state = await read(page);

console.log("\n--- month 2: December 2026 ---");
contains("two months still says no recurring charges yet", state.totalPanel, "No recurring charges yet");
contains("and says how many months are on file", state.totalPanel, "Two months are on file.");
contains("and reassures rather than alarming", state.totalPanel, "Nothing here is wrong.");
check("no comparison panel after two months", state.comparison, null);

// -------------------------------------------------------------- month three
await drop(page, "statement-2027-01.csv");
state = await read(page);

console.log("\n--- month 3: January 2027 ---");
check("the headline is what January cost", state.amount, "$2,406.84");
contains("the headline counts the charges", state.totalPanel, "across 14 recurring charges");
truthy("the comparison panel appears", state.comparison);
contains("it names the month it is compared against", state.comparison, "Compared with December 2026");
contains("it says the two months cover the same charges", state.comparison, "the same 14 charges in both months");
check("the comparison figure is the headline figure", state.comparisonAmount, "$2,406.84");
contains("the delta line gives the change and the earlier total", state.deltaLine, "+$5.20 more than December 2026 ($2,401.64)");
contains("the increased group names the utility", state.comparison, "CITY POWER & WATER");
contains("and shows both amounts", state.comparison, "$123.40 → $126.10");
contains("the increased group names the subscription", state.comparison, "NETFLIX.COM");
contains("and shows the price rise", state.comparison, "$15.49 → $17.99");
contains("it says how much did not move", state.comparison, "12 charges unchanged.");

console.log("\n--- the change rows add up ---");
check("two charges increased", state.rows.length, 2);
const rowSum = Math.round(state.rows.reduce((sum, row) => sum + row.delta, 0) * 100) / 100;
check("the rows sum to the month's change", rowSum, 5.2);
const names = state.rows.map((row) => row.name).join("|");
contains("the utility is one of them", names, "CITY POWER & WATER");
contains("the subscription is the other", names, "NETFLIX.COM");
const deltas = state.rows
  .map((row) => row.delta)
  .sort((a, b) => b - a)
  .join(",");
check("and the two rises are the ones on file", deltas, "2.7,2.5");

console.log("\n--- the history strip ---");
check("the strip shows three months", state.months.length, 3);
check("the first is November", state.months[0]?.text, "Nov 2026 $2,398.94");
check("the second is December", state.months[1]?.text, "Dec 2026 $2,401.64");
check("the third is January", state.months[2]?.text, "Jan 2027 $2,406.84");
check(
  "the strip's newest month is the headline",
  state.months[2]?.text.includes(state.amount),
  true,
);

console.log("\n--- the footer, and the way out ---");
contains("it says how many months are saved", state.comparison, "3 months saved in this browser");
truthy("Forget saved history is a real button", state.forget);
check("the button is a button", state.forget, "BUTTON");

// ------------------------------------------------------------ it persists
await page.reload({ waitUntil: "networkidle0" });
const afterReload = await read(page);
console.log("\n--- after a reload ---");
check("a reload starts with no file in hand", afterReload.comparison, null);
await drop(page, "statement-2027-01.csv");
const restored = await read(page);
check("the history survived the reload", restored.amount, "$2,406.84");
check("and the comparison came back with it", restored.comparisonAmount, "$2,406.84");
check("and the strip is still three months", restored.months.length, 3);
check("and it still starts in November", restored.months[0]?.month, "2026-11");

// ------------------------------------------------------- forget the history
await page.click("[data-forget-history]");
await new Promise((resolve) => setTimeout(resolve, 400));
const afterForget = await read(page);
console.log("\n--- after forgetting ---");
check("the comparison is gone", afterForget.comparison, null);
const stored = await page.evaluate(() => localStorage.getItem("spend-audit.months.v1"));
check("storage is empty", stored, null);

// ------------------------------------------------------------- narrow screen
const mobile = await browser.newPage();
await mobile.setViewport({ width: 320, height: 800 });
await mobile.goto(url, { waitUntil: "networkidle0" });
for (const file of ["statement-2026-11.csv", "statement-2026-12.csv", "statement-2027-01.csv"]) {
  await drop(mobile, file);
}
const narrow = await read(mobile);
console.log("\n--- at 320px ---");
check("the comparison is still there", narrow.comparisonAmount, "$2,406.84");
check("nothing overflows the page", narrow.overflow, 0);
check("the strip keeps three months", narrow.months.length, 3);
await mobile.screenshot({ path: path.join(outDir, "qa-comparison-mobile.png"), fullPage: true });

await page.screenshot({ path: path.join(outDir, "qa-comparison-forget.png"), fullPage: true });

await browser.close();

console.log(`\n${failures.length ? "FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n") : "all checks passed"}`);
process.exit(failures.length ? 1 : 0);
