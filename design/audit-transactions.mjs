// Dev-only: structural audit of the transaction panel — layout, colors, a11y.
// Usage: node design/audit-transactions.mjs [url]
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
await page.setViewport({ width: 1440, height: 1000 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const content = await readFile(path.join(dataDir, "statement-3-months.csv"), "utf8");
await page.evaluate((body) => {
  const dt = new DataTransfer();
  dt.items.add(new File([body], "statement-3-months.csv", { type: "text/csv" }));
  window.dispatchEvent(
    new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
  );
}, content);
await page.waitForSelector("[data-transactions-panel]");
await new Promise((r) => setTimeout(r, 400));

const report = await page.evaluate(() => {
  const pick = (el, props) => {
    const style = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
  };

  const panel = document.querySelector("[data-transactions-panel]");
  const chip = document.querySelector("[data-file-chip]");
  const heading = panel.querySelector("h2");
  const count = panel.querySelector("h2 + span");
  const sort = [...panel.querySelectorAll("p")].find((p) =>
    p.textContent.includes("Newest first"),
  );
  const columns = [...panel.querySelectorAll("div")].find((d) =>
    d.textContent.trim() === "DateDescriptionAmount",
  );
  const group = panel.querySelector("[data-month-group] > div");
  const row = panel.querySelector("[data-row]");
  const rowDesktop = row.querySelector(".hidden.sm\\:grid");
  const cells = rowDesktop ? [...rowDesktop.children] : [];
  const amount = cells[2];
  const footer = panel.querySelector("[data-panel-footer]");

  return {
    panelBox: panel.getBoundingClientRect().toJSON(),
    panelStyle: pick(panel.firstElementChild, [
      "background-color",
      "border-top-left-radius",
      "border-top-width",
      "border-top-color",
      "box-shadow",
    ]),
    chipBox: chip.getBoundingClientRect().toJSON(),
    heading: { text: heading.textContent, ...pick(heading, ["font-size", "font-weight", "color"]) },
    count: { text: count.textContent, ...pick(count, ["background-color", "color", "border-top-left-radius"]) },
    sort: { text: sort.textContent.trim(), ...pick(sort, ["font-size", "color"]) },
    columns: columns
      ? {
          display: getComputedStyle(columns).display,
          position: getComputedStyle(columns).position,
          top: getComputedStyle(columns).top,
          zIndex: getComputedStyle(columns).zIndex,
          background: getComputedStyle(columns).backgroundColor,
          fontSize: getComputedStyle(columns).fontSize,
          letterSpacing: getComputedStyle(columns).letterSpacing,
          gridTemplateColumns: getComputedStyle(columns).gridTemplateColumns,
        }
      : null,
    group: group
      ? {
          text: group.textContent.replace(/\s+/g, " ").trim(),
          background: getComputedStyle(group).backgroundColor,
          labelSize: getComputedStyle(group.querySelector("span")).fontSize,
          letterSpacing: getComputedStyle(group.querySelector("span")).letterSpacing,
        }
      : null,
    row: {
      height: row.getBoundingClientRect().height,
      borderBottom: getComputedStyle(row).borderBottomColor,
      display: getComputedStyle(row).display,
    },
    cells: cells.map((c) => ({
      text: c.textContent.trim(),
      fontSize: getComputedStyle(c).fontSize,
      color: getComputedStyle(c).color,
      fontVariantNumeric: getComputedStyle(c).fontVariantNumeric,
      textAlign: getComputedStyle(c).textAlign,
      width: Math.round(c.getBoundingClientRect().width),
    })),
    amount: amount ? { text: amount.textContent.trim(), color: getComputedStyle(amount).color } : null,
    footer: {
      text: footer.textContent.replace(/\s+/g, " ").trim(),
      fontSize: getComputedStyle(footer).fontSize,
      color: getComputedStyle(footer).color,
    },
    headings: [...document.querySelectorAll("h1,h2")].map((h) => `${h.tagName}: ${h.textContent.trim()}`),
    a11y: {
      panelLabelledBy: panel.getAttribute("aria-labelledby"),
      headingId: heading.id,
      countIsNumber: /^\d+$/.test(count.textContent.trim()),
      listSemantics: panel.querySelectorAll("ul > li").length,
      liveRegions: document.querySelectorAll("[aria-live]").length,
    },
  };
});

console.log(JSON.stringify(report, null, 2));

// mobile layout check
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 300));
const mobile = await page.evaluate(() => {
  const row = document.querySelector("[data-row]");
  const mobileBlock = row.querySelector(".sm\\:hidden");
  const desktopBlock = row.querySelector(".hidden.sm\\:grid");
  const desc = mobileBlock.querySelector("p");
  const meta = mobileBlock.querySelector("div");
  const cs = (el) => getComputedStyle(el);
  return {
    mobileBlockDisplay: cs(mobileBlock).display,
    desktopBlockDisplay: cs(desktopBlock).display,
    description: {
      text: desc.textContent.trim(),
      fontSize: cs(desc).fontSize,
      fontWeight: cs(desc).fontWeight,
      overflow: cs(desc).textOverflow,
      whiteSpace: cs(desc).whiteSpace,
    },
    meta: {
      date: meta.children[0].textContent.trim(),
      dateSize: cs(meta.children[0]).fontSize,
      amount: meta.children[1].textContent.trim(),
      amountSize: cs(meta.children[1]).fontSize,
      amountColor: cs(meta.children[1]).color,
      display: cs(meta).display,
    },
    columnsHidden: getComputedStyle(
      [...document.querySelectorAll("[data-transactions-panel] div")].find((d) =>
        d.textContent.trim() === "DateDescriptionAmount",
      ),
    ).display,
    overflow:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
console.log(JSON.stringify({ mobile }, null, 2));

await browser.close();
