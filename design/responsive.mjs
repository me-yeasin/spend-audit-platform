// Dev-only: responsive sweep — no horizontal overflow at any breakpoint,
// in both the landing state and the parsed workspace.
// Usage: node design/responsive.mjs [url]
import puppeteer from "puppeteer-core";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.argv[2] ?? "http://localhost:4000";
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "test-data");
const outDir = path.join(here, "shots");

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const widths = [320, 390, 768, 1024, 1440];
const failures = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});

const csv = await readFile(path.join(dataDir, "statement-3-months.csv"), "utf8");

for (const width of widths) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  const landing = await page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  await page.evaluate((body) => {
    const dt = new DataTransfer();
    dt.items.add(new File([body], "statement-3-months.csv", { type: "text/csv" }));
    window.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
  }, csv);
  await page.waitForSelector("[data-transactions-panel]");
  await new Promise((r) => setTimeout(r, 300));

  const workspace = await page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  // Nothing inside the panel may be wider than the panel itself.
  const clipped = await page.evaluate(() => {
    const panel = document.querySelector("[data-transactions-panel]");
    const panelBox = panel.getBoundingClientRect();
    return [...panel.querySelectorAll("*")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && (box.right > panelBox.right + 1 || box.left < panelBox.left - 1);
      })
      .map((el) => `${el.tagName}.${el.className}`.slice(0, 60));
  });

  const ok = landing === 0 && workspace === 0 && clipped.length === 0;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${String(width).padStart(4)}px  landing=${landing}  workspace=${workspace}  clipped=${clipped.length}`,
  );
  if (!ok) {
    failures.push(`${width}px landing=${landing} workspace=${workspace} clipped=${clipped.join(" | ")}`);
  }

  await page.screenshot({
    path: path.join(outDir, `responsive-${width}-workspace.png`),
  });
  await page.close();
}

await browser.close();

console.log(
  failures.length === 0
    ? "\nno overflow at any breakpoint"
    : `\n${failures.length} breakpoint(s) failed:\n${failures.join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
