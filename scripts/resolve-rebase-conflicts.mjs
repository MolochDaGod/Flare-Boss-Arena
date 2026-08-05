import fs from "fs";

function stripConflicts(path, pick) {
  let s = fs.readFileSync(path, "utf8");
  // Support CRLF and optional trailing newline
  const re =
    /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> [^\r\n]+\r?\n?/g;
  let n = 0;
  s = s.replace(re, (_, head, theirs) => {
    n++;
    return pick(head, theirs);
  });
  if (s.includes("<<<<<<<")) {
    const i = s.indexOf("<<<<<<<");
    console.error(path, "leftover near", JSON.stringify(s.slice(i, i + 120)));
    throw new Error(`still conflicts in ${path} (resolved ${n})`);
  }
  fs.writeFileSync(path, s);
  console.log("ok", path, n);
}

// --- gameFlow: union routes + nav items
stripConflicts("artifacts/grudge-game/src/data/gameFlow.ts", (h, t) => {
  if (h.includes("/pvp") && t.includes("/moba") && !h.includes("label:")) {
    return `  | "/pvp"
  | "/leaderboards"
  | "/connections"
  | "/moba";
`;
  }
  if (h.includes("PvP Arena") || t.includes("MOBA") || h.includes("Enter World")) {
    // Keep remote PvP/leaderboards + our MOBA line
    const lines = [...h.split("\n"), ...t.split("\n")];
    const seen = new Set();
    const out = [];
    for (const line of lines) {
      const key = line.replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return out.join("\n") + (out[out.length - 1]?.endsWith("\n") ? "" : "\n");
  }
  return h + t;
});

// --- select subtitle
stripConflicts("artifacts/grudge-game/src/pages/select.tsx", () =>
  `            All locked by default · 1 Flare Grudge Token unlock · 3 free weekly · Grudge Warlords 24 · Toon-RTS baked anims
`,
);

// --- playableIdentity
stripConflicts("artifacts/grudge-game/src/data/playableIdentity.ts", (h, t) => {
  if (h.includes("flareEconomy") || t.includes("equipmentLoadout")) {
    return `import { getFighterLevel, isOwned } from "./flareEconomy";
import { getEquipmentLoadout } from "./equipmentLoadout";
import { getAttributeAllocations } from "./attributePoints";
import { ATTR_ORDER } from "./fighters";
`;
  }
  if (h.includes("isOwned") || t.includes("getEquipmentLoadout")) {
    return `  const owned = isOwned(fighter.id);
  const gear = getEquipmentLoadout(fighter.id);
  const equipment: Record<string, string | undefined> = {
    mainHand: gear.Mainhand?.id ?? loadout.weapon.id,
    offHand: gear.Offhand?.id,
    helm: gear.Helm?.id,
    chest: gear.Chest?.id,
  };
`;
  }
  return h + t;
});

// --- MonsterModels
stripConflicts("artifacts/grudge-game/src/game/MonsterModels.ts", (h, t) => {
  if (t.includes("BossMonsterDef") || h.includes("bossMonsters")) {
    return `import {
  BOSS_MONSTER_BY_ID,
  isBossMonsterId,
  type BossMonsterDef,
} from "../data/bossMonsters";
`;
  }
  if (h.includes("spawnRotY") || t.includes("baseRotY")) {
    return `      if (def.spawnRotY) {
        inner.rotation.y += def.spawnRotY;
        group.userData.baseRotY = def.spawnRotY;
      }
      if (def.bossScale && def.bossScale !== 1) {
        group.scale.multiplyScalar(def.bossScale);
        model.height *= def.bossScale;
      }
`;
  }
  // clips: prefer GlbClipBank for all tracks
  if (h.includes("animations.length") || t.includes("GlbClipBank")) {
    return t.includes("GlbClipBank") ? t : h;
  }
  return t.length >= h.length ? t : h;
});

// --- cdnMonsters: keep def()-based catalog (theirs) + append tjg creeps
stripConflicts("artifacts/grudge-game/src/data/cdnMonsters.ts", (h, t) => {
  const creepLines = h
    .split("\n")
    .filter((l) => l.includes("tjg_") || l.includes("threejs-games"))
    .join("\n");
  // Rewrite creeps into full objects if using old style - keep as-is if already full
  return t.trimEnd() + (creepLines ? "\n\n  // ── threejs-games R2 neutrals (from main) ──\n" + creepLines + "\n" : "\n");
});

// --- GameEngine critical hunks
stripConflicts("artifacts/grudge-game/src/game/GameEngine.ts", (h, t) => {
  // loader init
  if (h.includes("createGltfLoader") || t.includes("configureDracoLoader")) {
    return `    this.timer.connect(document);
    this.loader = createGltfLoader();
    configureDracoLoader(this.loader);
`;
  }
  // dodge apply
  if (t.includes("resolveDodge") || h.includes("DODGE_DISTANCE")) {
    if (t.includes("resolveDodge")) {
      return t;
    }
    return h;
  }
  // dodge cooldown / vfx — combine
  if (h.includes("dodgeIframeUntil") || t.includes("DODGE_IFRAME")) {
    return `    this.dodgeIframeUntil = now + DODGE_IFRAME_S * 1000;
    this.dodgeCdUntil = now + DODGE_COOLDOWN_S * 1000;
    this.particles?.impact(this.playerPos.clone().setY(0.35), 0xc5e8ff, 0.55);
    this.particles?.impact(this.playerPos.clone().setY(0.15), 0x8a9aaa, 0.45);
    try { kickCameraShake(this.isoCam, 0.12); } catch { /* optional */ }
    try { this.bloom?.kick?.(0.15); } catch { /* optional */ }
`;
  }
  // movement velocity (prefer remote production velocity)
  if (h.includes("wantX") || t.includes("movePlayerHorizontal")) {
    return h.includes("wantX") ? h : t;
  }
  return t.length >= h.length ? t : h;
});

// ArenaScene + boss already checkout --theirs before this script may still have markers if not
for (const p of [
  "artifacts/grudge-game/src/game/ArenaScene.ts",
  "artifacts/grudge-game/src/pages/boss.tsx",
]) {
  if (fs.readFileSync(p, "utf8").includes("<<<<<<<")) {
    stripConflicts(p, (_h, t) => t);
  } else {
    console.log("clean", p);
  }
}

console.log("all conflict blocks resolved");
