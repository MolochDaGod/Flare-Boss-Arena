import { chromium } from "playwright";

const base = (process.argv[2] ?? "https://flare-boss-arena.vercel.app").replace(/\/$/, "");
const url = `${base}/select`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("grudge:fighter", "racalvin");
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 90000 });
await page.waitForTimeout(3000);

const cog = page.locator('button[aria-label="Open weapon editor"]');
const cogVisible = await cog.isVisible();
await cog.click();
await page.waitForTimeout(800);

const editorTitle = await page.getByText("Weapon Editor").isVisible();
const moveSection = await page.getByText("Move", { exact: true }).first().isVisible();
const rotateSection = await page.getByText("Rotate", { exact: true }).first().isVisible();
const scaleSection = await page.getByText("Scale", { exact: true }).first().isVisible();
const positionLabel = await page.getByText("Position (hand local)").isVisible();

// Drag a move slider
const sliders = page.locator('[role="slider"]');
const sliderCount = await sliders.count();
let sliderMoved = false;
if (sliderCount > 0) {
  const first = sliders.first();
  const box = await first.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2);
    sliderMoved = true;
  }
}

const pass =
  cogVisible &&
  editorTitle &&
  moveSection &&
  rotateSection &&
  scaleSection &&
  positionLabel &&
  sliderCount >= 8 &&
  errors.length === 0;

console.log(
  JSON.stringify(
    {
      url,
      pass,
      cogVisible,
      editorTitle,
      moveSection,
      rotateSection,
      scaleSection,
      positionLabel,
      sliderCount,
      sliderMoved,
      pageErrors: errors.slice(0, 5),
    },
    null,
    2,
  ),
);

await browser.close();
process.exit(pass ? 0 : 1);