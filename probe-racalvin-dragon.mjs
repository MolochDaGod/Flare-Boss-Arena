/**
 * E2E smoke: Racalvin vs forced dragon boss on /game.
 * Usage: node probe-racalvin-dragon.mjs [baseUrl]
 * Example: node probe-racalvin-dragon.mjs http://localhost:5173
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const url = `${base}/game?boss=boss_noble_dragon`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("grudge:fighter", "racalvin");
});
const page = await context.newPage();

const errors = [];
const glbLoads = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (res) => {
  const u = res.url();
  if (u.includes(".glb") && (u.includes("racalvin") || u.includes("bosses"))) {
    glbLoads.push({ url: u, status: res.status() });
  }
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

// Wait for canvas + game boot (Grudge data + WebGL scene).
await page.waitForSelector("canvas", { timeout: 90000 });
await page.waitForFunction(
  () => {
    const body = document.body.innerText;
    return body.includes("Noble Dragon") || body.includes("stirs in the western ruins");
  },
  { timeout: 90000 },
);

await page.waitForTimeout(8000);

const bodyText = await page.textContent("body");
const hasRacalvin = /racalvin|corsair king|brothers/i.test(bodyText ?? "");
const hasDragonBoss =
  /noble dragon/i.test(bodyText ?? "") || /stirs in the western ruins/i.test(bodyText ?? "");
const combatLines = (bodyText ?? "")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

// Fight: move toward boss area, basic attack + Mind Shot (psychic pistol).
const canvas = await page.$("canvas");
if (canvas) {
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.42);
    await page.waitForTimeout(1500);
    await page.keyboard.press("KeyF");
    await page.waitForTimeout(800);
    await page.keyboard.press("Digit2");
    await page.waitForTimeout(1200);
    await page.keyboard.press("KeyR");
    await page.waitForTimeout(1500);
  }
}

const bodyAfter = await page.textContent("body");
const fought =
  /mind shot|psymic|corsair cleave|noble dragon|damage|defeated/i.test(bodyAfter ?? "");

const racalvinGlbs = glbLoads.filter((g) => g.url.includes("racalvin"));
const bossGlbs = glbLoads.filter((g) => g.url.includes("bosses"));
const racalvinOk = racalvinGlbs.some((g) => g.url.includes("base.glb") && g.status === 200);
const bossOk = bossGlbs.some((g) => g.url.includes("noble_dragon") && g.status === 200);

const pass =
  racalvinOk &&
  bossOk &&
  hasDragonBoss &&
  errors.length === 0;

const result = {
  url,
  pass,
  hasRacalvinHud: hasRacalvin,
  hasDragonBossLog: hasDragonBoss,
  fought,
  racalvinGlbs,
  bossGlbs,
  pageErrors: errors.slice(0, 8),
  combatSample: combatLines.slice(0, 12),
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);