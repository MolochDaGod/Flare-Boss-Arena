import fs from "fs";

// CampScene rocks
{
  const p = "artifacts/grudge-game/src/game/CampScene.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    `const rocks = makeRockField(200, yard * 0.72, yard + 28);
    rocks.name = "camp_rock_field";
    this.scene.add(rocks);
    this.rockField = rocks;`,
    `const rocks = makeRockField(200, yard * 0.72, yard + 28);
    rocks.mesh.name = "camp_rock_field";
    this.scene.add(rocks.mesh);
    this.rockField = rocks.mesh;`,
  );
  fs.writeFileSync(p, s);
  console.log("camp", s.includes("rocks.mesh"));
}

// MonsterModels clipBank + brace
{
  const p = "artifacts/grudge-game/src/game/MonsterModels.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    /model\.height \*= def\.bossScale;\r?\n\s*\}\r?\n\s*\}\r?\n\s*\r?\n\s*group\.add\(inner\);/,
    `model.height *= def.bossScale;
      }

      group.add(inner);`,
  );
  s = s.replace(
    /new GlbClipBank\(inner, gltf\.animations, def\.clip\)/g,
    "new GlbClipBank(inner, gltf.animations, null, def.clip)",
  );
  s = s.replace(
    /if \(gltf\.animations\.length === 1 && !model\.mixer\) \{\s*\/\* GlbClipBank owns playback \*\/\s*\}/,
    "",
  );
  fs.writeFileSync(p, s);
  console.log("monster braces ok", !s.includes("}\n      }\n\n      group.add"));
}

// Open water camera via isoCam
{
  const p = "artifacts/grudge-game/src/game/GameEngine.ts";
  let s = fs.readFileSync(p, "utf8");
  const re =
    /  \/\*\* Camera \/ sun follow while helming the skiff[\s\S]*?private updateOpenWaterCamera\([\s\S]*?\n  \}\n\n  private animate/;
  const neu = `  /** Camera / sun follow while helming the skiff (open water early-exit path). */
  private updateOpenWaterCamera(delta: number) {
    this.playerVel.set(
      Math.sin(this.playerFacing) * (this.openWater?.speed ?? 0),
      0,
      Math.cos(this.playerFacing) * (this.openWater?.speed ?? 0),
    );
    updateIsoCamera(this.camera, this.isoCam, this.playerPos, this.playerVel, delta, {
      lookAhead: 0.35,
      heightBoost: 3.5,
    } as never);
    if (this.sun) {
      this.sun.position.set(this.playerPos.x + 24, 36, this.playerPos.z + 24);
      this.sun.target.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.sun.target.updateMatrixWorld();
    }
  }

  private animate`;
  if (!re.test(s)) {
    // simpler
    s = s.replace(
      /private updateOpenWaterCamera\([\s\S]*?\n  \}\n\n  private animate =/,
      neu.replace("private animate", "private animate ="),
    );
  } else {
    s = s.replace(re, neu);
  }
  fs.writeFileSync(p, s);
  console.log("engine cam", !s.includes("_camOffset") && s.includes("updateOpenWaterCamera"));
}

// Check updateIsoCamera signature
const iso = fs.readFileSync("artifacts/grudge-game/src/game/combat/isoCamera.ts", "utf8");
const m = iso.match(/export function updateIsoCamera\([\s\S]*?\)/);
console.log("sig", m?.[0]?.slice(0, 200));
