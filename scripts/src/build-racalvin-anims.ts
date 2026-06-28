/**
 * Build the Racalvin (Corsair King) hero assets for Grudge Warlords.
 *
 * Meshy ships ONE full-skin GLB per animation (~8MB each) — far too heavy to
 * bundle. Because every clip rig shares identical bone names with the base
 * model, we strip each anim GLB down to skeleton + clip (a few KB) so they can
 * be replayed on the base model at runtime (same trick as the KayKit library).
 * The base keeps its mesh/textures; the sword's heavy textures are dropped for a
 * flat steel PBR material.
 */
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";

const MESHY =
  "/tmp/meshy/Meshy_AI_Corsair_King_biped_1782627808197_zip/Meshy_AI_Corsair_King_biped";
const BASE_SRC = path.join(MESHY, "Meshy_AI_Corsair_King_biped_Character_output.glb");
const SWORD_SRC =
  "/home/runner/workspace/attached_assets/Meshy_AI_My_Brothers_Keeper_0628055358_texture_1782627811425.glb";
const OUT = "/home/runner/workspace/artifacts/grudge-game/public/models/racalvin";
const ANIM_OUT = path.join(OUT, "anim");

/** logical clip name -> Meshy anim file (suffix `_withSkin.glb`). */
const CLIPS: Record<string, string> = {
  idle: "Talk_with_Hands_Open",
  walk: "Walking",
  run: "Running",
  attack: "Thrust_Slash",
  cast: "mage_soell_cast",
  dodge: "Forward_Roll_and_Fire",
  hit: "Hit_Reaction",
  jump: "Jump_Over_Obstacle_2",
  hammer: "Heavy_Hammer_Swing",
  combo: "Weapon_Combo_2",
  punch: "Punch_Combo_1",
};

const io = new NodeIO();

async function stripAnim(logical: string, srcName: string) {
  const src = path.join(MESHY, `Meshy_AI_Corsair_King_biped_Animation_${srcName}_withSkin.glb`);
  const doc = await io.read(src);
  const root = doc.getRoot();

  const anims = root.listAnimations();
  if (anims.length === 0) throw new Error(`no animation in ${srcName}`);
  anims[0].setName(logical);
  // Drop any extra animations (defensive — Meshy ships one).
  anims.slice(1).forEach((a) => a.dispose());

  // Strip everything except the bone hierarchy + the clip.
  root.listMeshes().forEach((m) => m.dispose());
  root.listSkins().forEach((s) => s.dispose());
  root.listMaterials().forEach((m) => m.dispose());
  root.listTextures().forEach((t) => t.dispose());

  await doc.transform(prune());
  const out = path.join(ANIM_OUT, `${logical}.glb`);
  await io.write(out, doc);
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`  anim ${logical.padEnd(8)} <- ${srcName}  (${kb} KB)`);
}

async function slimSword() {
  const doc = await io.read(SWORD_SRC);
  const root = doc.getRoot();
  root.listMaterials().forEach((m) => {
    m.setBaseColorTexture(null);
    m.setMetallicRoughnessTexture(null);
    m.setNormalTexture(null);
    m.setOcclusionTexture(null);
    m.setEmissiveTexture(null);
    m.setBaseColorFactor([0.78, 0.8, 0.86, 1]);
    m.setMetallicFactor(1);
    m.setRoughnessFactor(0.38);
  });
  root.listTextures().forEach((t) => t.dispose());
  await doc.transform(prune());
  const out = path.join(OUT, "sword.glb");
  await io.write(out, doc);
  const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
  console.log(`  sword.glb (${mb} MB)`);
}

async function main() {
  fs.mkdirSync(ANIM_OUT, { recursive: true });

  // Base keeps mesh + textures — straight copy.
  fs.copyFileSync(BASE_SRC, path.join(OUT, "base.glb"));
  const baseMb = (fs.statSync(path.join(OUT, "base.glb")).size / 1024 / 1024).toFixed(2);
  console.log(`  base.glb (${baseMb} MB)`);

  for (const [logical, srcName] of Object.entries(CLIPS)) {
    await stripAnim(logical, srcName);
  }
  await slimSword();
  console.log("Racalvin assets built.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
