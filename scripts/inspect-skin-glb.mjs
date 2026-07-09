#!/usr/bin/env node
/**
 * Inspect bounty-rush skin GLBs: parse the JSON chunk, list animation clip
 * names, and report whether they match the labelled suffix scheme.
 *
 * Usage:
 *   node scripts/inspect-skin-glb.mjs <file.glb> [file2.glb ...]
 *   node scripts/inspect-skin-glb.mjs --copy --dest <dir> --map id=source.glb ...
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Bounty-rush labelled clip suffixes (matched with endsWith, case-insensitive). */
export const BOUNTY_RUSH_SUFFIXES = {
  idle: ["_idle_a", "_idlehome_a"],
  run: ["_run"],
  attack: ["_combo_a", "_combo_b", "_skill_a"],
};

const JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"

/**
 * @param {string} filePath
 * @returns {{ clipNames: string[], gltf: Record<string, unknown> }}
 */
export function parseGlbJsonChunk(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 12) throw new Error(`${filePath}: file too small for GLB`);
  if (buf.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${filePath}: not a GLB (bad magic)`);
  }

  let offset = 12;
  let gltf = null;

  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    offset += 8;
    const chunkData = buf.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === JSON_CHUNK_TYPE) {
      gltf = JSON.parse(chunkData.toString("utf8"));
      break;
    }
  }

  if (!gltf) throw new Error(`${filePath}: no JSON chunk found`);

  const clipNames = (gltf.animations ?? []).map((anim, i) => {
    if (typeof anim?.name === "string" && anim.name.length > 0) return anim.name;
    return `(unnamed#${i})`;
  });

  return { clipNames, gltf };
}

/**
 * @param {string} name
 * @param {string[]} suffixes
 */
export function matchesSuffix(name, suffixes) {
  const lower = name.toLowerCase();
  return suffixes.some((suffix) => lower.endsWith(suffix.toLowerCase()));
}

/**
 * @param {string} filePath
 */
export function inspectSkinGlb(filePath) {
  const { clipNames } = parseGlbJsonChunk(filePath);
  const stat = fs.statSync(filePath);

  /** @type {Record<string, { suffix: string, clips: string[] }[]>} */
  const suffixReport = {};

  for (const [role, suffixes] of Object.entries(BOUNTY_RUSH_SUFFIXES)) {
    suffixReport[role] = suffixes.map((suffix) => ({
      suffix,
      clips: clipNames.filter((name) => matchesSuffix(name, [suffix])),
    }));
  }

  const hasIdle = suffixReport.idle.some((entry) => entry.clips.length > 0);
  const hasRun = suffixReport.run.some((entry) => entry.clips.length > 0);
  const hasAttack = suffixReport.attack.some((entry) => entry.clips.length > 0);
  const hasBountyRush = hasIdle && hasRun && hasAttack;

  return {
    file: path.basename(filePath),
    path: path.resolve(filePath),
    clipCount: clipNames.length,
    clipNames,
    suffixReport,
    hasIdle,
    hasRun,
    hasAttack,
    hasBountyRush,
    sizeBytes: stat.size,
    sizeMB: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
  };
}

/**
 * @param {string} a
 * @param {string} b
 */
export function filesAreIdentical(a, b) {
  const statA = fs.statSync(a);
  const statB = fs.statSync(b);
  if (statA.size !== statB.size) return false;
  const bufA = fs.readFileSync(a);
  const bufB = fs.readFileSync(b);
  return bufA.equals(bufB);
}

function printReport(result, { verbose = false } = {}) {
  console.log(`\n=== ${result.file} ===`);
  console.log(`  clips: ${result.clipCount}`);
  console.log(`  size:  ${result.sizeMB} MB`);
  console.log(`  bounty-rush ready (idle+run+attack): ${result.hasBountyRush}`);

  for (const [role, entries] of Object.entries(result.suffixReport)) {
    const matched = entries.filter((e) => e.clips.length > 0);
    if (matched.length === 0) {
      console.log(`  ${role}: (none)`);
    } else {
      for (const entry of matched) {
        console.log(`  ${role} [${entry.suffix}]: ${entry.clips.join(", ")}`);
      }
    }
  }

  if (verbose) {
    console.log("  all clips:");
    for (const name of result.clipNames) console.log(`    - ${name}`);
  }
}

function parseArgs(argv) {
  const files = [];
  const copyMap = [];
  let copy = false;
  let dest = null;
  let verbose = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--copy") copy = true;
    else if (arg === "--verbose" || arg === "-v") verbose = true;
    else if (arg === "--json") json = true;
    else if (arg === "--dest") dest = argv[++i];
    else if (arg === "--map") {
      const pair = argv[++i];
      const eq = pair.indexOf("=");
      if (eq < 0) throw new Error(`--map expects id=path, got: ${pair}`);
      copyMap.push({ id: pair.slice(0, eq), src: pair.slice(eq + 1) });
    } else if (!arg.startsWith("-")) files.push(arg);
    else throw new Error(`Unknown flag: ${arg}`);
  }

  return { files, copy, dest, copyMap, verbose, json };
}

async function main() {
  const { files, copy, dest, copyMap, verbose, json } = parseArgs(process.argv.slice(2));
  if (files.length === 0) {
    console.error(
      "Usage: node scripts/inspect-skin-glb.mjs <file.glb> [...]\n" +
        "       node scripts/inspect-skin-glb.mjs --copy --dest <dir> --map id=src.glb ...",
    );
    process.exit(1);
  }

  const results = files.map((file) => inspectSkinGlb(file));

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) printReport(result, { verbose });
  }

  if (copy) {
    if (!dest) throw new Error("--copy requires --dest <directory>");
    fs.mkdirSync(dest, { recursive: true });

    const idBySrc = new Map(copyMap.map((entry) => [path.resolve(entry.src), entry.id]));
    for (const result of results) {
      const id = idBySrc.get(result.path);
      if (!id) continue;
      if (!result.hasBountyRush) {
        console.error(`skip copy ${result.file} → ${id}.glb (missing bounty-rush clips)`);
        continue;
      }
      const out = path.join(dest, `${id}.glb`);
      fs.copyFileSync(result.path, out);
      console.log(`copied → ${out}`);
    }
  }
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}