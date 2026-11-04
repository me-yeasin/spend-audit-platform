// Dev-only: verify the headline total — that it appears at the top, that it
// equals the sum of the list below it, that it survives a new file, and that
// it stays inside the page at every width.
//
// Usage: node design/qa-total-panel.mjs [url]
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

const probe = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector("[data-total-panel]");
    const amount = panel?.querySelector("[data-total-amount]");
    const recurring = document.querySelector("[data-recurring-panel]");
    const flagged = document.querySelector("[data-flagged-panel]");
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
    const style = amount ? getComputedStyle(amount) : null;

    // the amounts shown on each row of the recurring list
    const rowAmounts = recurring
      ? [...recurring.querySelectorAll("[data-recurring-group]")].map((group) => {
          const text = group.querySelector("button[aria-expanded] span:last-of-type > span")
            ?.textContent ?? "";
          return Number(text.replace(/[^0-9.]/g, ""));
        })
      : [];

    return {
      hasPanel: Boolean(panel),
      heading: panel?.querySelector("h2")?.textContent?.trim() ?? null,
      amount: amount?.textContent?.trim() ?? null,
      fontSize: style ? Number.parseFloat(style.fontSize) : 0,
      weight: style ? Number(style.fontWeight) : 0,
      tabular: style?.fontVariantNumeric ?? "",
      panelBox: box(panel),
      amountBox: box(amount),
      flaggedBox: box(flagged),
      recurringBox: box(recurring),
      context: panel?.querySelector("p + p")?.textContent?.trim() ?? null,
      rowAmounts,
      rowSum: Math.round(rowAmounts.reduce((a, b) => a + b, 0) * 100) / 100,
      footer: recurring?.querySelector("[data-panel-footer]")?.innerText
        .replace(/\s+/g, " ")
        .trim() ?? null,
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

  console.log("\nthe headline number");
  await drop(page, "statement-3-months.csv");
  await page.waitForSelector("[data-total-panel]", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));

  let state = await probe(page);
  check("the panel is there", state.hasPanel, true);
  check("it is headed", state.heading, "Total monthly recurring cost");
  truthy("it shows an amount", state.amount?.startsWith("$"));
  check("nothing overflows", state.overflow, 0);

  console.log("\nit agrees with the list below it");
  const shown = Number(state.amount.replace(/[^0-9.]/g, ""));
  check("the headline equals the sum of the rows", shown, state.rowSum);
  truthy("the list footer repeats the total", state.footer?.includes(state.amount));

  console.log("\nit is the biggest thing on the page");
  const biggest = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll("p, span, h1, h2, div")].map((el) => {
      const style = getComputedStyle(el);
      const text = (el.textContent ?? "").trim();
      if (!text || el.children.length > 0) return null;
      return { size: Number.parseFloat(style.fontSize), text: text.slice(0, 30) };
    });
    return candidates.filter(Boolean).sort((a, b) => b.size - a.size)[0];
  });
  truthy(
    "the number is the largest text on the page",
    biggest?.text?.includes(state.amount.replace("$", "")) ?? false,
  );
  truthy("and it is set in a big size", state.fontSize >= 32);

  console.log("\nwhere it sits");
  truthy(
    "it is above the flagged section",
    state.panelBox.y + state.panelBox.h <= state.flaggedBox.y + 1,
  );
  truthy(
    "and above the recurring charges",
    state.panelBox.y + state.panelBox.h <= state.recurringBox.y + 1,
  );

  console.log("\nthe unowned money");
  truthy("with nothing assigned the line stays quiet", !state.context?.includes("has no owner"));
  truthy("it just says how many charges", state.context?.includes("across 14 recurring charges"));
  await page.screenshot({ path: path.join(outDir, "total-desktop.png") });
  console.log("shot  total-desktop");

  console.log("\nwhat a screen reader is told");
  const live = await page.evaluate(() =>
    [...document.querySelectorAll("[aria-live]")].map((el) =>
      (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    ),
  );
  check("there are three announcements", live.length, 3);
  truthy("one says how many transactions were loaded", live.some((t) => t.includes("transactions loaded")));
  truthy("one says what it costs per month", live.some((t) => t.includes("per month")));
  truthy("one says what needs an owner", live.some((t) => t.includes("need an owner")));
  check("nothing is announced twice", new Set(live).size, live.length);
  truthy(
    "the total is announced with its amount",
    live.some((t) => t.includes(state.amount)),
  );

  console.log("\nclaiming a charge");
  const beforeClaim = state.amount;
  await page.evaluate(() => {
    document.querySelector('[data-flagged-panel] button[aria-label^="Add an owner"]').click();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-flagged-panel] input[type="text"]:focus')),
    { timeout: 5000 },
  );
  await page.keyboard.type("Sam");
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 400));

  state = await probe(page);
  check("the headline does not change", state.amount, beforeClaim);
  truthy(
    "the unowned money now appears",
    state.context?.includes("has no owner"),
  );
  truthy(
    "and it is the part that is not owned",
    state.context?.includes("$2,401.64") === false,
  );

  console.log("\na new file");
  const beforeNewFile = state.amount;
  await drop(page, "statement-12-months.csv");
  // wait for the new file to actually replace the old one
  await page.waitForFunction(
    () => (document.querySelector("[data-file-chip]")?.innerText ?? "").includes("statement-12-months"),
    { timeout: 20000 },
  );
  await new Promise((r) => setTimeout(r, 400));
  state = await probe(page);
  check(
    "the headline still equals the sum of the rows",
    Number(state.amount.replace(/[^0-9.]/g, "")),
    state.rowSum,
  );
  check("and the same number of charges", state.rowAmounts.length, 14);
  truthy(
    "the monthly cost is about the same",
    Math.abs(Number(state.amount.replace(/[^0-9.]/g, "")) - Number(beforeNewFile.replace(/[^0-9.]/g, ""))) < 50,
  );

  console.log("\nwhen every charge has an owner");
  const beforeClaimAll = state.amount;
  for (let i = 0; i < 20; i += 1) {
    const remaining = await page.evaluate(
      () => document.querySelectorAll('[data-recurring-group] button[aria-label^="Add an owner"]').length,
    );
    if (remaining === 0) break;

    await page.evaluate(() => {
      document.querySelector('[data-recurring-group] button[aria-label^="Add an owner"]').click();
    });
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-recurring-group] input[type="text"]:focus')),
      { timeout: 5000 },
    );
    await page.keyboard.type("Sam");
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await new Promise((resolve) => setTimeout(resolve, 300));

  state = await probe(page);
  truthy("the unowned clause is gone", !state.context?.includes("has no owner"));
  truthy("the line is back to plain", state.context?.includes("across 14 recurring charges"));
  check("the headline is untouched", state.amount, beforeClaimAll);

  console.log("\nmobile, 320px");  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 320, height: 720 });
  await mobile.goto(url, { waitUntil: "networkidle0" });
  await mobile.evaluate(() => window.localStorage.clear());
  await mobile.reload({ waitUntil: "networkidle0" });
  await drop(mobile, "statement-3-months.csv");
  await mobile.waitForSelector("[data-total-panel]", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));

  const m = await probe(mobile);
  check("nothing overflows", m.overflow, 0);
  truthy("the number still fits", m.amountBox.w <= m.panelBox.w);
  truthy("the number is smaller on mobile", m.fontSize < 40);
  truthy("but still the biggest thing there", m.fontSize >= 28);
  await mobile.screenshot({ path: path.join(outDir, "total-mobile.png") });
  console.log("shot  total-mobile");
  await mobile.close();

  console.log(`\n${failures.length === 0 ? "all checks passed" : `${failures.length} failed`}`);
  if (failures.length) {
    for (const failure of failures) console.log(`  - ${failure}`);
  }
} finally {
  await browser.close();
}

process.exit(failures.length ? 1 : 0);
