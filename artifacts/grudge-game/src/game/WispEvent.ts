/**
 * Colored Wisp world events.
 *
 * - Vertical beam of wisp color for long-range visual
 * - Aggro radius; when player enters, rotates attacks:
 *   1) Spline projectile (60% of player projectile speed)
 *   2) Multi-circle AoE: 2s warning → 3–6 circles detonate
 *   3) Pillar: 1s rise between player & wisp → 1s warning → falls toward aggro edge
 */

import * as THREE from "three";
import type { PendingStrikeField } from "./combat/pendingStrikes";
import type { ProjectileField } from "./combat/projectiles";
import type { WarningEffectField } from "./combat/warningEffects";
import type { ParticleVfx } from "./combat/particles";
import { hashString, seededUnit } from "../data/monsterCatalog";

/** Player bolt default speed in GameEngine.firePlayerProjectile. */
export const PLAYER_PROJECTILE_SPEED = 22;
export const WISP_PROJECTILE_SPEED = PLAYER_PROJECTILE_SPEED * 0.6; // 13.2

export type WispColorId = "ember" | "frost" | "void" | "nature" | "storm";

export interface WispPalette {
  id: WispColorId;
  color: number;
  name: string;
}

export const WISP_PALETTES: WispPalette[] = [
  { id: "ember", color: 0xff5522, name: "Ember Wisp" },
  { id: "frost", color: 0x66ccff, name: "Frost Wisp" },
  { id: "void", color: 0xaa44ff, name: "Void Wisp" },
  { id: "nature", color: 0x44dd66, name: "Grove Wisp" },
  { id: "storm", color: 0xffee44, name: "Storm Wisp" },
];

export type WispAttackPhase =
  | "idle"
  | "spline"
  | "circles_windup"
  | "pillar_rise"
  | "pillar_warn"
  | "pillar_fall"
  | "recover";

export interface WispInstance {
  id: string;
  palette: WispPalette;
  position: THREE.Vector3;
  aggroRadius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  group: THREE.Group;
  beam: THREE.Mesh;
  /** Multi-mesh animated core group (or legacy mesh). */
  core: THREE.Object3D;
  aggroRing: THREE.Mesh;
  /** 0 spline · 1 circles · 2 pillar */
  attackIndex: number;
  phase: WispAttackPhase;
  phaseT: number;
  castCd: number;
  /** Pillar object while active. */
  pillar: THREE.Group | null;
  pillarDir: THREE.Vector3;
  castSeed: number;
  /** Bob phase for idle animation. */
  bobT: number;
}

export interface WispEventField {
  wisps: WispInstance[];
  root: THREE.Group;
  dispose: () => void;
}

/**
 * Animated wisp core — multi-layer ball (core + plasma shell + orbit ring)
 * with additive blending and time-driven pulse (updated in updateWisps).
 */
function makeWispCore(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = "WispCore";

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: color,
    emissiveIntensity: 2.4,
    transparent: true,
    opacity: 0.95,
    roughness: 0.08,
    metalness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), coreMat);
  core.name = "wisp_inner";
  g.add(core);

  const shellMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 20), shellMat);
  shell.name = "wisp_shell";
  g.add(shell);

  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2.4;
  ring.name = "wisp_ring";
  g.add(ring);

  const ring2 = ring.clone();
  ring2.rotation.x = Math.PI / 1.7;
  ring2.rotation.z = 0.6;
  ring2.name = "wisp_ring_b";
  g.add(ring2);

  // Soft sprite halo
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.35, "rgba(255,220,180,0.45)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.set(2.4, 2.4, 1);
  halo.name = "wisp_halo";
  g.add(halo);

  g.userData.color = color;
  return g;
}

function makeBeam(color: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  // Tall thin cylinder = beam straight up
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 40, 12, 1, true), mat);
  mesh.position.y = 20;
  mesh.renderOrder = 3;
  return mesh;
}

function makeAggroRing(radius: number, color: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 48), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.08;
  return mesh;
}

export function createWispEventField(scene: THREE.Scene): WispEventField {
  const root = new THREE.Group();
  root.name = "WispEvents";
  scene.add(root);
  return {
    wisps: [],
    root,
    dispose: () => {
      scene.remove(root);
      root.traverse((c) => {
        const m = c as THREE.Mesh;
        m.geometry?.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
    },
  };
}

function makeWispHpBar(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = "wisp_hp_bar";
  const maxW = 1.2;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(maxW, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x0a0a12, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  const fg = new THREE.Mesh(
    new THREE.PlaneGeometry(maxW, 0.07),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  fg.position.z = 0.01;
  fg.name = "hp_fg";
  g.add(bg, fg);
  g.userData.maxW = maxW;
  g.userData.fg = fg;
  g.position.y = 2.8;
  return g;
}

function setWispHpBar(w: WispInstance) {
  const bar = w.group.userData.hpBar as THREE.Group | undefined;
  if (!bar) return;
  const fg = bar.userData.fg as THREE.Mesh | undefined;
  const maxW = (bar.userData.maxW as number) ?? 1.2;
  if (!fg) return;
  const r = Math.max(0, Math.min(1, w.hp / w.maxHp));
  fg.scale.x = Math.max(0.001, r);
  fg.position.x = -((1 - r) * maxW) * 0.5;
}

export function spawnWisp(
  field: WispEventField,
  position: THREE.Vector3,
  seed: number,
  opts?: { aggroRadius?: number; hp?: number },
): WispInstance {
  const pal = WISP_PALETTES[seed % WISP_PALETTES.length]!;
  const aggroRadius = opts?.aggroRadius ?? 14;
  // Tougher default so wisps are real combat objectives, not one-shots.
  const maxHp = opts?.hp ?? 560;
  const group = new THREE.Group();
  group.position.copy(position);
  group.position.y = 0;

  const core = makeWispCore(pal.color);
  core.position.y = 1.55;
  const beam = makeBeam(pal.color);
  const aggroRing = makeAggroRing(aggroRadius, pal.color);
  const hpBar = makeWispHpBar(pal.color);
  group.add(core, beam, aggroRing, hpBar);
  group.userData.hpBar = hpBar;
  field.root.add(group);

  const w: WispInstance = {
    id: `wisp_${field.wisps.length}_${seed >>> 0}`,
    palette: pal,
    position: position.clone(),
    aggroRadius,
    hp: maxHp,
    maxHp,
    alive: true,
    group,
    beam,
    core,
    aggroRing,
    attackIndex: 0,
    phase: "idle",
    phaseT: 0,
    castCd: 1.2 + seededUnit(seed, 2) * 0.8,
    pillar: null,
    pillarDir: new THREE.Vector3(0, 0, 1),
    castSeed: seed,
    bobT: seededUnit(seed, 7) * Math.PI * 2,
  };
  field.wisps.push(w);
  return w;
}

/** Spawn several wisps around the map (deterministic from map seed). */
export function spawnWispEventPack(
  field: WispEventField,
  mapSeed: number,
  anchors: THREE.Vector3[],
): void {
  for (let i = 0; i < anchors.length; i++) {
    const s = hashString(`wisp|${mapSeed}|${i}`);
    spawnWisp(field, anchors[i]!, s);
  }
}

function disposePillar(w: WispInstance) {
  if (!w.pillar) return;
  w.pillar.removeFromParent();
  w.pillar.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat.dispose();
    }
  });
  w.pillar = null;
}

function startSplineAttack(
  w: WispInstance,
  playerPos: THREE.Vector3,
  projectiles: ProjectileField | null,
) {
  const origin = w.position.clone();
  origin.y = 1.5;
  // Quadratic spline mid control offset perpendicular to aim
  const to = new THREE.Vector3(playerPos.x - w.position.x, 0, playerPos.z - w.position.z);
  if (to.lengthSq() < 1e-4) to.set(0, 0, 1);
  to.normalize();
  const side = new THREE.Vector3(-to.z, 0, to.x);
  const mid = w.position
    .clone()
    .add(to.clone().multiplyScalar(5))
    .add(side.multiplyScalar((seededUnit(w.castSeed, w.attackIndex) - 0.5) * 8));
  mid.y = 2.2 + seededUnit(w.castSeed, 9) * 2;
  const end = playerPos.clone();
  end.y = 1.2;
  // Arc bolt: light seek + gravity — Shift dodge / side-step clears if timed.
  projectiles?.spawnSpline?.({
    origin,
    control: mid,
    target: end,
    damage: 18 + Math.floor(seededUnit(w.castSeed, 11) * 10),
    speed: WISP_PROJECTILE_SPEED,
    color: w.palette.color,
    radius: 0.58,
    life: 3.2,
    label: `${w.palette.name} Bolt`,
    team: "enemy",
    seekAccel: 5.2,
    gravityScale: 1.05,
  });
  // Secondary ballistic spark (weaker seek, easier to dodge)
  const sparkCtrl = mid.clone().add(side.clone().multiplyScalar(1.2));
  sparkCtrl.y += 0.6;
  projectiles?.spawnSpline?.({
    origin,
    control: sparkCtrl,
    target: end.clone().add(new THREE.Vector3((seededUnit(w.castSeed, 13) - 0.5) * 2.5, 0, 0)),
    damage: 11,
    speed: WISP_PROJECTILE_SPEED * 0.92,
    color: w.palette.color,
    radius: 0.5,
    life: 2.6,
    label: `${w.palette.name} Spark`,
    team: "enemy",
    seekAccel: 3.8,
    gravityScale: 1.15,
  });
}

function startCircleAttack(
  w: WispInstance,
  playerPos: THREE.Vector3,
  pending: PendingStrikeField | null,
  warnings: WarningEffectField | null,
) {
  const n = 3 + Math.floor(seededUnit(w.castSeed, w.attackIndex + 20) * 4); // 3..6
  const windup = 2.0;
  warnings?.spawn({
    position: w.position,
    duration: windup,
    color: w.palette.color,
    height: 3.2,
    seed: `${w.id}|circles|${w.castSeed}`,
  });
  for (let i = 0; i < n; i++) {
    const u = seededUnit(w.castSeed, 100 + i);
    const v = seededUnit(w.castSeed, 200 + i);
    // Bias circles toward player + random in aggro
    const mix = i % 2 === 0 ? 0.65 : 0.25;
    const baseX = THREE.MathUtils.lerp(w.position.x, playerPos.x, mix);
    const baseZ = THREE.MathUtils.lerp(w.position.z, playerPos.z, mix);
    const ang = u * Math.PI * 2;
    const r = 1.5 + v * (w.aggroRadius * 0.55);
    const ox = baseX + Math.cos(ang) * r * (1 - mix * 0.5);
    const oz = baseZ + Math.sin(ang) * r * (1 - mix * 0.5);
    pending?.schedule({
      kind: "circle",
      origin: new THREE.Vector3(ox, 0, oz),
      radius: 2.2 + seededUnit(w.castSeed, 50 + i) * 1.1,
      damage: 22 + i * 2,
      windup,
      label: `${w.palette.name} Nova ${i + 1}`,
      color: w.palette.color,
      element: "arcane",
      sourceId: w.id,
      ring: true,
      warnHeight: 2.2,
    });
  }
}

function beginPillar(w: WispInstance, playerPos: THREE.Vector3, parent: THREE.Object3D) {
  disposePillar(w);
  const dir = new THREE.Vector3(playerPos.x - w.position.x, 0, playerPos.z - w.position.z);
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
  dir.normalize();
  w.pillarDir.copy(dir);
  // Place between player and wisp
  const mid = w.position.clone().add(dir.clone().multiplyScalar(3.2));
  const pillar = new THREE.Group();
  pillar.position.copy(mid);
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 3.2, 1.1),
    new THREE.MeshStandardMaterial({
      color: 0x4a3a58,
      emissive: w.palette.color,
      emissiveIntensity: 0.35,
      roughness: 0.8,
    }),
  );
  stone.position.y = -1.6; // starts buried
  stone.castShadow = true;
  pillar.add(stone);
  pillar.userData.stone = stone;
  parent.add(pillar);
  w.pillar = pillar;
}

function updatePillarRise(w: WispInstance, t: number) {
  // t 0..1 over 1 second
  const stone = w.pillar?.userData.stone as THREE.Mesh | undefined;
  if (!stone) return;
  stone.position.y = -1.6 + t * 3.2; // rise fully above ground
}

function updatePillarFall(
  w: WispInstance,
  t: number,
  onImpact: (origin: THREE.Vector3, dir: THREE.Vector3, length: number) => void,
) {
  // t 0..1 fall animation — tip toward aggro edge
  if (!w.pillar) return;
  const stone = w.pillar.userData.stone as THREE.Mesh | undefined;
  if (!stone) return;
  const angle = t * (Math.PI / 2) * 0.95;
  stone.rotation.z = 0;
  stone.rotation.x = 0;
  // Fall in pillarDir
  const axis = new THREE.Vector3(-w.pillarDir.z, 0, w.pillarDir.x);
  stone.setRotationFromAxisAngle(axis, angle);
  stone.position.y = 1.6 * Math.cos(angle);
  if (t >= 1) {
    const length = w.aggroRadius - 3;
    const impactOrigin = w.pillar.position.clone();
    onImpact(impactOrigin, w.pillarDir.clone(), length);
    disposePillar(w);
  }
}

export interface WispUpdateCtx {
  playerPos: THREE.Vector3;
  delta: number;
  time: number;
  projectiles: ProjectileField | null;
  pending: PendingStrikeField | null;
  warnings: WarningEffectField | null;
  particles: ParticleVfx | null;
  /** Damage the player. */
  onPlayerHit?: (damage: number, label: string) => void;
  log?: (msg: string) => void;
}

/**
 * Tick all wisps. Returns true if any is aggroed (for music/UI hooks).
 */
export function updateWisps(field: WispEventField, ctx: WispUpdateCtx): boolean {
  let anyAggro = false;
  for (const w of field.wisps) {
    if (!w.alive) continue;
    // Animated ball: bob, spin rings, pulse shell
    w.bobT = (w.bobT ?? 0) + ctx.delta;
    const bob = Math.sin(ctx.time * 3.2 + w.castSeed) * 0.18;
    w.core.position.y = 1.55 + bob;
    w.core.rotation.y += ctx.delta * 1.4;
    const shell = w.core.getObjectByName("wisp_shell");
    const ring = w.core.getObjectByName("wisp_ring");
    const ringB = w.core.getObjectByName("wisp_ring_b");
    const halo = w.core.getObjectByName("wisp_halo");
    if (shell) {
      const s = 1 + 0.08 * Math.sin(ctx.time * 5 + w.castSeed);
      shell.scale.setScalar(s);
    }
    if (ring) ring.rotation.z += ctx.delta * 2.2;
    if (ringB) ringB.rotation.z -= ctx.delta * 1.6;
    if (halo) {
      const hs = 2.2 + 0.35 * Math.sin(ctx.time * 4.5 + w.castSeed);
      halo.scale.set(hs, hs, 1);
    }
    const beamMat = w.beam.material as THREE.MeshBasicMaterial;
    beamMat.opacity = 0.28 + 0.2 * Math.sin(ctx.time * 4 + w.castSeed);

    const dist = Math.hypot(ctx.playerPos.x - w.position.x, ctx.playerPos.z - w.position.z);
    const aggroed = dist <= w.aggroRadius;
    if (aggroed) anyAggro = true;
    (w.aggroRing.material as THREE.MeshBasicMaterial).opacity = aggroed ? 0.38 : 0.15;

    if (!aggroed) {
      if (w.phase !== "idle" && w.phase !== "recover") {
        w.phase = "idle";
        w.phaseT = 0;
        disposePillar(w);
      }
      continue;
    }

    w.castCd -= ctx.delta;
    w.phaseT += ctx.delta;

    switch (w.phase) {
      case "idle":
      case "recover":
        if (w.castCd <= 0) {
          w.castSeed = hashString(`${w.id}|${Math.floor(ctx.time * 10)}`);
          const atk = w.attackIndex % 3;
          w.attackIndex++;
          w.phaseT = 0;
          if (atk === 0) {
            w.phase = "spline";
            startSplineAttack(w, ctx.playerPos, ctx.projectiles);
            ctx.log?.(`${w.palette.name} fires curved bolts!`);
            w.phase = "recover";
            w.castCd = 1.6;
            w.phaseT = 0;
          } else if (atk === 1) {
            w.phase = "circles_windup";
            startCircleAttack(w, ctx.playerPos, ctx.pending, ctx.warnings);
            ctx.log?.(`${w.palette.name} paints the ground — 2s!`);
          } else {
            w.phase = "pillar_rise";
            beginPillar(w, ctx.playerPos, field.root);
            ctx.warnings?.spawn({
              position: w.position,
              duration: 2.0,
              color: w.palette.color,
              height: 3.5,
              seed: `${w.id}|pillar`,
            });
            ctx.log?.(`${w.palette.name} raises a stone pillar!`);
          }
        }
        break;
      case "circles_windup":
        if (w.phaseT >= 2.0) {
          w.phase = "recover";
          w.castCd = 1.8;
          w.phaseT = 0;
        }
        break;
      case "pillar_rise":
        updatePillarRise(w, Math.min(1, w.phaseT / 1.0));
        if (w.phaseT >= 1.0) {
          w.phase = "pillar_warn";
          w.phaseT = 0;
          // Ground danger line telegraph toward aggro edge
          const fallLen = w.aggroRadius - 3;
          ctx.pending?.schedule({
            kind: "line",
            origin: w.pillar?.position.clone() ?? w.position.clone(),
            dir: w.pillarDir.clone(),
            length: fallLen,
            halfWidth: 1.35,
            damage: 0, // visual only — real damage on fall impact
            windup: 1.0,
            label: `${w.palette.name} Pillar Shadow`,
            color: w.palette.color,
            element: "physical",
            sourceId: w.id,
            warn: true,
            warnHeight: 2.5,
          });
        }
        break;
      case "pillar_warn":
        if (w.phaseT >= 1.0) {
          w.phase = "pillar_fall";
          w.phaseT = 0;
        }
        break;
      case "pillar_fall":
        updatePillarFall(w, Math.min(1, w.phaseT / 0.55), (origin, dir, length) => {
          // Damage player if in fall corridor
          const toP = new THREE.Vector3(ctx.playerPos.x - origin.x, 0, ctx.playerPos.z - origin.z);
          const fwd = dir.clone().normalize();
          const along = toP.dot(fwd);
          const side = Math.abs(toP.x * fwd.z - toP.z * fwd.x);
          if (along >= 0 && along <= length && side < 1.6) {
            ctx.onPlayerHit?.(32, `${w.palette.name} Pillar Crush`);
          }
          ctx.particles?.impact(origin.clone().add(fwd.multiplyScalar(length * 0.5)).setY(0.5), w.palette.color, 1.2);
          ctx.warnings?.impactFlash(origin, w.palette.color, 3.5, `${w.id}|pillar_impact`);
          // Real damage line via pending for allies consistency
          ctx.pending?.schedule({
            kind: "line",
            origin,
            dir,
            length,
            halfWidth: 1.5,
            damage: 36,
            windup: 0.05,
            label: `${w.palette.name} Pillar Crush`,
            color: w.palette.color,
            element: "physical",
            sourceId: w.id,
            warn: false,
          });
        });
        if (w.phaseT >= 0.55) {
          w.phase = "recover";
          w.castCd = 2.2;
          w.phaseT = 0;
        }
        break;
      default:
        break;
    }
  }
  return anyAggro;
}

export function damageWisp(w: WispInstance, dmg: number): boolean {
  if (!w.alive) return false;
  w.hp = Math.max(0, w.hp - dmg);
  setWispHpBar(w);
  // Flash core on hit
  const shell = w.core.getObjectByName("wisp_shell") as THREE.Mesh | undefined;
  if (shell) {
    const mat = shell.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.75;
  }
  if (w.hp <= 0) {
    w.alive = false;
    w.group.visible = false;
    disposePillar(w);
    return true;
  }
  return false;
}

export function nearestAliveWisp(
  field: WispEventField,
  pos: THREE.Vector3,
  maxDist: number,
): WispInstance | null {
  let best: WispInstance | null = null;
  let bestD = maxDist;
  for (const w of field.wisps) {
    if (!w.alive) continue;
    const d = Math.hypot(w.position.x - pos.x, w.position.z - pos.z);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}
