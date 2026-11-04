// Dev-only helper: capture viewport-accurate screenshots of the running app.
// Usage: node design/shoot.mjs [url]
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const url = process.argv[2] ?? "http://localhost:4000";
const outDir = new URL("./shots/", import.meta.url);
await mkdir(outDir, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});

const shots = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 780 },
];

for (const s of shots) {
  const page = await browser.newPage();
  await page.setViewport({
    width: s.width,
    height: s.height,
    deviceScaleFactor: 1,
  });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 250));
  const path = new URL(`${s.name}.png`, outDir).pathname.replace(/^\//, "");
  await page.screenshot({ path: decodeURIComponent(path) });
  const fullPath = new URL(`${s.name}-full.png`, outDir).pathname.replace(
    /^\//,
    "",
  );
  await page.screenshot({
    path: decodeURIComponent(fullPath),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`${s.name}: ${s.width}x${s.height} overflowX=${overflow}px`);
  await page.close();
}

await browser.close();
