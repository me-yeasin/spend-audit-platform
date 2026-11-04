// Dev-only: verify the transaction list end to end against the real fixtures.
// Usage: node design/qa-transactions.mjs [url]
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

/** Row and month counts straight from the fixture, so the UI is checked against the file. */
const fixtureInfo = async (file) => {
  const content = await readFile(path.join(dataDir, file), "utf8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const rows = lines.length - 1;
  const months = new Set(
    lines.slice(1).map((line) => line.split(",")[0].slice(0, 7)),
  ).size;
  return { rows, months };
};

const overflow = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

const probe = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector("[data-transactions-panel]");
    const chip = document.querySelector("[data-file-chip]");
    const card = document.querySelector("[data-upload-card]");
    const rows = [...document.querySelectorAll("[data-row]")];
    const groups = [...document.querySelectorAll("[data-month-group]")];
    const firstRow = rows[0]
      ? rows[0].innerText.replace(/\s+/g, " ").trim()
      : null;
    const headings = [...document.querySelectorAll("main h1")];
    return {
      hasHero: headings.some((h) => h.textContent.includes("quietly paying")),
      hasWorkspaceHeading: headings.some((h) =>
        h.textContent.includes("Your statement transactions"),
      ),
      hasPanel: Boolean(panel),
      hasChip: Boolean(chip),
      cardState: card ? card.dataset.state : null,
      chipText: chip ? chip.innerText.replace(/\s+/g, " ").trim() : null,
      panelText: panel ? panel.innerText.replace(/\s+/g, " ").trim() : null,
      count: panel?.querySelector("h2 + span")?.textContent?.trim() ?? null,
      rows: rows.length,
      groups: groups.length,
      groupLabels: groups.map((g) =>
        (g.querySelector("span")?.textContent ?? "").trim(),
      ),
      firstRow,
      footer: panel
        ? (panel.querySelector("[data-panel-footer]")?.innerText ?? "")
            .replace(/\s+/g, " ")
            .trim()
        : null,
      showMore: Boolean(
        [...(panel?.querySelectorAll("button") ?? [])].find((b) =>
          b.textContent.includes("more"),
        ),
      ),
    };
  });

const waitFor = async (page, fn, timeout = 20000) => {
  await page.waitForFunction(fn, { timeout });
  await new Promise((r) => setTimeout(r, 250));
};

// ------------------------------------------------------------------ desktop
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  let s = await probe(page);
  check("landing shows hero", s.hasHero, true);
  check("landing hides panel", s.hasPanel, false);
  check("landing card state", s.cardState, "idle");

  // 1. three months
  const three = await fixtureInfo("statement-3-months.csv");
  await drop(page, "statement-3-months.csv");
  await waitFor(page, () => Boolean(document.querySelector("[data-transactions-panel]")));
  s = await probe(page);
  check("3mo: hero collapsed", s.hasHero, false);
  check("3mo: workspace heading for screen readers", s.hasWorkspaceHeading, true);
  check("3mo: chip visible", s.hasChip, true);
  check("3mo: chip shows rows", s.chipText.includes(`${three.rows} rows`), true);
  check("3mo: panel count", s.count, String(three.rows));
  check("3mo: rows rendered", s.rows, three.rows);
  check("3mo: month groups", s.groups, three.months);
  check("3mo: newest month first", s.groupLabels[0], "OCTOBER 2026");
  check("3mo: newest row", s.firstRow?.startsWith("26 Oct 2026 AMAZON MARKETPLACE"), true);
  check("3mo: footer count", s.footer?.startsWith(`${three.rows} transactions`), true);
  check("3mo: footer range", s.footer?.includes("1 Aug – 26 Oct 2026"), true);
  check("3mo: no horizontal overflow", await overflow(page), 0);
  await shot(page, "txn-3mo");

  // 2. remove returns to the landing page
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-file-chip] button")].find((b) =>
      b.textContent.includes("Remove"),
    );
    button?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  s = await probe(page);
  check("remove: hero back", s.hasHero, true);
  check("remove: workspace heading gone", s.hasWorkspaceHeading, false);
  check("remove: chip gone", s.hasChip, false);
  check("remove: card idle", s.cardState, "idle");

  // 3. twelve months
  const twelve = await fixtureInfo("statement-12-months.csv");
  await drop(page, "statement-12-months.csv");
  await waitFor(page, () =>
    document
      .querySelector("[data-transactions-panel] h2 + span")
      ?.textContent?.trim() === "250",
  );
  s = await probe(page);
  check("12mo: panel count", s.count, String(twelve.rows));
  check("12mo: rows rendered", s.rows, twelve.rows);
  check("12mo: month groups", s.groups, twelve.months);
  check("12mo: newest month first", s.groupLabels[0], "OCTOBER 2026");
  check("12mo: overflow", await overflow(page), 0);
  await shot(page, "txn-12mo");
  // 4. large file — pagination
  const large = await fixtureInfo("large-statement.csv");
  await drop(page, "large-statement.csv");
  await waitFor(page, () =>
    document
      .querySelector("[data-transactions-panel] h2 + span")
      ?.textContent?.trim() === "24,000",
  );
  s = await probe(page);
  check("large: panel count", s.count, large.rows.toLocaleString());
  check("large: first page rows", s.rows, 500);
  check("large: show more present", s.showMore, true);
  check("large: footer shows the split", s.footer?.startsWith("Showing 500 of 24,000 transactions"), true);
  check("large: overflow", await overflow(page), 0);

  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-transactions-panel] button")].find(
      (b) => b.textContent.includes("more"),
    );
    button?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  s = await probe(page);
  check("large: rows after show more", s.rows, 1000);
  await shot(page, "txn-large");

  // 4. header only -> no rows
  await drop(page, "header-only.csv");
  await waitFor(page, () =>
    document
      .querySelector("[data-transactions-panel]")
      ?.innerText?.includes("No transactions found"),
  );
  s = await probe(page);
  check("header-only: empty state", s.panelText?.includes("No transactions found"), true);
  check("header-only: no rows rendered", s.rows, 0);
  await shot(page, "txn-empty");

  // 5. unreadable columns
  await drop(page, "unreadable.csv");
  await waitFor(page, () =>
    document
      .querySelector("[data-transactions-panel]")
      ?.innerText?.includes("Couldn’t read"),
  );
  s = await probe(page);
  check("unreadable: error state", s.panelText?.includes("Couldn’t read this statement"), true);
  check("unreadable: no rows rendered", s.rows, 0);
  await shot(page, "txn-unreadable");

  // 6. wrong file type still shows the card error
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["%PDF-1.7"], "statement.pdf", { type: "application/pdf" }));
    window.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
  });
  await new Promise((r) => setTimeout(r, 500));
  s = await probe(page);
  check("pdf: card error state", s.cardState, "error");
  check("pdf: hero stays collapsed", s.hasHero, false);
  await shot(page, "txn-pdf-error");

  await page.close();
}

// ------------------------------------------------------------------- mobile
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  await drop(page, "statement-3-months.csv");
  await waitFor(page, () => Boolean(document.querySelector("[data-transactions-panel]")));

  const s = await probe(page);
  check("mobile: panel count", s.count, "62");
  check("mobile: rows rendered", s.rows, 62);
  check("mobile: month groups", s.groups, 3);
  check("mobile: overflow", await overflow(page), 0);
  await shot(page, "txn-mobile");
  await page.screenshot({
    path: path.join(outDir, "txn-mobile-full.png"),
    fullPage: true,
  });

  await page.close();
}

await browser.close();

console.log(
  failures.length === 0
    ? "\nall checks passed"
    : `\n${failures.length} check(s) failed:\n${failures.join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
