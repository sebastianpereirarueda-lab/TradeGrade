// Regenerates the fluid-art background used by the app.
// Usage: node scripts/background/render.mjs [width=2560] [seed=13] [out=src/assets/bg-fluid.webp]
// Needs Playwright with a Chromium build (npx playwright install chromium, or set CHROMIUM_PATH).
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [w = "2560", seed = "13", out = "src/assets/bg-fluid.webp"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.goto(`file://${resolve(here, "gen.html")}?w=${w}&seed=${seed}`);
await page.waitForFunction(() => window.DONE === true, null, { timeout: 120000 });
const data = await page.evaluate(() => document.getElementById("c").toDataURL("image/webp", 0.82));
writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
console.log(`wrote ${out}`);
await browser.close();
