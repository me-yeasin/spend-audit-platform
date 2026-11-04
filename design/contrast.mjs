// Dev-only: WCAG contrast check for the transaction panel text.
// Usage: node design/contrast.mjs [url]
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const csv = await readFile(path.join(dataDir, "statement-3-months.csv"), "utf8");
await page.evaluate((body) => {
  const dt = new DataTransfer();
  dt.items.add(new File([body], "statement-3-months.csv", { type: "text/csv" }));
  window.dispatchEvent(
    new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
  );
}, csv);
await page.waitForSelector("[data-transactions-panel]");
await new Promise((r) => setTimeout(r, 300));

const results = await page.evaluate(() => {
  const parse = (color) => {
    const m = color.match(/[\d.]+/g).map(Number);
    if (m.length >= 4 && m[3] === 0) return null;
    return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
  };
  const over = (fg, bg) => fg.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const bgOf = (el) => {
    let node = el;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) return c.a === 1 ? [c.r, c.g, c.b] : over(c, [255, 255, 255]);
      node = node.parentElement;
    }
    return [255, 255, 255];
  };

  const samples = [];
  const add = (label, el) => {
    if (!el) return;
    const style = getComputedStyle(el);
    const fg = parse(style.color);
    if (!fg) return;
    const bg = bgOf(el);
    const fgFlat = fg.a === 1 ? [fg.r, fg.g, fg.b] : over(fg, bg);
    const size = Number.parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    samples.push({
      label,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 26),
      size,
      weight,
      ratio: Number(ratio(fgFlat, bg).toFixed(2)),
      required: large ? 3 : 4.5,
    });
  };

  const panel = document.querySelector("[data-transactions-panel]");
  add("panel heading", panel.querySelector("h2"));
  add("count pill", panel.querySelector("h2 + span"));
  add("sort label", [...panel.querySelectorAll("p")].find((p) => p.textContent.includes("Newest first")));
  add("column labels", [...panel.querySelectorAll("div")].find((d) => d.textContent.trim() === "DateDescriptionAmount"));
  const group = panel.querySelector("[data-month-group]");
  add("month label", group.querySelector("span"));
  add("month count", group.querySelectorAll("span")[1]);
  const row = panel.querySelector("[data-row]");
  const cells = row.querySelectorAll(".hidden.sm\\:grid > span");
  add("row date", cells[0]);
  add("row description", cells[1]);
  add("row amount", cells[2]);
  add("footer text", panel.querySelector("[data-panel-footer] p"));
  const chip = document.querySelector("[data-file-chip]");
  add("chip name", chip.querySelector("p"));
  add("chip meta", chip.querySelectorAll("p")[1]);

  // the recurring panel
  const recurring = document.querySelector("[data-recurring-panel]");
  if (recurring) {
    add("recurring heading", recurring.querySelector("h2"));
    add("recurring count", recurring.querySelector("h2 + span"));
    add(
      "recurring sort",
      [...recurring.querySelectorAll("p")].find((p) => p.textContent.includes("Largest first")),
    );
    const recurringRow = recurring.querySelector("[data-recurring-group]");
    const name = recurringRow.querySelector("button > span > span");
    add("recurring name", name);
    add("recurring evidence", name.nextElementSibling);
    add("recurring cadence", recurringRow.querySelector("button .rounded-full"));
    const amount = recurringRow.querySelector("button > span:last-of-type > span");
    add("recurring amount", amount);
    add("recurring per month", amount.nextElementSibling);
    add("recurring footer", recurring.querySelector("[data-panel-footer] p"));
    const addOwner = recurringRow.querySelector('button[aria-label^="Add an owner"]');
    add("add owner", addOwner);
  }

  // the flagged panel
  const flagged = document.querySelector("[data-flagged-panel]");
  if (flagged) {
    add("flagged heading", flagged.querySelector("h2"));
    add("flagged count", flagged.querySelector("h2 + span"));
    add(
      "flagged note",
      [...flagged.querySelectorAll("p")].find((p) => p.textContent.includes("Nobody has claimed")),
    );
    const flaggedRow = flagged.querySelector("[data-flagged-row]");
    const flaggedName = flaggedRow.querySelector("[data-flagged-name]");
    add("flagged name", flaggedName);
    add("flagged evidence", flaggedRow.querySelector("[data-flagged-evidence]"));
    const flaggedAmount = flaggedRow.querySelector("[data-flagged-amount]");
    add("flagged amount", flaggedAmount);
    add("flagged per month", flaggedAmount.nextElementSibling);
    add("flagged add owner", flaggedRow.querySelector('button[aria-label^="Add an owner"]'));
    add(
      "flagged footer",
      [...flagged.querySelectorAll("p")].find((p) => p.textContent.includes("Name an owner")),
    );
  }

  return samples;
});

let failed = 0;
for (const s of results) {
  const ok = s.ratio >= s.required;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${s.label.padEnd(18)} ${String(s.ratio).padStart(6)}:1  (needs ${s.required})  ${s.size}px/${s.weight}  "${s.text}"`,
  );
}

await browser.close();
console.log(failed === 0 ? "\nall contrast checks pass" : `\n${failed} contrast failure(s)`);
process.exit(failed === 0 ? 0 : 1);
