/**
 * Headless browser check: dashboard shows non-zero "… min exercise" in the hero.
 * Requires a running server: PORT=3010 npm run start (after npm run build).
 *
 *   BASE_URL=http://127.0.0.1:3010 npx tsx scripts/e2e-exercise-smoke.ts
 */
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3010";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(5000);
  const body = await page.locator("body").innerText();
  const hero = body.match(/(\d+)\s+min exercise/i);
  if (!hero) {
    throw new Error(
      "Could not find hero pattern 'N min exercise'. Is the dashboard loading?"
    );
  }
  const n = parseInt(hero[1], 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Hero exercise minutes not positive: got "${hero[1]}"`);
  }
  const tile = body.match(/Exercise\s*\n?\s*(\d+)\s*min/i);
  if (tile) {
    const t = parseInt(tile[1], 10);
    if (!Number.isFinite(t) || t <= 0) {
      throw new Error(`Completion tile exercise not positive: got "${tile[1]}"`);
    }
    console.log("OK: hero", n, "min exercise; Completion tile", t, "min");
  } else {
    console.log("OK: hero", n, "min exercise (Completion tile pattern not matched)");
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
