// Dev-only: drive the upload card through every state and screenshot it.
// Usage: node design/states.mjs [url]
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

const shot = async (page, name) => {
  const path = decodeURIComponent(
    new URL(`${name}.png`, outDir).pathname.replace(/^\//, ""),
  );
  await page.screenshot({ path });
  console.log("shot", name);
};

const dropFile = (page, { name, type, content }) =>
  page.evaluate(
    ({ name, type, content }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([content], name, { type }));
      window.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
    },
    { name, type, content },
  );

const dragIn = (page, { name, type, content }) =>
  page.evaluate(
    ({ name, type, content }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([content], name, { type }));
      document
        .querySelector("[data-upload-card]")
        .dispatchEvent(
          new DragEvent("dragenter", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          }),
        );
    },
    { name, type, content },
  );

const dragOut = (page) =>
  page.evaluate(() => {
    document
      .querySelector("[data-upload-card]")
      .dispatchEvent(
        new DragEvent("dragleave", { bubbles: true, cancelable: true }),
      );
  });

const state = (page) =>
  page.$eval("[data-upload-card]", (el) => el.dataset.state);

const csv = (rows) => {
  const head = "Date,Description,Amount\n";
  let body = "";
  for (let i = 0; i < rows; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    body += `2026-10-${day},"SUBSCRIPTION ${i}",-${(i % 90) + 9}.99\n`;
  }
  return head + body;
};

const overflow = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

// ---------------------------------------------------------------- desktop
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  console.log("idle state:", await state(page), "overflow", await overflow(page));
  await shot(page, "upload-idle");

  await dragIn(page, { name: "statement-oct-2026.csv", type: "text/csv", content: csv(5) });
  await new Promise((r) => setTimeout(r, 200));
  console.log("dragging state:", await state(page));
  await shot(page, "upload-dragging");
  await dragOut(page);
  await new Promise((r) => setTimeout(r, 200));

  await dropFile(page, { name: "statement.pdf", type: "application/pdf", content: "%PDF" });
  await new Promise((r) => setTimeout(r, 300));
  console.log("error state:", await state(page));
  await shot(page, "upload-error");

  await page.reload({ waitUntil: "networkidle0" });
  await dropFile(page, { name: "statement-oct-2026.csv", type: "text/csv", content: csv(4000) });
  await new Promise((r) => setTimeout(r, 160));
  console.log("reading state:", await state(page));
  await shot(page, "upload-reading");

  await page.waitForFunction(
    () => Boolean(document.querySelector("[data-file-chip]")),
    { timeout: 15000 },
  );
  await new Promise((r) => setTimeout(r, 250));
  console.log("imported state: workspace chip visible");
  await shot(page, "upload-ready");

  await page.close();
}

// ----------------------------------------------------------------- mobile
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  console.log("mobile idle overflow:", await overflow(page));
  await shot(page, "upload-idle-mobile");

  await page.evaluate(() => {
    document
      .querySelector("[data-upload-card]")
      .dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        }),
      );
  });
  await new Promise((r) => setTimeout(r, 150));
  await shot(page, "upload-dragging-mobile");

  await page.reload({ waitUntil: "networkidle0" });
  await dropFile(page, { name: "october-statement.csv", type: "text/csv", content: csv(128) });
  await page.waitForFunction(
    () => Boolean(document.querySelector("[data-file-chip]")),
    { timeout: 15000 },
  );
  await new Promise((r) => setTimeout(r, 250));
  await shot(page, "upload-ready-mobile");
  console.log("mobile ready overflow:", await overflow(page));
  await page.close();
}

await browser.close();
