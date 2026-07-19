#!/usr/bin/env node
/**
 * Unity → GLB export orchestrator.
 *
 * 1. Writes/refreshes export manifest from known FRESH-GRUDGE paths
 * 2. Optionally invokes Unity batchmode with GrudgeUnityGlbExporter
 * 3. Copies any produced GLBs into grudge-game public/models/unity/
 * 4. Syncs ids used by unityInstances.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const GAME_PUBLIC = path.join(ROOT, "artifacts/grudge-game/public/models/unity");
const MANIFEST = path.join(__dirname, "export-manifest.json");

const UNITY_PROJECT =
  process.env.UNITY_PROJECT || "D:\\repos\\FRESH-GRUDGE";
const UNITY_EXE = process.env.UNITY_EXE || findUnityExe();
const GLB_OUT = process.env.GRUDGE_GLB_OUT || path.join(ROOT, "artifacts/grudge-game/public/models/unity");

/** Canonical slots Three.js expects */
export const UNITY_EXPORT_SLOTS = [
  {
    id: "dark_elf_camp",
    unityRel: "Assets/uMMORPG/Prefabs/Entities/Monsters/Dark Elf Camp",
    kind: "camp",
    slot: "DARK_ELF_CAMP_PREFAB",
    priority: 1,
  },
  {
    id: "dark_elf_encampment",
    unityRel: "Assets/uMMORPG/Prefabs/Entities/Monsters/Dark Elf Encampment",
    kind: "camp",
    priority: 2,
  },
  {
    id: "dark_elf_stronghold",
    unityRel: "Assets/uMMORPG/Prefabs/Entities/Monsters/Dark Elf Stronghold",
    kind: "dungeon",
    priority: 3,
  },
  {
    id: "dark_elf_castle",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Dark elf Castle.prefab",
    kind: "dungeon",
    priority: 4,
  },
  {
    id: "dark_elf_castle_lv1",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Dark Elf Castle lv1.prefab",
    kind: "dungeon",
    priority: 5,
  },
  {
    id: "dungeon_catacombs",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Catacombs underground.prefab",
    kind: "dungeon",
    priority: 6,
  },
  {
    id: "dungeon_main",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Dungeon.prefab",
    kind: "dungeon",
    priority: 7,
  },
  {
    id: "dungeon_sewer",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Sewer.prefab",
    kind: "dungeon",
    priority: 8,
  },
  {
    id: "dungeon_stronghold",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Stronghold.prefab",
    kind: "dungeon",
    priority: 9,
  },
  {
    id: "dungeon_underground_ruins",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/underground ruins.prefab",
    kind: "dungeon",
    priority: 10,
  },
  {
    id: "dungeon_entrance",
    unityRel: "Assets/uMMORPG/Prefabs/Dungeons/Enterence.prefab",
    kind: "dungeon",
    priority: 11,
  },
];

function findUnityExe() {
  const candidates = [
    process.env.UNITY_EXE,
    "C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.50f1\\Editor\\Unity.exe",
    "C:\\Program Files\\Unity\\Hub\\Editor\\2021.3.45f1\\Editor\\Unity.exe",
    "C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.21f1\\Editor\\Unity.exe",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function scanUnityPresent() {
  return UNITY_EXPORT_SLOTS.map((s) => {
    const full = path.join(UNITY_PROJECT, s.unityRel);
    const exists = fs.existsSync(full);
    const glbPath = path.join(GLB_OUT, `${s.id}.glb`);
    const glbReady = fs.existsSync(glbPath);
    return {
      ...s,
      unityFullPath: full,
      unityExists: exists,
      glbPath,
      glbReady,
      publicUrl: `/models/unity/${s.id}.glb`,
    };
  });
}

function writeManifest(entries) {
  const body = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    unityProject: UNITY_PROJECT,
    outDir: GLB_OUT,
    note:
      "GLBs are game-ready Three.js instances. Mirror is Unity-only; web MP uses Socket.IO (artifacts/mp-server).",
    entries,
  };
  ensureDir(path.dirname(MANIFEST));
  fs.writeFileSync(MANIFEST, JSON.stringify(body, null, 2));
  // Also copy for the game runtime
  ensureDir(GAME_PUBLIC);
  fs.writeFileSync(path.join(GAME_PUBLIC, "manifest.json"), JSON.stringify(body, null, 2));
  console.log(`[unity-export] manifest → ${MANIFEST}`);
  return body;
}

function tryUnityBatch() {
  if (!UNITY_EXE || !fs.existsSync(UNITY_EXE)) {
    console.warn("[unity-export] Unity.exe not found — skip batchmode (install Hub editor or set UNITY_EXE).");
    return false;
  }
  if (!fs.existsSync(UNITY_PROJECT)) {
    console.warn(`[unity-export] UNITY_PROJECT missing: ${UNITY_PROJECT}`);
    return false;
  }
  // Copy editor script into project if absent
  const editorDest = path.join(
    UNITY_PROJECT,
    "Assets/Editor/GrudgeUnityGlbExporter.cs",
  );
  const editorSrc = path.join(__dirname, "Editor/GrudgeUnityGlbExporter.cs");
  ensureDir(path.dirname(editorDest));
  fs.copyFileSync(editorSrc, editorDest);
  console.log(`[unity-export] Editor script → ${editorDest}`);

  const logFile = path.join(__dirname, "unity-export.log");
  const args = [
    "-batchmode",
    "-nographics",
    "-quit",
    "-projectPath",
    UNITY_PROJECT,
    "-executeMethod",
    "Grudge.Export.GrudgeUnityGlbExporter.ExportMenu",
    "-logFile",
    logFile,
  ];
  console.log(`[unity-export] Invoking Unity batchmode…`);
  process.env.GRUDGE_GLB_OUT = GLB_OUT;
  const r = spawnSync(UNITY_EXE, args, {
    env: { ...process.env, GRUDGE_GLB_OUT: GLB_OUT },
    encoding: "utf8",
    timeout: 600_000,
  });
  console.log(`[unity-export] Unity exit ${r.status}`);
  if (r.error) console.warn(r.error.message);
  return r.status === 0;
}

function copyReadyGlbs(entries) {
  ensureDir(GAME_PUBLIC);
  let n = 0;
  for (const e of entries) {
    if (e.glbReady && path.resolve(e.glbPath) !== path.resolve(path.join(GAME_PUBLIC, `${e.id}.glb`))) {
      fs.copyFileSync(e.glbPath, path.join(GAME_PUBLIC, `${e.id}.glb`));
      n++;
    }
  }
  // Also accept glbs already in GLB_OUT
  if (fs.existsSync(GLB_OUT)) {
    for (const f of fs.readdirSync(GLB_OUT)) {
      if (!f.endsWith(".glb")) continue;
      const dest = path.join(GAME_PUBLIC, f);
      const src = path.join(GLB_OUT, f);
      if (path.resolve(src) !== path.resolve(dest)) {
        fs.copyFileSync(src, dest);
        n++;
      }
    }
  }
  console.log(`[unity-export] copied/synced ${n} glb file ops → ${GAME_PUBLIC}`);
}

function printStatus(entries) {
  console.log("\n=== Unity export status ===");
  for (const e of entries) {
    const u = e.unityExists ? "prefab✓" : "prefab✗";
    const g = e.glbReady ? "glb✓" : "glb✗";
    console.log(`  ${e.id.padEnd(28)} ${u}  ${g}  ${e.kind}`);
  }
  const ready = entries.filter((e) => e.glbReady).length;
  console.log(`\n${ready}/${entries.length} GLBs ready for Three.js\n`);
}

function main() {
  ensureDir(GLB_OUT);
  ensureDir(GAME_PUBLIC);
  const runUnity = process.argv.includes("--unity");
  if (runUnity) tryUnityBatch();
  const entries = scanUnityPresent();
  writeManifest(entries);
  copyReadyGlbs(entries);
  printStatus(entries);
  if (entries.every((e) => !e.glbReady)) {
    console.log(
      "Next: open Unity → Grudge/Export/Dark Elf Camp + Dungeons → GLB\n" +
        "  or place hand-exported GLBs in:\n  " +
        GAME_PUBLIC,
    );
  }
}

main();
