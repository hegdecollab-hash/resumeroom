// Headless browser walkthrough + screenshots. Makes real AI calls (1 generate, 1 evaluate, 1 probe).
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "../resumeroom-shots";
const testPdf = process.argv[4] ?? null; // optional real resume PDF (never committed)
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
const requests = [];
page.on("request", (r) => {
  if (r.method() === "POST") requests.push(new URL(r.url()).host + new URL(r.url()).pathname);
});
const log = (...a) => console.log(...a);

async function overflow() {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

// 1. Two-column PDF built in the browser, used to test local extraction.
const pdfPage = await ctx.newPage();
await pdfPage.setContent(`<html><body style="font-family:Arial;display:grid;grid-template-columns:1fr 1fr;gap:60px;padding:30px">
<div><h2>Jordan Lee (synthetic)</h2><p>jordan@example.com</p><h3>Experience</h3><p>Backend Engineer, Acme Data (fictional), 2020 - Present</p>
<ul><li>Designed a Kafka event pipeline processing order events.</li><li>Cut p95 latency of the search API by caching results in Redis.</li><li>Led migration from REST polling to webhooks for partner integrations.</li></ul></div>
<div><h3>Skills</h3><p>Go, Python, Kafka, Redis, PostgreSQL, Docker</p><h3>Projects</h3><p>Ledger Lite: double-entry bookkeeping CLI in Go with property-based tests.</p><h3>Education</h3><p>B.Eng. Software, Riverbend University (fictional)</p></div></body></html>`);
writeFileSync("/tmp/two-column.pdf", await pdfPage.pdf({ format: "A4" }));
writeFileSync("/tmp/not-a-pdf.pdf", "hello this is text");
await pdfPage.close();

// Landing
for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/landing-${w}.png`, fullPage: true });
  log(`landing ${w}: overflow=${await overflow()}`);
}

// Practice: PDF extraction checks
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base + "/practice", { waitUntil: "networkidle" });
await page.setInputFiles("#resume-file", "/tmp/not-a-pdf.pdf");
await page.getByText("This file isn't a PDF").waitFor();
log("bad pdf: rejected with message");
await page.setInputFiles("#resume-file", "/tmp/two-column.pdf");
await page.getByText(/Read two-column.pdf/).waitFor({ timeout: 20000 });
const extracted = await page.locator("#resumeText").inputValue();
const leftFirst = extracted.indexOf("webhooks") < extracted.indexOf("Skills");
log(`two-column pdf: ${extracted.length} chars, left column before right: ${leftFirst}`);
await page.screenshot({ path: `${out}/practice-pdf-extracted-1440.png`, fullPage: true });

// Resume for the AI flow: a real PDF if provided, otherwise the synthetic sample.
if (testPdf) {
  await page.goto(base + "/practice", { waitUntil: "networkidle" });
  await page.locator("#resumeText").fill("");
  await page.setInputFiles("#resume-file", testPdf);
  await page.getByText(/^Read /).waitFor({ timeout: 30000 });
  log(`test pdf: extracted ${(await page.locator("#resumeText").inputValue()).length} chars`);
} else {
  await page.goto(base + "/practice?sample=1", { waitUntil: "networkidle" });
  await page.locator("#resumeText").waitFor();
}
for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/practice-${w}.png`, fullPage: true });
  log(`practice ${w}: overflow=${await overflow()}`);
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByRole("radio", { name: "5", exact: true }).click();
await page.getByRole("button", { name: "Show exactly what will be sent" }).click();
const outgoing = await page.locator("pre").first().innerText();
writeFileSync("/tmp/outgoing-resume.txt", outgoing);
const leaks = (outgoing.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).length;
log(`outgoing redaction: emails remaining in outgoing text=${leaks}`);

// Generate (real AI)
await page.getByRole("button", { name: "Generate questions" }).click();
await page.waitForURL(/\/session\//, { timeout: 90000 });
const sessionUrl = page.url();
await page.locator("#q-heading").waitFor();
log(`session created: ${sessionUrl.replace(base, "")}`);
for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/session-${w}.png`, fullPage: true });
  log(`session ${w}: overflow=${await overflow()}`);
}
await page.setViewportSize({ width: 1440, height: 900 });

// Answer + refresh persistence + evaluate (real AI)
const answer =
  "In that work I first reproduced the problem and measured a baseline. I compared two approaches, picked the simpler one because it was easier to test, wrote integration tests, and checked the result against the baseline afterwards. Next time I would add monitoring earlier.";
await page.locator("#answer").fill(answer);
await page.waitForTimeout(300);
await page.reload({ waitUntil: "networkidle" });
const persisted = (await page.locator("#answer").inputValue()) === answer;
log(`draft survives refresh: ${persisted}`);
await page.getByRole("button", { name: "Check my answer" }).click();
await page.getByText(/Feedback · attempt 1/).waitFor({ timeout: 90000 });
await page.getByText("Example answer").or(page.getByText("Example structure")).first().click();
for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/feedback-${w}.png`, fullPage: true });
  log(`feedback ${w}: overflow=${await overflow()}`);
}
await page.setViewportSize({ width: 1440, height: 900 });

// Probe (real AI)
const probeBtn = page.getByRole("button", { name: "Answer a follow-up" });
if (await probeBtn.isVisible()) {
  await probeBtn.click();
  try {
    await page.getByText(/Follow-up 1 of 2/).waitFor({ timeout: 90000 });
    log("probe created");
  } catch {
    log(
      `probe failed: ${await page
        .getByRole("alert")
        .first()
        .innerText()
        .catch(() => "unknown")}`,
    );
  }
  await page.screenshot({ path: `${out}/probe-1440.png`, fullPage: true });
}

// Skip one, then finish → report
await page.goto(sessionUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Finish practice" }).click();
await page.waitForURL(/\/report$/);
await page.getByText("Practice report").waitFor();
for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/report-${w}.png`, fullPage: true });
  log(`report ${w}: overflow=${await overflow()}`);
}

// Missing session
await page.goto(base + "/session/does-not-exist", { waitUntil: "networkidle" });
await page.getByText("Session not found on this device").waitFor();
await page.screenshot({ path: `${out}/session-missing-390.png`, fullPage: true });
log("missing session: handled");

const robots = await page.goto(base + sessionUrl.replace(base, ""));
log(`session X-Robots-Tag: ${robots.headers()["x-robots-tag"]}`);

// Only same-origin POSTs
const hosts = [...new Set(requests.map((r) => r.split("/")[0]))];
log(`POST hosts seen: ${hosts.join(", ")} | POST paths: ${[...new Set(requests)].join(", ")}`);
log(`browser errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
