import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB = path.join(
  __dirname,
  "artifacts/grudge-game/public/models/racalvin/base.glb",
);

function readGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.toString("utf8", 0, 4);
  if (magic !== "glTF") throw new Error(`Not a GLB: ${filePath}`);

  let offset = 12;
  while (offset < buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.toString("utf8", offset + 4, offset + 8);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === "JSON") {
      return JSON.parse(chunkData.toString("utf8"));
    }
    offset += 8 + chunkLength;
  }
  throw new Error("No JSON chunk in GLB");
}

const gltf = readGlbJson(GLB);
const nodes = gltf.nodes ?? [];
const skins = gltf.skins ?? [];

console.log(`\n=== ${path.basename(GLB)} ===`);
console.log(`Nodes: ${nodes.length}, Skins: ${skins.length}\n`);

console.log("--- All node names ---");
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i];
  const name = node.name ?? `(node ${i})`;
  const extras = [];
  if (node.mesh !== undefined) extras.push("mesh");
  if (node.skin !== undefined) extras.push("skin");
  if (node.camera !== undefined) extras.push("camera");
  console.log(`  ${name}${extras.length ? ` [${extras.join(", ")}]` : ""}`);
}

console.log("\n--- Skin joint hierarchies ---");
for (let si = 0; si < skins.length; si++) {
  const skin = skins[si];
  const joints = skin.joints ?? [];
  console.log(`Skin ${si} (${joints.length} joints):`);
  for (const ji of joints) {
    const name = nodes[ji]?.name ?? `(node ${ji})`;
    console.log(`  ${name}`);
  }
}

const allNames = nodes.map((n, i) => n.name ?? `(node ${i})`);
const handLike = allNames.filter((n) => /hand|wrist|finger|palm|grip|weapon/i.test(n));

console.log("\n--- Hand-related node names ---");
if (handLike.length === 0) {
  console.log("  (none matched hand/wrist/finger/palm/grip/weapon)");
} else {
  for (const name of handLike) console.log(`  ${name}`);
}

const rightHandPatterns = [
  /^RightHand$/i,
  /^mixamorigRightHand$/i,
  /RightHand$/i,
  /right[_.]?hand/i,
  /^hand[_.]?r/i,
  /\.R$/i,
  /_R$/i,
];

let rightHand = null;
for (const re of rightHandPatterns) {
  const hit = allNames.find((n) => re.test(n));
  if (hit) {
    rightHand = hit;
    break;
  }
}

console.log("\n--- Right-hand bone (pattern match) ---");
console.log(rightHand ? `  ${rightHand}` : "  (not found)");