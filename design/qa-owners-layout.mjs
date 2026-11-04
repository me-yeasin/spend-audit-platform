// Dev-only: geometry checks for the owner flagging layout — the flagged
// table, the owner column, and how they behave at each breakpoint.
//
// Usage: node design/qa-owners-layout.mjs [url]
import puppeteer from "puppeteer-core";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.argv[2] ?? "http://localhost:4000";
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "test-data");

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const failures = [];
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${actual}`);
  if (!ok) failures.push(`${label}: got ${actual}, expected ${expected}`);
};
const truthy = (label, value) => {
  const ok = Boolean(value);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${ok}`);
  if (!ok) failures.push(`${label}: expected truthy`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
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
};

const geometry = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        right: Math.round(r.right),
      };
    };
    const flagged = document.querySelector("[data-flagged-panel]");
    const row = flagged?.querySelector("[data-flagged-row]");
    const name = row?.querySelector("[data-flagged-name]");
    const amount = row?.querySelector("[data-flagged-amount]");
    const control = row?.querySelector('button[aria-label^="Add an owner"]');
    const dot = row?.querySelector("span[aria-hidden]");

    const group = document.querySelector("[data-recurring-group]");
    const expand = group?.querySelector("button[aria-expanded]");
    const groupName = expand?.querySelector("span > span");
    const groupAmount = expand?.querySelector("span:last-of-type > span");
    const groupControl = group?.querySelector('button[aria-label^="Add an owner"]');

    return {
      hasFlagged: Boolean(flagged),
      flaggedTop: box(flagged),
      flaggedRow: box(row),
      name: box(name),
      amount: box(amount),
      control: box(control),
      dot: box(dot),
      groupRow: box(group),
      expand: box(expand),
      groupName: box(groupName),
      groupAmount: box(groupAmount),
      groupControl: box(groupControl),
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await drop(page, "statement-3-months.csv");
  await page.waitForSelector("[data-flagged-panel]", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));

  console.log("\ndesktop, 1440px");
  let g = await geometry(page);
  check("the flagged panel is there", g.hasFlagged, true);
  check("nothing overflows", g.overflow, 0);
  truthy(
    "the flagged panel sits above the recurring panel",
    g.flaggedTop.y + g.flaggedTop.h <= g.groupRow.y + 1,
  );
  truthy("the name sits left of the amount", g.name.x < g.amount.x);
  truthy("the amount sits left of the control", g.amount.right <= g.control.x + 1);
  truthy(
    "the amount is right aligned with the control",
    Math.abs(g.amount.right - g.control.x) < 120,
  );
  truthy("the flag dot leads the name", g.dot.x < g.name.x);
  truthy("the name is on one line with the amount", Math.abs(g.name.y - g.amount.y) < 24);

  console.log("\nthe recurring row");
  truthy("the owner control sits right of the amount", g.groupControl.x > g.groupAmount.x);
  truthy("the control is on the same line as the name", Math.abs(g.groupControl.y - g.groupName.y) < 24);
  truthy("the expand control fills the row height", g.expand.h >= 60);
  truthy(
    "the owner control is inside the row, not beyond it",
    g.groupControl.right <= g.groupRow.right,
  );

  console.log("\nmobile, 320px");
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 320, height: 720 });
  await mobile.goto(url, { waitUntil: "networkidle0" });
  await mobile.evaluate(() => window.localStorage.clear());
  await mobile.reload({ waitUntil: "networkidle0" });
  await drop(mobile, "statement-3-months.csv");
  await mobile.waitForSelector("[data-flagged-panel]", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));

  const m = await geometry(mobile);
  check("nothing overflows", m.overflow, 0);
  truthy("the owner control drops below the name", m.control.y > m.name.y);
  truthy("the amount stays on the name's line", Math.abs(m.amount.y - m.name.y) < 24);
  truthy("the control is within the row", m.control.right <= m.flaggedRow.right + 1);
  truthy(
    "the recurring owner control drops below the row name",
    m.groupControl.y > m.groupName.y,
  );
  truthy("the recurring row still fits", m.groupControl.right <= m.groupRow.right + 1);
  await mobile.close();

  console.log("\ntablet, 768px");
  const tablet = await browser.newPage();
  await tablet.setViewport({ width: 768, height: 1024 });
  await tablet.goto(url, { waitUntil: "networkidle0" });
  await tablet.evaluate(() => window.localStorage.clear());
  await tablet.reload({ waitUntil: "networkidle0" });
  await drop(tablet, "statement-3-months.csv");
  await tablet.waitForSelector("[data-flagged-panel]", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));
  const t = await geometry(tablet);
  check("nothing overflows", t.overflow, 0);
  truthy("the flagged row stays on one line", Math.abs(t.name.y - t.amount.y) < 24);
  truthy("the control sits right of the amount", t.control.x > t.amount.x);
  await tablet.close();

  console.log(`\n${failures.length === 0 ? "all checks passed" : `${failures.length} failed`}`);
  if (failures.length) {
    for (const failure of failures) console.log(`  - ${failure}`);
  }
} finally {
  await browser.close();
}

process.exit(failures.length ? 1 : 0);
