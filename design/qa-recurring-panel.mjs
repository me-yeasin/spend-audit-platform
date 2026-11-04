// Dev-only: verify the recurring-charges panel in the browser, against the real
// fixtures and the ground truth the detector is expected to find.
//
// Usage: node design/qa-recurring-panel.mjs [url]
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

/** The 14 charges the detector must find in both fixtures. */
const EXPECTED = [
  "CITY APARTMENTS RENT",
  "GEICO AUTO INSURANCE",
  "CITY POWER & WATER",
  "VERIZON WIRELESS",
  "ADOBE CREATIVE CLOUD",
  "AMAZON WEB SERVICES",
  "PLANET FITNESS",
  "CHATGPT SUBSCRIPTION",
  "NOTION LABS",
  "NETFLIX.COM",
  "FIGMA PROFESSIONAL",
  "SPOTIFY AB",
  "GOOGLE ONE",
  "APPLE ICLOUD+",
];

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

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(`shot  ${name}`);
};

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

const probe = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector("[data-recurring-panel]");
    const groups = [...document.querySelectorAll("[data-recurring-group]")];
    // the expand control is the one carrying aria-expanded — a group also
    // holds the owner control, which is a button too
    const buttons = groups.map((group) => group.querySelector("button[aria-expanded]"));
    return {
      hasPanel: Boolean(panel),
      heading: panel?.querySelector("h2")?.textContent?.trim() ?? null,
      count: groups.length,
      names: groups.map((group) =>
        group.querySelector("button[aria-expanded] span span")?.textContent?.trim() ?? "",
      ),
      firstRowText: groups[0]?.innerText.replace(/\s+/g, " ").trim() ?? null,
      footer: panel?.querySelector("[data-panel-footer]")?.innerText.replace(/\s+/g, " ").trim() ?? null,
      expanded: buttons.filter((button) => button?.getAttribute("aria-expanded") === "true").length,
      paymentsVisible: document.querySelectorAll("[data-recurring-group] ul li").length,
      emptyText: panel?.innerText.includes("No recurring charges found") ?? false,
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle0" });

  // ---------------------------------------------------------- 3-month file
  console.log("\nstatement-3-months.csv");
  await drop(page, "statement-3-months.csv");
  await page.waitForSelector("[data-recurring-panel]", { timeout: 15000 });

  let state = await probe(page);
  check("panel is present", state.hasPanel, true);
  check("panel heading", state.heading, "Recurring charges");
  check("group count", state.count, EXPECTED.length);
  check(
    "every expected charge is listed",
    EXPECTED.every((name) => state.names.includes(name)),
    true,
  );
  check("groups start with the largest charge", state.names[0], "CITY APARTMENTS RENT");
  truthy("footer mentions the transaction count", state.footer?.includes("62 transactions"));
  check("nothing overflows horizontally", state.overflow, 0);
  await shot(page, "recurring-3months");

  // expand a group
  const netflixIndex = state.names.indexOf("NETFLIX.COM");
  check("Netflix is in the list", netflixIndex > -1, true);
  await page.evaluate((index) => {
    document
      .querySelectorAll("[data-recurring-group] button[aria-expanded]")
      [index].click();
  }, netflixIndex);
  await new Promise((resolve) => setTimeout(resolve, 250));

  state = await probe(page);
  check("one group is expanded", state.expanded, 1);
  check("its payments are listed", state.paymentsVisible, 3);
  truthy(
    "the evidence line shows the count and the total",
    state.firstRowText?.includes("payments") && state.firstRowText?.includes("total"),
  );
  await shot(page, "recurring-expanded");

  // collapse again
  await page.evaluate((index) => {
    document
      .querySelectorAll("[data-recurring-group] button[aria-expanded]")
      [index].click();
  }, netflixIndex);
  await new Promise((resolve) => setTimeout(resolve, 200));
  state = await probe(page);
  check("it collapses again", state.expanded, 0);
  check("and the payments are hidden", state.paymentsVisible, 0);

  // keyboard: the row is a real button
  const focusable = await page.evaluate(() => {
    const button = document.querySelector("[data-recurring-group] button");
    button.focus();
    return {
      tag: button.tagName,
      focused: document.activeElement === button,
      hasControls: Boolean(button.getAttribute("aria-controls")),
    };
  });
  check("the row is a button", focusable.tag, "BUTTON");
  check("the row takes focus", focusable.focused, true);
  check("it points at its payments", focusable.hasControls, true);

  // the id it points at must resolve while the group is open
  await page.evaluate((index) => {
    document
      .querySelectorAll("[data-recurring-group] button[aria-expanded]")
      [index].click();
  }, netflixIndex);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const controls = await page.evaluate((index) => {
    const button = document.querySelectorAll("[data-recurring-group] button[aria-expanded]")[index];
    const target = document.getElementById(button.getAttribute("aria-controls") ?? "");
    return {
      exists: Boolean(target),
      payments: target?.querySelectorAll("li").length ?? 0,
    };
  }, netflixIndex);
  check("the target exists while open", controls.exists, true);
  check("and it holds the payments", controls.payments, 3);

  // the row is laid out the way the design says
  const geometry = await page.evaluate(() => {
    const group = document.querySelector("[data-recurring-group]");
    const button = group.querySelector("button");
    const chip = button.querySelector(".rounded-full");
    const name = button.querySelector("span > span");
    const amount = button.querySelector("button > span:last-of-type > span");
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
    };
    return {
      rowHeight: group.clientHeight,
      buttonHeight: Math.round(button.getBoundingClientRect().height),
      chipVisible: chip.getBoundingClientRect().width > 0,
      name: box(name),
      amount: box(amount),
      chip: box(chip),
      rowRight: Math.round(button.getBoundingClientRect().right),
    };
  });
  check("the desktop row is 64px tall", geometry.rowHeight, 64);
  check("and the expand control fills it", geometry.buttonHeight, 64);
  check("the cadence chip is visible on desktop", geometry.chipVisible, true);
  check("the amount sits right of the name", geometry.amount.x > geometry.name.x, true);
  check("the chip sits between name and amount", geometry.chip.x > geometry.name.x, true);
  // the amount is flush right, with only the chevron and padding beyond it
  check(
    "the amount is flush right",
    geometry.rowRight - geometry.amount.right <= 60,
    true,
  );

  await page.evaluate((index) => {
    document
      .querySelectorAll("[data-recurring-group] button[aria-expanded]")
      [index].click();
  }, netflixIndex);
  await new Promise((resolve) => setTimeout(resolve, 200));

  // --------------------------------------------------------- 12-month file
  console.log("\nstatement-12-months.csv");
  await drop(page, "statement-12-months.csv");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("[data-recurring-group]").length === 14 &&
      document.querySelector("[data-file-chip]")?.innerText.includes("12-months"),
    { timeout: 15000 },
  );

  state = await probe(page);
  check("group count", state.count, EXPECTED.length);
  check(
    "every expected charge is listed",
    EXPECTED.every((name) => state.names.includes(name)),
    true,
  );
  truthy("footer mentions the transaction count", state.footer?.includes("250 transactions"));
  check("nothing overflows horizontally", state.overflow, 0);

  const utility = await page.evaluate(() => {
    const group = [...document.querySelectorAll("[data-recurring-group]")].find((item) =>
      /city power/i.test(item.innerText),
    );
    return group?.innerText.replace(/\s+/g, " ").trim() ?? null;
  });
  truthy("a drifting bill says so", utility?.includes("amount varies"));
  truthy("and still shows a monthly amount", utility?.includes("per month"));

  await page.evaluate(() => {
    const group = [...document.querySelectorAll("[data-recurring-group]")].find((item) =>
      /netflix/i.test(item.innerText),
    );
    group.querySelector("button").click();
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  state = await probe(page);
  check("a year of payments is listed", state.paymentsVisible, 12);
  await shot(page, "recurring-12months");

  // ------------------------------------------------------- one-off spending
  console.log("\nrepeated spending that is not a subscription");
  const oneOffs = await page.evaluate(() => {
    const text = document.querySelector("[data-recurring-panel]")?.innerText ?? "";
    return {
      starbucks: /starbucks/i.test(text),
      uber: /uber/i.test(text),
      groceries: /whole foods/i.test(text),
      amazon: /amazon marketplace/i.test(text),
    };
  });
  check("Starbucks is not listed", oneOffs.starbucks, false);
  check("Uber is not listed", oneOffs.uber, false);
  check("groceries are not listed", oneOffs.groceries, false);
  check("Amazon Marketplace is not listed", oneOffs.amazon, false);

  // salary is never a recurring cost
  const payroll = await page.evaluate(
    () => /payroll/i.test(document.querySelector("[data-recurring-panel]")?.innerText ?? ""),
  );
  check("salary is not listed", payroll, false);

  // ------------------------------------------------------------------ mobile
  console.log("\nmobile layout");
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 320, height: 720 });
  await mobile.goto(url, { waitUntil: "networkidle0" });
  await drop(mobile, "statement-3-months.csv");
  await mobile.waitForSelector("[data-recurring-panel]", { timeout: 15000 });

  const mobileState = await mobile.evaluate(() => {
    const group = document.querySelector("[data-recurring-group]");
    const button = group.querySelector("button");
    const chip = button.querySelector(".rounded-full");
    const name = button.querySelector("span > span");
    const meta = name.nextElementSibling;
    const amount = button.querySelector("button > span:last-of-type > span");
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      chipVisible: chip.getBoundingClientRect().width > 0,
      name: box(name),
      meta: box(meta),
      amount: box(amount),
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check("the cadence chip is hidden on mobile", mobileState.chipVisible, false);
  check("the name is on its own line", mobileState.meta.y > mobileState.name.y, true);
  check("the amount shares the first line", mobileState.amount.y === mobileState.name.y, true);
  check("nothing overflows at 320px", mobileState.overflow, 0);
  await shot(mobile, "recurring-mobile");
  await mobile.close();

  // ------------------------------------------------------------ empty case
  console.log("\nstatement with nothing that repeats");
  await page.goto(url, { waitUntil: "networkidle0" });
  await drop(page, "statement-3-months.csv");
  await page.waitForSelector("[data-recurring-panel]", { timeout: 15000 });
  await page.evaluate(() => {
    document.querySelector("[data-file-chip] button:last-of-type").click();
  });
  await new Promise((resolve) => setTimeout(resolve, 400));

  await page.evaluate(() => {
    const input = document.querySelector('input[type="file"]');
    const dt = new DataTransfer();
    dt.items.add(
      new File(
        ["Date,Description,Amount\n2026-10-01,COFFEE SHOP,-4.50\n2026-10-05,BOOK STORE,-22.00"],
        "no-repeats.csv",
        { type: "text/csv" },
      ),
    );
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    () =>
      document.querySelector("[data-recurring-panel]")?.innerText.includes(
        "No recurring charges found",
      ),
    { timeout: 15000 },
  );

  state = await probe(page);
  check("the empty state is shown", state.emptyText, true);
  check("no groups are listed", state.count, 0);
  check("nothing overflows horizontally", state.overflow, 0);
  await shot(page, "recurring-empty");

  // the transaction list is still there
  const stillListed = await page.evaluate(
    () => document.querySelectorAll("[data-transactions-panel] [data-row]").length,
  );
  check("the transaction list is untouched", stillListed, 2);

  console.log(`\n${failures.length === 0 ? "all checks passed" : `${failures.length} failed`}`);
  if (failures.length) {
    for (const failure of failures) console.log(`  - ${failure}`);
  }
} finally {
  await browser.close();
}

process.exit(failures.length ? 1 : 0);
