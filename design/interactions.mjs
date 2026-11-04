// Dev-only: interaction checks — sticky header, truncation, focus rings.
// Usage: node design/interactions.mjs [url]
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:4000";

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

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

// ---------------------------------------------------------------- keyboard
const focusLanding = await page.evaluate(() => {
  const input = document.querySelector('input[type="file"]');
  input.focus();
  return { focused: document.activeElement === input };
});
check("landing: file input is focusable", focusLanding.focused, true);

// The focus ring on the drop zone must be clearly visible once the
// transition settles, not just present in the cascade.
await new Promise((r) => setTimeout(r, 500));
const ring = await page.evaluate(() => {
  const label = document.querySelector("label");
  const shadow = getComputedStyle(label).boxShadow;
  const layers = shadow.split(/,(?![^(]*\))/).map((s) => s.trim());
  const ringLayer = layers.find((l) => /lab\(|rgb\(|rgba\(/.test(l) && !/0px 0px 0px 0px/.test(l));
  const match = ringLayer?.match(/([\d.]+)\)$/);
  const alpha = ringLayer?.includes("/") ? Number(ringLayer.split("/")[1].replace(")", "")) : 1;
  return {
    hasVisibleRing: Boolean(ringLayer),
    ringAlpha: alpha,
    spread: match ? Number(match[1]) : 0,
  };
});
check("drop zone shows a focus ring", ring.hasVisibleRing, true);
check("focus ring is opaque enough to see", ring.ringAlpha >= 0.9, true);

await page.keyboard.press("Tab");
const focusRing = await page.evaluate(() => {
  const active = document.activeElement;
  const style = getComputedStyle(active);
  return {
    tag: active.tagName,
    text: (active.textContent ?? "").trim().slice(0, 24),
    outlineWidth: style.outlineWidth,
    outlineStyle: style.outlineStyle,
    boxShadow: style.boxShadow === "none" ? "none" : "present",
  };
});
console.log("focus after tab:", JSON.stringify(focusRing));

// ------------------------------------------- a tall statement with long text
const longName =
  "THE VERY LONG MERCHANT NAME THAT SHOULD BE TRUNCATED GRACEFULLY INSIDE THE LIST ROW WITHOUT WIDENING THE PANEL";
const csv = [
  "Date,Description,Amount",
  ...Array.from({ length: 60 }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String((i % 3) + 8).padStart(2, "0");
    return `2026-${month}-${day},"${longName} ${i}",-${(i % 90) + 9}.99`;
  }),
].join("\n");

await page.evaluate((body) => {
  const dt = new DataTransfer();
  dt.items.add(new File([body], "long-description.csv", { type: "text/csv" }));
  window.dispatchEvent(
    new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
  );
}, csv);
await page.waitForSelector("[data-transactions-panel]");
await new Promise((r) => setTimeout(r, 300));

// 1. long descriptions truncate instead of widening the row
const truncation = await page.evaluate(() => {
  const row = [...document.querySelectorAll("[data-row]")][0];
  const cell = row.querySelector(".hidden.sm\\:grid > span:nth-child(2)");
  const rowBox = row.getBoundingClientRect();
  const cellBox = cell.getBoundingClientRect();
  return {
    overflow: getComputedStyle(cell).textOverflow,
    clipped: cell.scrollWidth > cell.clientWidth,
    staysInRow: cellBox.right <= rowBox.right + 1,
    documentOverflow:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
check("long description truncates", truncation.overflow, "ellipsis");
check("long description is clipped", truncation.clipped, true);
check("long description stays inside the row", truncation.staysInRow, true);
check("long description causes no page overflow", truncation.documentOverflow, 0);

// 2. the column header stays pinned while the list scrolls
await page.evaluate(() => window.scrollTo(0, 1400));
await new Promise((r) => setTimeout(r, 300));
const sticky = await page.evaluate(() => {
  const header = [...document.querySelectorAll("[data-transactions-panel] div")].find(
    (d) => d.textContent.trim() === "DateDescriptionAmount",
  );
  return {
    scrollY: Math.round(window.scrollY),
    top: Math.round(header.getBoundingClientRect().top),
    position: getComputedStyle(header).position,
    visible: header.getBoundingClientRect().bottom > 0,
  };
});
check("the page really scrolled", sticky.scrollY, 1400);
check("column header is sticky", sticky.position, "sticky");
check("column header stays pinned at the top", sticky.top, 0);
check("column header is still visible", sticky.visible, true);
await page.evaluate(() => window.scrollTo(0, 0));

// 3. workspace actions are real buttons
const actions = await page.evaluate(() => {
  const chip = document.querySelector("[data-file-chip]");
  const panel = document.querySelector("[data-transactions-panel]");
  return {
    chipButtons: [...chip.querySelectorAll("button")].map((b) => b.textContent.trim()),
    panelButtons: [...panel.querySelectorAll("button")].map((b) => b.textContent.trim()),
    panelHasList: panel.querySelectorAll("ul > li").length,
  };
});
check("chip offers replace and remove", actions.chipButtons.join("|"), "Replace file|Remove");
check("panel is a list", actions.panelHasList > 0, true);
console.log("panel actions:", JSON.stringify(actions.panelButtons));

// 4. the workspace announces itself to screen readers
const a11y = await page.evaluate(() => {
  const panel = document.querySelector("[data-transactions-panel]");
  const heading = panel.querySelector("h2");
  // The live regions live on the page outside the panels, so they are on
  // the screen before the file is read and can announce the first load.
  const live = [...document.querySelectorAll("[role='status']")].map((el) =>
    (el.textContent ?? "").trim(),
  );
  return {
    live,
    labelledBy: panel.getAttribute("aria-labelledby"),
    headingId: heading?.id,
    oneHeading: document.querySelectorAll("main h1").length === 1,
    // no two landmarks may share a name
    landmarkNames: [...document.querySelectorAll("main section, main [role='region']")]
      .map((el) => el.getAttribute("aria-label") ?? el.getAttribute("aria-labelledby"))
      .filter(Boolean),
  };
});
check(
  "the workspace announces what was loaded",
  a11y.live.some((text) => text.includes("transactions loaded")),
  true,
);
check(
  "and says when nothing recurs",
  a11y.live.some((text) => text.includes("No recurring charges found")),
  true,
);
const spoken = a11y.live.filter(Boolean);
check("nothing is announced twice", new Set(spoken).size, spoken.length);
check("panel is labelled by its heading", a11y.labelledBy, a11y.headingId);
check("exactly one h1 on the page", a11y.oneHeading, true);
check(
  "no two landmarks share a name",
  new Set(a11y.landmarkNames).size,
  a11y.landmarkNames.length,
);

await browser.close();

console.log(
  failures.length === 0
    ? "\nall checks passed"
    : `\n${failures.length} check(s) failed:\n${failures.join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
