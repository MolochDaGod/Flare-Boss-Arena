/**
 * Convert Meshy withSkin crew packs → deployment-ready pattern (One Piece / Racalvin):
 *
 *   base.glb  — skinned mesh, meshopt, SI-ready (~few MB)
 *   anim/*.glb — skeleton + animation only (tens of KB, not 10MB each)
 *   anchor.glb — optimized weapon mesh only
 *   hero.glb  — base + idle/walk/run/attack embedded (fast /select viewport)
 *
 * Usage: node scripts/convert-crew-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  resample,
  weld,
  metalRough,
} from "@gltf-transform/functions";
// meshopt optional — import if present
let meshopt;
try {
  meshopt = await import("meshoptimizer");
} catch {
  meshopt = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../artifacts/grudge-game/public/models/crew");

const CREWS = ["scourge", "johnwayne"];
const ESSENTIAL_ANIMS = ["idle", "walk", "run", "attack"];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
if (meshopt?.MeshoptEncoder && meshopt?.MeshoptDecoder) {
  await meshopt.MeshoptEncoder.ready;
  await meshopt.MeshoptDecoder.ready;
  io.registerDependencies({
    "meshopt.encoder": meshopt.MeshoptEncoder,
    "meshopt.decoder": meshopt.MeshoptDecoder,
  });
}

function mb(n) {
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/** Remove all mesh/skin/material/texture data — keep skeleton hierarchy + animations. */
async function stripToSkeletonAnim(doc) {
  const root = doc.getRoot();

  // Detach meshes from nodes
  for (const node of root.listNodes()) {
    if (node.getMesh()) node.setMesh(null);
    if (node.getSkin()) node.setSkin(null);
    if (node.getCamera()) node.setCamera(null);
  }

  // Dispose skins / meshes / materials / textures / images
  for (const skin of [...root.listSkins()]) skin.dispose();
  for (const mesh of [...root.listMeshes()]) mesh.dispose();
  for (const mat of [...root.listMaterials()]) mat.dispose();
  for (const tex of [...root.listTextures()]) tex.dispose();

  // Prune unreferenced accessors/buffers
  await doc.transform(prune({ keepAttributes: false, keepLeaves: true }));
  return doc;
}

async function optimizeMeshDoc(doc) {
  const transforms = [dedup(), weld(), metalRough(), resample()];
  // meshopt compression when available
  try {
    const { meshopt } = await import("@gltf-transform/functions");
    if (typeof meshopt === "function") {
      transforms.push(
        meshopt({
          encoder: (await import("meshoptimizer")).MeshoptEncoder,
          level: "medium",
        }),
      );
    }
  } catch {
    /* no meshopt compress */
  }
  transforms.push(prune());
  await doc.transform(...transforms);
  return doc;
}

async function convertCrew(crew) {
  const dir = path.join(ROOT, crew);
  const animDir = path.join(dir, "anim");
  const prodDir = path.join(dir, "prod");
  const prodAnimDir = path.join(prodDir, "anim");
  fs.mkdirSync(prodAnimDir, { recursive: true });

  const report = { crew, base: {}, anims: [], hero: {}, totalBefore: 0, totalAfter: 0 };

  // ── base.glb ──────────────────────────────────────────────
  const baseIn = path.join(dir, "base.glb");
  const baseOut = path.join(prodDir, "base.glb");
  if (!fs.existsSync(baseIn)) {
    console.warn(`[skip] missing ${baseIn}`);
    return report;
  }
  report.totalBefore += fileSize(baseIn);
  {
    const doc = await io.read(baseIn);
    await optimizeMeshDoc(doc);
    // Measure mesh height from node bounds after optimize
    await io.write(baseOut, doc);
    report.base = { before: fileSize(baseIn), after: fileSize(baseOut) };
    report.totalAfter += fileSize(baseOut);
    console.log(`[base] ${crew}: ${mb(report.base.before)} → ${mb(report.base.after)}`);
  }

  // ── anim/*.glb → skeleton-only ────────────────────────────
  if (fs.existsSync(animDir)) {
    for (const f of fs.readdirSync(animDir).filter((n) => n.endsWith(".glb"))) {
      const src = path.join(animDir, f);
      const dst = path.join(prodAnimDir, f);
      report.totalBefore += fileSize(src);
      try {
        const doc = await io.read(src);
        const animCount = doc.getRoot().listAnimations().length;
        // Rename single anim to file stem for consistency
        const stem = path.basename(f, ".glb");
        for (const a of doc.getRoot().listAnimations()) {
          a.setName(stem);
        }
        await stripToSkeletonAnim(doc);
        await io.write(dst, doc);
        const after = fileSize(dst);
        report.totalAfter += after;
        report.anims.push({
          name: f,
          before: fileSize(src),
          after,
          anims: animCount,
        });
        console.log(
          `[anim] ${crew}/${f}: ${mb(fileSize(src))} → ${mb(after)} (${animCount} clips)`,
        );
      } catch (e) {
        console.error(`[anim fail] ${crew}/${f}:`, e.message);
      }
    }
  }

  // ── anchor.glb (scourge only) ─────────────────────────────
  const anchorIn = path.join(dir, "anchor.glb");
  if (fs.existsSync(anchorIn)) {
    const anchorOut = path.join(prodDir, "anchor.glb");
    report.totalBefore += fileSize(anchorIn);
    try {
      const doc = await io.read(anchorIn);
      await optimizeMeshDoc(doc);
      await io.write(anchorOut, doc);
      report.totalAfter += fileSize(anchorOut);
      console.log(
        `[anchor] ${crew}: ${mb(fileSize(anchorIn))} → ${mb(fileSize(anchorOut))}`,
      );
    } catch (e) {
      console.error(`[anchor fail]`, e.message);
      fs.copyFileSync(anchorIn, path.join(prodDir, "anchor.glb"));
      report.totalAfter += fileSize(anchorIn);
    }
  }

  // ── hero.glb = base mesh + essential clips from anim packs ─
  // Copy animations from skeleton-only anim files onto optimized base.
  try {
    const heroDoc = await io.read(baseOut);
    for (const name of ESSENTIAL_ANIMS) {
      const animPath = path.join(prodAnimDir, `${name}.glb`);
      if (!fs.existsSync(animPath)) continue;
      const animDoc = await io.read(animPath);
      // Merge animation channels by cloning into hero document
      // Simple approach: use gltf-transform merge if available
      for (const anim of animDoc.getRoot().listAnimations()) {
        // Create a fresh animation on hero with same name; copy channels if possible
        // Fallback: store as separate named animations via graph copy is complex —
        // use io.write of multi-anim by sequential property transfer via JSON merge:
      }
    }
    // Pragmatic approach: use CLI-level merge via reading JSON and combining
    // For reliability we write hero.glb as optimized base only, and rely on
    // skeleton-only anim loads (now tiny). Select will load base + idle first.
    const heroOut = path.join(prodDir, "hero.glb");
    fs.copyFileSync(baseOut, heroOut);
    // Append essential anims by multi-document merge script
    await mergeAnimsOntoBase(baseOut, prodAnimDir, ESSENTIAL_ANIMS, heroOut);
    report.hero = { after: fileSize(heroOut) };
    report.totalAfter += fileSize(heroOut) - fileSize(baseOut); // hero includes base
    // Don't double-count base: adjust
    report.totalAfter = report.totalAfter - fileSize(baseOut) + fileSize(heroOut);
    console.log(`[hero] ${crew}: ${mb(fileSize(heroOut))} (base+essentials)`);
  } catch (e) {
    console.warn(`[hero] ${crew} merge skipped:`, e.message);
    fs.copyFileSync(baseOut, path.join(prodDir, "hero.glb"));
  }

  console.log(
    `[total] ${crew}: ${mb(report.totalBefore)} → ~prod ${mb(report.totalAfter)}`,
  );
  return report;
}

/**
 * Merge skeleton-only animation GLBs into base document.
 * Uses gltf-transform Document graph: copy animation accessors/nodes carefully.
 * Simpler reliable path: write a multi-step using JSON + binary concat via
 * temporary NodeIO property graph clone of animations.
 */
async function mergeAnimsOntoBase(basePath, animDir, names, outPath) {
  // Dynamic import of Document merge helpers
  const { Document, NodeIO: NIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS: EXTS } = await import("@gltf-transform/extensions");
  const nio = new NIO().registerExtensions(EXTS);

  const baseDoc = await nio.read(basePath);
  const baseRoot = baseDoc.getRoot();
  const baseNodeNames = new Map(
    baseRoot.listNodes().map((n) => [n.getName() || "", n]),
  );

  for (const name of names) {
    const p = path.join(animDir, `${name}.glb`);
    if (!fs.existsSync(p)) continue;
    const aDoc = await nio.read(p);
    for (const srcAnim of aDoc.getRoot().listAnimations()) {
      const dstAnim = baseDoc.createAnimation(name);
      for (const ch of srcAnim.listChannels()) {
        const target = ch.getTargetNode();
        const pathProp = ch.getTargetPath();
        const sampler = ch.getSampler();
        if (!target || !sampler || !pathProp) continue;
        const tName = target.getName() || "";
        const dstNode = baseNodeNames.get(tName);
        if (!dstNode) continue;

        // Copy input/output accessors into base document
        const input = sampler.getInput();
        const output = sampler.getOutput();
        if (!input || !output) continue;

        const inArr = input.getArray();
        const outArr = output.getArray();
        if (!inArr || !outArr) continue;

        const dstIn = baseDoc
          .createAccessor()
          .setType(input.getType())
          .setArray(inArr.slice());
        const dstOut = baseDoc
          .createAccessor()
          .setType(output.getType())
          .setArray(outArr.slice());
        // Copy buffer if needed
        const buf =
          baseRoot.listBuffers()[0] || baseDoc.createBuffer("merged");
        dstIn.setBuffer(buf);
        dstOut.setBuffer(buf);

        const dstSampler = baseDoc
          .createAnimationSampler()
          .setInput(dstIn)
          .setOutput(dstOut)
          .setInterpolation(sampler.getInterpolation());
        baseDoc
          .createAnimationChannel()
          .setTargetNode(dstNode)
          .setTargetPath(pathProp)
          .setSampler(dstSampler)
          .setExtras({});
        // Parent channel under animation
        dstAnim.addChannel(
          baseRoot.listAnimationChannels()[baseRoot.listAnimationChannels().length - 1],
        );
        dstAnim.addSampler(dstSampler);
      }
      // Fix channel parenting — gltf-transform API: create channel on anim
    }
  }

  // The channel parenting API is awkward; use a cleaner second pass via
  // @gltf-transform/functions mergeDocuments if available.
  try {
    const { mergeDocuments } = await import("@gltf-transform/functions");
    // rebuild with mergeDocuments approach
  } catch {
    /* fall through */
  }

  // Reliable merge using mergeDocuments from functions package
  await mergeAnimsViaMergeDocuments(basePath, animDir, names, outPath, nio);
}

async function mergeAnimsViaMergeDocuments(basePath, animDir, names, outPath, nio) {
  // Load base
  let result = await nio.read(basePath);

  // For each essential anim, merge skeleton-anim doc then strip meshes again
  // and rename animation
  for (const name of names) {
    const p = path.join(animDir, `${name}.glb`);
    if (!fs.existsSync(p)) continue;
    try {
      // Use binary approach: read anim JSON, inject animation into base
      // by writing base, then using CLI-less property graph from both:
      const animDoc = await nio.read(p);
      // Rename anims
      for (const a of animDoc.getRoot().listAnimations()) a.setName(name);

      // Copy animation data via serialize/deserialize hack:
      // Write both to temp and use a custom merger
      const { Document } = await import("@gltf-transform/core");
      // Actually the cleanest reliable method for our case:
      // keep hero.glb = optimized base only for mesh;
      // select loads base + idle.glb (now ~50KB) in parallel.
      // Skip complex merge — already done above as copy.
    } catch (e) {
      console.warn("merge step", name, e.message);
    }
  }

  // Write optimized base as hero (viewport loads base + idle anim separately, both small after convert)
  fs.copyFileSync(basePath, outPath);

  // Embed animations by re-reading base and manually attaching via NodeIO
  // JSON-level merge of animations:
  await embedAnimsJson(basePath, animDir, names, outPath);
}

/**
 * JSON-level embed: parse GLB JSON+BIN, append animation accessors from
 * skeleton-only packs that share the same bone names (Mixamo hierarchy).
 */
async function embedAnimsJson(basePath, animDir, names, outPath) {
  function readGlb(p) {
    const buf = fs.readFileSync(p);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
    // pad to 4
    let binStart = 20 + jsonLen;
    binStart = (binStart + 3) & ~3;
    // next chunk header
    if (binStart + 8 > buf.length) return { json, bin: Buffer.alloc(0), buf };
    const binLen = buf.readUInt32LE(binStart);
    const binType = buf.slice(binStart + 4, binStart + 8).toString();
    const bin =
      binType === "BIN\0"
        ? buf.slice(binStart + 8, binStart + 8 + binLen)
        : Buffer.alloc(0);
    return { json, bin, buf };
  }

  function writeGlb(json, bin) {
    const jsonStr = JSON.stringify(json);
    const jsonBuf = Buffer.from(jsonStr);
    const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
    const binPad = (4 - (bin.length % 4)) % 4;
    const total =
      12 + 8 + jsonBuf.length + jsonPad + (bin.length ? 8 + bin.length + binPad : 0);
    const out = Buffer.alloc(total);
    out.write("glTF", 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(total, 8);
    out.writeUInt32LE(jsonBuf.length + jsonPad, 12);
    out.write("JSON", 16);
    jsonBuf.copy(out, 20);
    for (let i = 0; i < jsonPad; i++) out[20 + jsonBuf.length + i] = 0x20;
    let o = 20 + jsonBuf.length + jsonPad;
    if (bin.length) {
      out.writeUInt32LE(bin.length + binPad, o);
      out.write("BIN\0", o + 4);
      bin.copy(out, o + 8);
      for (let i = 0; i < binPad; i++) out[o + 8 + bin.length + i] = 0;
    }
    return out;
  }

  const base = readGlb(basePath);
  base.json.animations = base.json.animations || [];
  base.json.accessors = base.json.accessors || [];
  base.json.bufferViews = base.json.bufferViews || [];
  base.json.buffers = base.json.buffers || [{ byteLength: base.bin.length }];

  // node name → index in base
  const nodeIndex = new Map();
  (base.json.nodes || []).forEach((n, i) => {
    if (n.name) nodeIndex.set(n.name, i);
  });

  let binParts = [base.bin];
  let binOffset = base.bin.length;

  for (const name of names) {
    const p = path.join(animDir, `${name}.glb`);
    if (!fs.existsSync(p)) continue;
    const a = readGlb(p);
    if (!a.json.animations?.length) continue;
    const anim = a.json.animations[0];
    const newSamplers = [];
    const newChannels = [];

    for (const s of anim.samplers || []) {
      const inAcc = a.json.accessors[s.input];
      const outAcc = a.json.accessors[s.output];
      if (!inAcc || !outAcc) continue;
      const inBv = a.json.bufferViews[inAcc.bufferView];
      const outBv = a.json.bufferViews[outAcc.bufferView];
      if (!inBv || !outBv) continue;

      const copyView = (bv, acc) => {
        const start = (bv.byteOffset || 0) + 0;
        const len =
          bv.byteLength ||
          (acc.count || 0) * componentBytes(acc) * typeCount(acc.type);
        const slice = a.bin.slice(start, start + len);
        // align 4
        const pad = (4 - (binOffset % 4)) % 4;
        if (pad) {
          binParts.push(Buffer.alloc(pad));
          binOffset += pad;
        }
        const viewIndex = base.json.bufferViews.length;
        base.json.bufferViews.push({
          buffer: 0,
          byteOffset: binOffset,
          byteLength: slice.length,
        });
        binParts.push(slice);
        binOffset += slice.length;
        const accIndex = base.json.accessors.length;
        base.json.accessors.push({
          bufferView: viewIndex,
          componentType: acc.componentType,
          count: acc.count,
          type: acc.type,
          max: acc.max,
          min: acc.min,
        });
        return accIndex;
      };

      const inIdx = copyView(inBv, inAcc);
      const outIdx = copyView(outBv, outAcc);
      newSamplers.push({
        input: inIdx,
        output: outIdx,
        interpolation: s.interpolation || "LINEAR",
      });
    }

    for (const ch of anim.channels || []) {
      const srcNode = a.json.nodes?.[ch.target?.node];
      const bone = srcNode?.name;
      if (!bone || !nodeIndex.has(bone)) continue;
      const samplerLocal = ch.sampler;
      if (samplerLocal == null || !newSamplers[samplerLocal]) continue;
      newChannels.push({
        sampler: samplerLocal,
        target: { node: nodeIndex.get(bone), path: ch.target.path },
      });
    }

    if (newChannels.length && newSamplers.length) {
      // Remap sampler indices relative to this anim's sampler list (already 0..)
      base.json.animations.push({
        name,
        samplers: newSamplers,
        channels: newChannels,
      });
      console.log(
        `  embed anim "${name}": ${newChannels.length} channels`,
      );
    }
  }

  base.json.buffers[0].byteLength = binOffset;
  const outBin = Buffer.concat(binParts);
  fs.writeFileSync(outPath, writeGlb(base.json, outBin));
}

function componentBytes(acc) {
  switch (acc.componentType) {
    case 5120:
    case 5121:
      return 1;
    case 5122:
    case 5123:
      return 2;
    case 5125:
    case 5126:
      return 4;
    default:
      return 4;
  }
}
function typeCount(t) {
  return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[t] || 1;
}

// ── main ────────────────────────────────────────────────────
const reports = [];
for (const crew of CREWS) {
  console.log(`\n=== ${crew} ===`);
  reports.push(await convertCrew(crew));
}

// Write readiness manifest for game runtime / "database"
const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  pattern: "racalvin-style: base.glb + skeleton-only anim/*.glb + hero.glb viewport",
  si: { unit: "meter", humanHeight: 1.8, viewportTargetHeight: 2.05 },
  fileType: "model/gltf-binary (glTF 2.0)",
  crews: {},
};
for (const r of reports) {
  const prod = path.join(ROOT, r.crew, "prod");
  manifest.crews[r.crew] = {
    base: "prod/base.glb",
    hero: "prod/hero.glb",
    animDir: "prod/anim/",
    anchor: fs.existsSync(path.join(prod, "anchor.glb")) ? "prod/anchor.glb" : null,
    bytesBefore: r.totalBefore,
    bytesAfter: r.totalAfter,
    anims: r.anims.map((a) => ({
      name: a.name,
      before: a.before,
      after: a.after,
    })),
  };
}
fs.writeFileSync(
  path.join(ROOT, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log("\nWrote", path.join(ROOT, "manifest.json"));
console.log("Done.");
