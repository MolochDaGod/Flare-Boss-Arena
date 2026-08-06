/**
 * Stage CraftPix product 172265 — RPG Magic Icons & Spellbook Pixel UI Pack
 *
 * Author pack (all files under PNG/):
 *   Icons.png        576×320 → 18×10 grid of **32×32** spell icons (up to 180)
 *   sells_full.png   96×144  → skill slot frames (3×3 @ 32×48)
 *   info_tileset.png 128×336 → tooltip / info panel 9-slice + gems
 *   boik_page.png    272×192 → open book page chrome (typo in author pack)
 *   book_content.png 336×480 → school gems, banners, spell tags, ornaments
 *   Text1/2.png       font samples (preview only)
 *
 * Out:
 *   artifacts/grudge-game/public/ui/craftpix/spellbook/**
 *   artifacts/grudge-game/src/data/spellbookCatalog.json
 *   grudge-ui-editor/assets/craftpix/spellbook/**
 *
 * Usage: node scripts/stage-spellbook-pack.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    const pnpm = path.join(ROOT, "node_modules/.pnpm");
    const candidates = fs.readdirSync(pnpm).filter((d) => d.startsWith("sharp@"));
    if (!candidates.length) throw new Error("sharp not found — run pnpm install");
    // Prefer newest
    candidates.sort();
    const last = candidates[candidates.length - 1];
    return require(path.join(pnpm, last, "node_modules/sharp"));
  }
}
const sharp = loadSharp();

const SRC_ROOT = "D:/Games/Models/craftpix-rpg-magic-spellbook-ui";
const PNG = path.join(SRC_ROOT, "PNG");
const OUT_FLARE = path.join(ROOT, "artifacts/grudge-game/public/ui/craftpix/spellbook");
const OUT_DATA = path.join(ROOT, "artifacts/grudge-game/src/data/spellbookCatalog.json");
const OUT_UI = "C:/Users/nugye/Documents/grudge-ui-editor/assets/craftpix/spellbook";

const ICON_CS = 32; // HARD: Icons.png is 32×32 cells (576/32=18, 320/32=10)
const ICON_OUT = 96; // nearest upscale for UI

/** Preferred display names by school (cycle as needed for extras). */
const SCHOOL_NAMES = {
  fire: [
    "blazing_sword",
    "fire_shield",
    "fire_strike",
    "fireball",
    "fire_whirlwind",
    "meteor",
    "fire_ring",
    "fire_wing",
    "fire_arrow",
    "fire_heart",
    "ember",
    "inferno",
    "flame_burst",
    "scorch",
    "pyre",
  ],
  air: [
    "air_blade",
    "air_shield",
    "lightning_feather",
    "air_strike",
    "nullification",
    "air_wave",
    "air_strike_2",
    "air_storm",
    "air_discharge",
    "air_target",
    "gust",
    "cyclone",
    "thunder",
    "gale",
    "zephyr",
  ],
  water: [
    "water_blade",
    "water_vortex",
    "water_drop",
    "freeze_cube",
    "freeze_figure",
    "ice_crystal",
    "snowflake",
    "gust_of_wind",
    "bubble_cluster",
    "fountain",
    "tidal",
    "frost_bolt",
    "ice_shield",
    "mist",
    "torrent",
  ],
  earth: [
    "earth_blade",
    "earth_shield",
    "earth_fist",
    "earth_globe",
    "earth_golem",
    "earth_gust",
    "stone_pillars",
    "grass_slash",
    "tree_summoning",
    "earth_figure",
    "leaf",
    "boulder",
    "vine",
    "quake",
    "root",
  ],
};

const ACCENTS = {
  fire: "#e85d2a",
  air: "#5ab0e8",
  water: "#3d8fd4",
  earth: "#6a9a3a",
};

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function wipeDir(d) {
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  ensureDir(d);
}

function titleCase(s) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Dominant school from pixel hue (cyan → air, blue → water, red-orange → fire, green-brown → earth). */
function schoolFromPixels(rgba, w, h) {
  let fire = 0,
    water = 0,
    air = 0,
    earth = 0,
    n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 40) continue;
    const r = rgba[i],
      g = rgba[i + 1],
      b = rgba[i + 2];
    n++;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    if (mx < 30) continue;
    const sat = (mx - mn) / mx;
    if (sat < 0.12) continue;
    const rr = r / 255,
      gg = g / 255,
      bb = b / 255;
    const M = Math.max(rr, gg, bb),
      m = Math.min(rr, gg, bb);
    const d = M - m;
    let H = 0;
    if (d > 0.001) {
      if (M === rr) H = ((gg - bb) / d) % 6;
      else if (M === gg) H = (bb - rr) / d + 2;
      else H = (rr - gg) / d + 4;
      H *= 60;
      if (H < 0) H += 360;
    }
    // fire red-orange-yellow
    if (H < 48 || H > 345) {
      if (r > g) fire += 2;
      else fire += 1;
    } else if (H >= 48 && H < 85 && r > 90) {
      fire += 1; // gold flame
    } else if (H >= 85 && H < 165) {
      earth += 2; // green
    } else if (H >= 165 && H < 195 && g > 90 && b > 90) {
      air += 2; // cyan
    } else if (H >= 195 && H < 255) {
      if (g > r + 10 && Math.abs(g - b) < 40) air += 1.5;
      else water += 2; // pure blue
    } else if (H >= 25 && H < 55 && r > 100 && g > 60 && b < 100) {
      earth += 1; // brown/gold earth
    } else if (r > 80 && g > 50 && b < 70 && r >= g) {
      earth += 1;
    }
  }
  if (n < 8) return null;
  const scores = { fire, air, water, earth };
  let best = "air",
    bestV = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestV) {
      best = k;
      bestV = v;
    }
  }
  return bestV > 0 ? best : null;
}

async function sliceIcons() {
  const iconsSrc = path.join(PNG, "Icons.png");
  const meta = await sharp(iconsSrc).metadata();
  const cols = Math.floor(meta.width / ICON_CS);
  const rows = Math.floor(meta.height / ICON_CS);
  const { data, info } = await sharp(iconsSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  function cellAlphaRatio(c, r) {
    let n = 0,
      tot = 0;
    for (let y = r * ICON_CS; y < r * ICON_CS + ICON_CS && y < h; y++) {
      for (let x = c * ICON_CS; x < c * ICON_CS + ICON_CS && x < w; x++) {
        tot++;
        if (data[(y * w + x) * 4 + 3] > 28) n++;
      }
    }
    return tot ? n / tot : 0;
  }

  function cellRgba(c, r) {
    const buf = Buffer.alloc(ICON_CS * ICON_CS * 4);
    let i = 0;
    for (let y = r * ICON_CS; y < r * ICON_CS + ICON_CS; y++) {
      for (let x = c * ICON_CS; x < c * ICON_CS + ICON_CS; x++) {
        const si = (y * w + x) * 4;
        buf[i++] = data[si];
        buf[i++] = data[si + 1];
        buf[i++] = data[si + 2];
        buf[i++] = data[si + 3];
      }
    }
    return buf;
  }

  const iconsDirF = path.join(OUT_FLARE, "icons");
  const iconsDirU = path.join(OUT_UI, "icons");
  wipeDir(iconsDirF);
  wipeDir(iconsDirU);

  const schoolCounters = { fire: 0, air: 0, water: 0, earth: 0 };
  const icons = [];
  let seq = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cellAlphaRatio(c, r) < 0.08) continue;
      // Author Icons.png is a 2×2 school layout (verified against sheet):
      //   top-left water · top-right earth · bottom-left fire · bottom-right air
      const left = c < cols / 2;
      const top = r < rows / 2;
      let school = top
        ? left
          ? "water"
          : "earth"
        : left
          ? "fire"
          : "air";
      // Optional hue nudge only when strongly disagrees (keeps frame variants in zone)
      const rgba = cellRgba(c, r);
      const hueSchool = schoolFromPixels(rgba, ICON_CS, ICON_CS);
      if (hueSchool && hueSchool !== school) {
        // keep positional school — sheet quadrants are authoritative for this pack
      }
      void hueSchool;
      const names = SCHOOL_NAMES[school];
      const ni = schoolCounters[school]++;
      const name = names[ni] ?? `spell_${String(ni).padStart(2, "0")}`;
      const id = `${school}_${name}`;
      const file = `icons/${id}.png`;
      // disambiguate collisions
      let finalId = id;
      let finalFile = file;
      if (icons.some((x) => x.id === finalId)) {
        finalId = `${id}_${c}_${r}`;
        finalFile = `icons/${finalId}.png`;
      }

      const raw = await sharp(iconsSrc)
        .extract({ left: c * ICON_CS, top: r * ICON_CS, width: ICON_CS, height: ICON_CS })
        .png()
        .toBuffer();
      const up = await sharp(raw).resize(ICON_OUT, ICON_OUT, { kernel: "nearest" }).png().toBuffer();
      const baseName = path.basename(finalFile);
      fs.writeFileSync(path.join(iconsDirF, baseName), up);
      fs.writeFileSync(path.join(iconsDirU, baseName), up);

      icons.push({
        id: finalId,
        school,
        name: finalId.replace(`${school}_`, ""),
        label: titleCase(finalId.replace(`${school}_`, "")),
        file: finalFile,
        tile: { col: c, row: r, size: ICON_CS },
        index: seq++,
      });
    }
  }

  // Contact sheet for QA
  const sheetCols = 18;
  const sheetRows = Math.ceil(icons.length / sheetCols) || 1;
  const composites = [];
  for (let i = 0; i < icons.length; i++) {
    const ic = icons[i];
    const buf = fs.readFileSync(path.join(iconsDirF, path.basename(ic.file)));
    composites.push({
      input: await sharp(buf).resize(ICON_CS, ICON_CS, { kernel: "nearest" }).png().toBuffer(),
      left: (i % sheetCols) * ICON_CS,
      top: Math.floor(i / sheetCols) * ICON_CS,
    });
  }
  await sharp({
    create: {
      width: sheetCols * ICON_CS,
      height: sheetRows * ICON_CS,
      channels: 4,
      background: { r: 8, g: 6, b: 4, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(OUT_FLARE, "icons_contact.png"));
  fs.copyFileSync(path.join(OUT_FLARE, "icons_contact.png"), path.join(OUT_UI, "icons_contact.png"));

  console.log(
    `Icons: ${icons.length} @ ${ICON_CS}px → ${ICON_OUT}px  schools`,
    Object.fromEntries(["fire", "air", "water", "earth"].map((s) => [s, icons.filter((i) => i.school === s).length])),
  );
  return icons;
}

/** Slice skill slot frames from sells_full.png (3×3 frames). */
async function sliceSlots() {
  const src = path.join(PNG, "sells_full.png");
  const meta = await sharp(src).metadata();
  // Author: 96×144 — 3 cols × 3 rows of ornate slot plates
  const cols = 3;
  const rows = 3;
  const sw = Math.floor(meta.width / cols);
  const sh = Math.floor(meta.height / rows);
  const slotsDirF = path.join(OUT_FLARE, "slots");
  const slotsDirU = path.join(OUT_UI, "slots");
  wipeDir(slotsDirF);
  wipeDir(slotsDirU);

  const slots = [];
  const kinds = [
    "slot_a",
    "slot_b",
    "slot_c",
    "slot_d",
    "slot_e",
    "slot_f",
    "slot_g",
    "slot_h",
    "slot_i",
  ];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const kind = kinds[i++] ?? `slot_${c}_${r}`;
      const raw = await sharp(src)
        .extract({ left: c * sw, top: r * sh, width: sw, height: sh })
        .png()
        .toBuffer();
      // Upscale nearest for crisp UI (×3)
      const up = await sharp(raw).resize(sw * 3, sh * 3, { kernel: "nearest" }).png().toBuffer();
      const file = `slots/${kind}.png`;
      fs.writeFileSync(path.join(slotsDirF, `${kind}.png`), up);
      fs.writeFileSync(path.join(slotsDirU, `${kind}.png`), up);
      slots.push({
        id: kind,
        file,
        role: r === 0 ? "top" : r === 1 ? "mid" : "bottom",
        col: c,
        row: r,
      });
    }
  }
  // Also keep full sheet
  fs.copyFileSync(src, path.join(OUT_FLARE, "sells_full.png"));
  fs.copyFileSync(src, path.join(OUT_UI, "sells_full.png"));
  // Default slot alias
  fs.copyFileSync(path.join(slotsDirF, "slot_e.png"), path.join(slotsDirF, "slot_default.png"));
  fs.copyFileSync(path.join(slotsDirU, "slot_e.png"), path.join(slotsDirU, "slot_default.png"));
  slots.push({ id: "slot_default", file: "slots/slot_default.png", role: "default", col: 1, row: 1 });
  console.log(`Slots: ${slots.length} frames (${sw}×${sh} → ${sw * 3}×${sh * 3})`);
  return slots;
}

/** Extract useful pieces from info_tileset + book_content for chrome. */
async function sliceChrome() {
  const chrome = {
    bookPage: "book_page.png",
    bookContent: "book_content.png",
    infoTileset: "info_tileset.png",
    slotTileset: "sells_full.png",
    iconsSheet: "Icons.png",
    fontSample1: "Text1.png",
    fontSample2: "Text2.png",
    slotDefault: "slots/slot_default.png",
  };

  // Copy master sheets (rename boik → book_page)
  const copies = [
    ["book_content.png", "book_content.png"],
    ["boik_page.png", "book_page.png"],
    ["info_tileset.png", "info_tileset.png"],
    ["Icons.png", "Icons.png"],
    ["Text1.png", "Text1.png"],
    ["Text2.png", "Text2.png"],
  ];
  for (const [from, to] of copies) {
    const s = path.join(PNG, from);
    if (!fs.existsSync(s)) continue;
    fs.copyFileSync(s, path.join(OUT_FLARE, to));
    fs.copyFileSync(s, path.join(OUT_UI, to));
  }

  // School gems from book_content (top row of colored orbs) — approximate crops
  // book_content is 336×480; gems sit in upper rows
  const bc = path.join(PNG, "book_content.png");
  const gemsDirF = path.join(OUT_FLARE, "gems");
  const gemsDirU = path.join(OUT_UI, "gems");
  wipeDir(gemsDirF);
  wipeDir(gemsDirU);

  // Empirically: top gems row ~ y=8..56, four main orbs spaced across ~336
  const gemDefs = [
    { id: "gem_fire", x: 24, y: 8, w: 56, h: 48 },
    { id: "gem_water", x: 100, y: 8, w: 56, h: 48 },
    { id: "gem_earth", x: 176, y: 8, w: 56, h: 48 },
    { id: "gem_air", x: 252, y: 8, w: 56, h: 48 },
  ];
  const gems = [];
  for (const g of gemDefs) {
    try {
      const raw = await sharp(bc)
        .extract({ left: g.x, top: g.y, width: g.w, height: g.h })
        .png()
        .toBuffer();
      const up = await sharp(raw).resize(g.w * 2, g.h * 2, { kernel: "nearest" }).png().toBuffer();
      const file = `gems/${g.id}.png`;
      fs.writeFileSync(path.join(gemsDirF, `${g.id}.png`), up);
      fs.writeFileSync(path.join(gemsDirU, `${g.id}.png`), up);
      gems.push({ id: g.id, file, school: g.id.replace("gem_", "") });
      chrome[g.id] = file;
    } catch (e) {
      console.warn("gem slice fail", g.id, e.message);
    }
  }

  // Info panel slices from info_tileset (top small frames + mid panel)
  const info = path.join(PNG, "info_tileset.png");
  const panelsDirF = path.join(OUT_FLARE, "panels");
  const panelsDirU = path.join(OUT_UI, "panels");
  wipeDir(panelsDirF);
  wipeDir(panelsDirU);
  const panels = [
    { id: "panel_small_a", x: 0, y: 0, w: 64, h: 48 },
    { id: "panel_small_b", x: 64, y: 0, w: 64, h: 48 },
    { id: "panel_dialog", x: 0, y: 80, w: 128, h: 96 },
  ];
  for (const p of panels) {
    try {
      const raw = await sharp(info)
        .extract({ left: p.x, top: p.y, width: p.w, height: p.h })
        .png()
        .toBuffer();
      const up = await sharp(raw).resize(p.w * 2, p.h * 2, { kernel: "nearest" }).png().toBuffer();
      const file = `panels/${p.id}.png`;
      fs.writeFileSync(path.join(panelsDirF, `${p.id}.png`), up);
      fs.writeFileSync(path.join(panelsDirU, `${p.id}.png`), up);
      chrome[p.id] = file;
    } catch (e) {
      console.warn("panel slice fail", p.id, e.message);
    }
  }

  console.log(`Chrome: book + ${gems.length} gems + panels`);
  return { chrome, gems };
}

async function main() {
  if (!fs.existsSync(PNG)) {
    throw new Error(`Pack PNG folder missing: ${PNG} — unzip craftpix-net-172265 first`);
  }

  ensureDir(OUT_FLARE);
  ensureDir(OUT_UI);
  // clean stale wrong-size icons
  wipeDir(path.join(OUT_FLARE, "icons"));
  wipeDir(path.join(OUT_UI, "icons"));
  // remove preview junk
  const prev = path.join(OUT_FLARE, "_preview");
  if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });

  const icons = await sliceIcons();
  const slots = await sliceSlots();
  const { chrome, gems } = await sliceChrome();

  const bySchool = { fire: 0, air: 0, water: 0, earth: 0 };
  for (const ic of icons) bySchool[ic.school] = (bySchool[ic.school] || 0) + 1;

  const firstBooks = [
    {
      id: "book_fire_novice",
      school: "fire",
      title: "Ember Primer",
      blurb: "First fire arts — strike and shield.",
      unlockSkillIds: icons.filter((i) => i.school === "fire").slice(0, 2).map((i) => i.id),
    },
    {
      id: "book_water_novice",
      school: "water",
      title: "Frost Primer",
      blurb: "First water arts — chill and ward.",
      unlockSkillIds: icons.filter((i) => i.school === "water").slice(0, 2).map((i) => i.id),
    },
    {
      id: "book_earth_novice",
      school: "earth",
      title: "Stone Primer",
      blurb: "First earth arts — fist and shield.",
      unlockSkillIds: icons.filter((i) => i.school === "earth").slice(0, 2).map((i) => i.id),
    },
    {
      id: "book_air_novice",
      school: "air",
      title: "Gale Primer",
      blurb: "First air arts — blade and discharge.",
      unlockSkillIds: icons.filter((i) => i.school === "air").slice(0, 2).map((i) => i.id),
    },
  ];

  const catalog = {
    pack: "craftpix-net-172265-rpg-magic-icons-spellbook-pixel-ui-pack",
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceDisk: SRC_ROOT,
    flarePublic: "public/ui/craftpix/spellbook",
    uiStudio: "assets/craftpix/spellbook",
    iconCellSize: ICON_CS,
    iconDisplaySize: ICON_OUT,
    schools: ["fire", "air", "water", "earth"].map((id) => ({
      id,
      label:
        id === "fire"
          ? "Fire Magic"
          : id === "air"
            ? "Air Magic"
            : id === "water"
              ? "Water Magic"
              : "Earth Magic",
      accent: ACCENTS[id],
      iconCount: bySchool[id] || 0,
      gem: chrome[`gem_${id}`] ?? null,
    })),
    chrome,
    slots,
    gems,
    icons,
    firstBooks,
  };

  const json = JSON.stringify(catalog, null, 2);
  fs.writeFileSync(path.join(OUT_FLARE, "catalog.json"), json);
  fs.writeFileSync(path.join(OUT_UI, "catalog.json"), json);
  fs.writeFileSync(OUT_DATA, json);

  console.log(`\nDone. ${icons.length} icons, ${slots.length} slots → Flare + ui-editor`);
  console.log(`Flare: ${OUT_FLARE}`);
  console.log(`UI:    ${OUT_UI}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
