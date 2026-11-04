// Dev-only: verify owner flagging in the browser — assigning, clearing,
// persistence across a reload, and the layout of both panels.
//
// Usage: node design/qa-owners-panel.mjs [url]
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
    const flagged = document.querySelector("[data-flagged-panel]");
    const rows = [...document.querySelectorAll("[data-flagged-row]")];
    const groups = [...document.querySelectorAll("[data-recurring-group]")];
    return {
      hasFlagged: Boolean(flagged),
      flaggedHeading: flagged?.querySelector("h2")?.textContent?.trim() ?? null,
      flaggedCount: flagged?.querySelector("h2 + span")?.textContent?.trim() ?? null,
      flaggedRows: rows.length,
      flaggedNames: rows.map(
        (row) => row.querySelector("[data-flagged-name]")?.textContent?.trim() ?? "",
      ),
      firstFlaggedText: rows[0]?.innerText.replace(/\s+/g, " ").trim() ?? null,
      groupCount: groups.length,
      ownerPills: groups.filter((group) => /owner|^\s*\w+\s*$/i.test(group.innerText)).length,
      addOwnerButtons: document.querySelectorAll('[data-flagged-panel] button[aria-label^="Add an owner"]')
        .length,
      namedPills: [...document.querySelectorAll("[data-recurring-group]")].filter((group) =>
        group.querySelector('[aria-label^="Remove "]'),
      ).length,
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  // start from a clean slate
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });

  // ------------------------------------------------------- flagged list
  console.log("\nthe flagged list");
  await drop(page, "statement-3-months.csv");
  await page.waitForSelector("[data-flagged-panel]", { timeout: 15000 });

  let state = await probe(page);
  check("the flagged panel is present", state.hasFlagged, true);
  check("its heading", state.flaggedHeading, "Needs an owner");
  check("it counts the charges", state.flaggedCount, "14");
  check("it lists every charge", state.flaggedRows, 14);
  check("the recurring panel still lists them all", state.groupCount, 14);
  check("nothing overflows", state.overflow, 0);
  truthy(
    "a flagged row shows the count and the total",
    state.firstFlaggedText?.includes("payments") && state.firstFlaggedText?.includes("total"),
  );
  await shot(page, "owners-flagged");

  // ------------------------------------------------- assign from the top
  console.log("\nassigning an owner");
  await page.evaluate(() => {
    document.querySelector('[data-flagged-panel] button[aria-label^="Add an owner"]').click();
  });
  await page.waitForSelector('[data-flagged-panel] input[type="text"]', { timeout: 5000 });

  const editing = await page.evaluate(() => {
    const input = document.querySelector('[data-flagged-panel] input[type="text"]');
    return {
      exists: Boolean(input),
      focused: document.activeElement === input,
      labelled: Boolean(input?.getAttribute("aria-label")),
    };
  });
  check("an input appears", editing.exists, true);
  check("it takes focus", editing.focused, true);
  check("it is labelled", editing.labelled, true);
  await shot(page, "owners-editing");

  await page.type('[data-flagged-panel] input[type="text"]', "Sam");
  await page.keyboard.press("Enter");
  await new Promise((resolve) => setTimeout(resolve, 250));

  state = await probe(page);
  check("the charge leaves the flagged list", state.flaggedRows, 13);
  check("the count follows", state.flaggedCount, "13");
  check("the recurring panel still has all 14", state.groupCount, 14);
  check("one charge now shows an owner", state.namedPills, 1);

  const namedRow = await page.evaluate(() => {
    const group = [...document.querySelectorAll("[data-recurring-group]")].find((item) =>
      item.querySelector('[aria-label^="Remove "]'),
    );
    return group?.innerText.replace(/\s+/g, " ").trim() ?? null;
  });
  truthy("the owner name is shown on the row", namedRow?.includes("Sam"));

  // --------------------------------------------------- owner persists
  console.log("\nowners survive a reload");
  await page.reload({ waitUntil: "networkidle0" });
  await drop(page, "statement-3-months.csv");
  await page.waitForSelector("[data-flagged-panel]", { timeout: 15000 });
  state = await probe(page);
  check("the owned charge stays owned", state.namedPills, 1);
  check("and it is still out of the flagged list", state.flaggedRows, 13);

  const stored = await page.evaluate(() => window.localStorage.getItem("spend-audit.owners.v1"));
  truthy("it is stored in the browser", stored?.includes("Sam"));

  // ------------------------------------------------------ clear an owner
  console.log("\nclearing an owner");
  await page.evaluate(() => {
    document.querySelector('[data-recurring-group] [aria-label^="Remove "]').click();
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  state = await probe(page);
  check("the charge comes back to the flagged list", state.flaggedRows, 14);
  check("and the owner pill is gone", state.namedPills, 0);

  // ----------------------------------------------------- assign in the list
  console.log("\nassigning from the recurring list");
  await page.evaluate(() => {
    document
      .querySelectorAll("[data-recurring-group]")
      [0].querySelector('button[aria-label^="Add an owner"]')
      .click();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector("[data-recurring-group] input[type='text']:focus")),
    { timeout: 5000 },
  );
  await page.keyboard.type("Kim");
  await page.keyboard.press("Enter");
  await new Promise((resolve) => setTimeout(resolve, 250));
  state = await probe(page);
  check("the charge leaves the flagged list", state.flaggedRows, 13);
  check("and shows its owner", state.namedPills, 1);

  // the roster of known names is offered as a suggestion
  await page.evaluate(() => {
    document
      .querySelectorAll("[data-recurring-group]")
      [1].querySelector('button[aria-label^="Add an owner"]')
      .click();
  });
  await page.waitForSelector("[data-recurring-group] input[type='text']", { timeout: 5000 });
  const suggestions = await page.evaluate(() => {
    const input = document.querySelector("[data-recurring-group] input[type='text']");
    const list = document.getElementById(input.getAttribute("list"));
    return [...(list?.options ?? [])].map((option) => option.value);
  });
  check("previous owners are suggested", suggestions.join(","), "Kim");
  await page.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, 200));
  const cancelled = await page.evaluate(
    () => document.querySelectorAll("[data-recurring-group] input[type='text']").length,
  );
  check("escape cancels the edit", cancelled, 0);

  // -------------------------------------------- the disclosure still works
  console.log("\nthe row still expands");
  await page.evaluate(() => {
    document.querySelectorAll("[data-recurring-group] button")[0].click();
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const expanded = await page.evaluate(
    () => document.querySelectorAll("[data-recurring-group] ul li").length,
  );
  check("the payments still open", expanded, 3);

  // ------------------------------------------- owner control is reachable
  console.log("\nkeyboard access");
  const keyboard = await page.evaluate(() => {
    const group = [...document.querySelectorAll("[data-recurring-group]")].find((item) =>
      item.querySelector('button[aria-label^="Add an owner"]'),
    );
    const expandButton = group?.querySelector("button");
    const ownerButton = group?.querySelector('button[aria-label^="Add an owner"]');
    return {
      nested: Boolean(expandButton?.querySelector('button[aria-label^="Add an owner"]')),
      ownerExists: Boolean(ownerButton),
      ownerLabel: ownerButton?.getAttribute("aria-label") ?? null,
    };
  });
  check("the owner control is not inside the expand button", keyboard.nested, false);
  truthy("the owner control exists", keyboard.ownerExists);
  truthy("and it names the charge", keyboard.ownerLabel?.includes("owner"));

  // ------------------------------------------------- everything is owned
  console.log("\nwhen every charge has an owner");
  for (let i = 0; i < 20; i += 1) {
    const remaining = await page.evaluate(
      () => document.querySelectorAll('[data-recurring-group] button[aria-label^="Add an owner"]').length,
    );
    if (remaining === 0) break;

    await page.evaluate(() => {
      document.querySelector('[data-recurring-group] button[aria-label^="Add an owner"]').click();
    });
    // wait for the editor that was just opened to hold the caret
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-recurring-group] input[type="text"]:focus')),
      { timeout: 5000 },
    );
    await page.keyboard.type("Sam");
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  state = await probe(page);
  check("the flagged panel is gone", state.hasFlagged, false);
  check("no charge is left without an owner", state.namedPills, 14);
  check("the recurring panel is untouched", state.groupCount, 14);
  await shot(page, "owners-all-assigned");

  // ------------------------------------------------------------- mobile
  console.log("\nmobile layout");
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 320, height: 720 });
  await mobile.goto(url, { waitUntil: "networkidle0" });
  await mobile.evaluate(() => window.localStorage.clear());
  await mobile.reload({ waitUntil: "networkidle0" });
  await drop(mobile, "statement-3-months.csv");
  await mobile.waitForSelector("[data-flagged-panel]", { timeout: 15000 });

  const mobileState = await mobile.evaluate(() => {
    const row = document.querySelector("[data-flagged-row]");
    const name = row.querySelector("[data-flagged-name]");
    const control = row.querySelector('button[aria-label^="Add an owner"]');
    const amount = row.querySelector("[data-flagged-amount]");
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
    };
    return {
      controlBelowName: box(control).y > box(name).y,
      controlWidth: box(control).w,
      amountY: box(amount).y,
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check("the owner control drops below the name", mobileState.controlBelowName, true);
  check("nothing overflows at 320px", mobileState.overflow, 0);
  await shot(mobile, "owners-mobile");
  await mobile.close();

  console.log(`\n${failures.length === 0 ? "all checks passed" : `${failures.length} failed`}`);
  if (failures.length) {
    for (const failure of failures) console.log(`  - ${failure}`);
  }
} finally {
  await browser.close();
}

process.exit(failures.length ? 1 : 0);
