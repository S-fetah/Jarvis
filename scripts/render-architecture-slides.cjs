/**
 * Render docs/architecture-slides.html to docs/architecture-slides.pdf
 * (vector, 1280x720 per page) using Playwright + Chromium.
 *
 * Self-contained: resolves a playwright package and a Chromium executable
 * without any global install. Used by the status-deck skill
 * (.agents/skills/status-deck/SKILL.md).
 *
 * Usage:  node scripts/render-architecture-slides.cjs [input.html] [output.pdf]
 *
 * Environment overrides (optional):
 *   PLAYWRIGHT_PATH      directory containing the playwright package (node_modules)
 *   PLAYWRIGHT_CHROMIUM_PATH  full path to a chrome.exe to use directly
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const input = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "docs", "architecture-slides.html"));
const output = path.resolve(process.argv[3] ?? path.join(__dirname, "..", "docs", "architecture-slides.pdf"));

function loadPlaywright() {
  const Module = require("module");
  const roots = [];
  if (process.env.PLAYWRIGHT_PATH) roots.push(process.env.PLAYWRIGHT_PATH);
  roots.push(path.join(os.homedir(), "pdf-tools", "node_modules"));
  try {
    roots.push(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim());
  } catch (_) {}
  roots.push(path.join(__dirname, "..", "node_modules"));

  for (const base of roots) {
    const pkg = path.join(base, "playwright", "package.json");
    if (fs.existsSync(pkg)) {
      try {
        return Module.createRequire(pkg)("playwright");
      } catch (_) {}
    }
  }
  console.error("playwright package not found. Bootstrap once:");
  console.error('  mkdir "%USERPROFILE%\\pdf-tools" && cd /d "%USERPROFILE%\\pdf-tools"');
  console.error("  set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 && npm install playwright");
  process.exit(1);
}

function resolveChromiumExecutable(playwright) {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  try {
    const exe = playwright.chromium.executablePath();
    if (exe && fs.existsSync(exe)) return exe;
  } catch (_) {}

  // Newest downloaded browser from the shared Playwright cache
  const cache = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (fs.existsSync(cache)) {
    const dirs = fs
      .readdirSync(cache)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const d of dirs) {
      for (const sub of ["chrome-win64", "chrome-win"]) {
        const exe = path.join(cache, d, sub, "chrome.exe");
        if (fs.existsSync(exe)) return exe;
      }
    }
  }

  // Last resort: system Edge (Chromium-based)
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (fs.existsSync(edge)) return edge;

  return null;
}

(async () => {
  if (!fs.existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  const playwright = loadPlaywright();
  const exe = resolveChromiumExecutable(playwright);
  if (!exe) {
    console.error("No Chromium found. Set PLAYWRIGHT_CHROMIUM_PATH or run: npx playwright install chromium");
    process.exit(1);
  }
  console.log(`Chromium: ${exe}`);

  const browser = await playwright.chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("file:///" + input.replace(/\\/g, "/"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  await page.pdf({
    path: output,
    width: "1280px",
    height: "720px",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  const size = (fs.statSync(output).size / 1024).toFixed(1);
  console.log(`PDF written: ${output} (${size} KB)`);
})().catch((error) => {
  console.error(`Render failed: ${error.message}`);
  process.exit(1);
});
