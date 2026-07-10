import * as THREE from "three";
import type { SkillElement } from "./particles";
import { elementColor } from "./particles";
import { getFlameTexture, getSpriteTexture, getArrowTexture, disposeVfxTextures } from "./vfxTextures";
import { createHotZoneMaterial } from "./hotZoneMaterial";
import { projectileForElement, type VfxProjectilePreset } from "../../data/vfxCatalog";
import { getActiveCombatProfile } from "../../data/characterCombatProfiles";
import type { ClassSkill } from "../../data/classSkills";

/** Hero-dependent status duration — casters/support 5s, assassins/gunners 3s. */
export function statusDurationSec(): number {
  const brain = getActiveCombatProfile().brain;
  if (brain === "caster" || brain === "support") return 5;
  if (brain === "assassin" || brain === "gunner") return 3;
  return 4;
}

export function heroVfxTtl(): number {
  return statusDurationSec() * 0.85;
}

export type StatusKind = "burn" | "poison" | "frost" | "shock" | "hot";

export interface StatusSpec {
  kind: StatusKind;
  element: SkillElement;
  color: number;
  duration: number;
}

export function statusFromSkill(skill: ClassSkill | undefined): StatusSpec | null {
  if (!skill) return null;
  const hay = [skill.id, skill.name, skill.type, ...(skill.effects ?? [])].join(" ").toLowerCase();
  const turnMatch = hay.match(/(\d+)\s*turns?/);
  const turns = turnMatch ? Math.max(1, parseInt(turnMatch[1], 10)) : 3;
  const duration = (turns / 3) * statusDurationSec();

  if (skill.type === "heal" || skill.type === "heal_over_time" || hay.includes("heal over")) {
    return { kind: "hot", element: "arcane", color: 0x66ffaa, duration };
  }
  if (hay.includes("burn")) return { kind: "burn", element: "fire", color: 0xff5522, duration };
  if (hay.includes("poison") || hay.includes("venom")) return { kind: "poison", element: "poison", color: 0x7fe04a, duration };
  if (hay.includes("frost") || hay.includes("chill") || hay.includes("freeze")) {
    return { kind: "frost", element: "ice", color: 0x6fd2ff, duration };
  }
  if (hay.includes("shock") || hay.includes("stun")) {
    return { kind: "shock", element: "lightning", color: 0x9ad8ff, duration };
  }
  return null;
}

// ─── Fire aura (ported from vfx-sandbox FireAura) ───────────────────────────

interface FlamePart {
  angle: number;
  baseR: number;
  speed: number;
  life: number;
  age: number;
  seed: number;
}

class FireAura3D {
  readonly group = new THREE.Group();
  private core: THREE.Points;
  private glow: THREE.Points;
  private parts: FlamePart[];
  private positions: Float32Array;
  private colors: Float32Array;
  private inner = new THREE.Color("#ffe39a");
  private outer = new THREE.Color("#ff3b14");
  private hot = new THREE.Color();
  private tmp = new THREE.Color();
  private white = new THREE.Color("#ffffff");
  count: number;
  height: number;
  radius: number;
  rise: number;
  turbulence: number;
  size: number;

  constructor(opts: {
    innerColor?: number | string;
    outerColor?: number | string;
    count?: number;
    height?: number;
    radius?: number;
    rise?: number;
    turbulence?: number;
    size?: number;
  } = {}) {
    this.count = opts.count ?? 48;
    this.height = opts.height ?? 1.4;
    this.radius = opts.radius ?? 0.55;
    this.rise = opts.rise ?? 1.1;
    this.turbulence = opts.turbulence ?? 1.0;
    this.size = opts.size ?? 0.14;
    if (opts.innerColor != null) this.inner.set(opts.innerColor);
    if (opts.outerColor != null) this.outer.set(opts.outerColor);

    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.parts = [];
    for (let i = 0; i < this.count; i++) {
      this.parts.push({
        angle: Math.random() * Math.PI * 2,
        baseR: 0.2 + Math.random() * 0.8,
        speed: 0.6 + Math.random() * 0.8,
        life: 0.8 + Math.random() * 0.9,
        age: Math.random() * 1.6,
        seed: Math.random() * 100,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const flameTex = getFlameTexture();
    this.core = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: flameTex,
        size: this.size * 0.92,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glow = new THREE.Points(
      geo.clone(),
      new THREE.PointsMaterial({
        map: getSpriteTexture(),
        size: this.size * 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.group.add(this.core, this.glow);
  }

  update(t: number, delta: number) {
    const dt = Math.min(delta, 0.05);
    this.hot.copy(this.inner).lerp(this.white, 0.6);
    for (let i = 0; i < this.count; i++) {
      const pt = this.parts[i]!;
      pt.age += dt * pt.speed * this.rise;
      if (pt.age > pt.life) pt.age -= pt.life;
      const frac = pt.age / pt.life;
      const taper = Math.pow(1 - frac, 0.62) * (0.82 + 0.34 * Math.sin(frac * Math.PI));
      const ang = pt.angle + frac * this.turbulence * 1.15;
      const wobble = Math.sin(t * 3.2 + pt.seed) * this.turbulence * 0.16 * frac;
      const r = pt.baseR * this.radius * taper + wobble;
      const y = this.height * frac * (0.55 + 0.45 * frac);
      this.positions[i * 3] = Math.cos(ang) * r + Math.sin(t * 5 + pt.seed) * 0.035 * frac;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = Math.sin(ang) * r + Math.cos(t * 5 + pt.seed) * 0.035 * frac;
      if (frac < 0.3) this.tmp.copy(this.hot).lerp(this.inner, frac / 0.3);
      else this.tmp.copy(this.inner).lerp(this.outer, (frac - 0.3) / 0.7);
      const flicker = 0.86 + 0.14 * Math.sin(t * 22 + pt.seed * 3.7);
      const fade = Math.pow(1 - frac, 1.25) * 1.7 * flicker;
      this.colors[i * 3] = this.tmp.r * fade;
      this.colors[i * 3 + 1] = this.tmp.g * fade;
      this.colors[i * 3 + 2] = this.tmp.b * fade;
    }
    for (const pts of [this.core, this.glow]) {
      const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = pts.geometry.getAttribute("color") as THREE.BufferAttribute;
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
  }

  dispose() {
    this.core.geometry.dispose();
    this.glow.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
  }
}

// ─── Spline projectile (Catmull-Rom arc) ────────────────────────────────────

interface ProjectileHandle {
  group: THREE.Group;
  preset: VfxProjectilePreset;
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
  trailPos: Float32Array;
  fireTrail: THREE.Points;
  onHit?: () => void;
  follow?: THREE.Object3D | null;
}

export class CombatVfx {
  private scene: THREE.Scene;
  private clock = 0;
  private disposed = false;
  private projectiles: ProjectileHandle[] = [];
  private fireAuras: Array<{ aura: FireAura3D; follow: THREE.Object3D | null; until: number }> = [];
  private statusZones: Array<{
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    follow: THREE.Object3D | null;
    until: number;
    kind: StatusKind;
  }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Curved spline projectile from origin to target. */
  fireProjectile(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    opts: {
      element: SkillElement;
      skillTags?: string;
      preset?: Partial<VfxProjectilePreset>;
      onHit?: () => void;
    },
  ) {
    if (this.disposed) return;
    const base = projectileForElement(opts.element, opts.skillTags);
    const preset = { ...base, ...opts.preset };
    const mid = origin.clone().lerp(target, 0.5);
    const dist = origin.distanceTo(target);
    mid.y += Math.max(1.2, dist * 0.22);
    const curve = new THREE.CatmullRomCurve3(
      [origin.clone(), mid, target.clone()],
      false,
      "catmullrom",
      0.35,
    );
    const group = new THREE.Group();
    const color = new THREE.Color(preset.primary);
    const coreColor = color.clone().lerp(new THREE.Color("#fff6e0"), 0.65);

    const isArrow = preset.kind === "arrow_trail";
    const isBullet = preset.kind === "bullet";
    const headTex = isArrow ? getArrowTexture() : isBullet ? getSpriteTexture() : getFlameTexture();
    const headScale = isArrow ? [preset.size * 4, preset.size * 1.2, 1] as const : [preset.size * 2, preset.size * 2, 1] as const;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getSpriteTexture(),
        color: color.clone().multiplyScalar(1.4),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.set(preset.size * 2.6, preset.size * 2.6, 1);
    group.add(halo);

    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: headTex,
        color: coreColor.clone().multiplyScalar(2.2),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    core.scale.set(...headScale);
    group.add(core);

    const light = new THREE.PointLight(preset.primary, 4, 8);
    group.add(light);

    const trailLen = 22;
    const trailPos = new Float32Array(trailLen * 3);
    const trailColors = new Float32Array(trailLen * 3);
    for (let i = 0; i < trailLen; i++) {
      const f = (1 - i / trailLen) * 1.5;
      trailPos[i * 3] = origin.x;
      trailPos[i * 3 + 1] = origin.y;
      trailPos[i * 3 + 2] = origin.z;
      trailColors[i * 3] = color.r * f;
      trailColors[i * 3 + 1] = color.g * f;
      trailColors[i * 3 + 2] = color.b * f;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
    const fireTrail = new THREE.Points(
      trailGeo,
      new THREE.PointsMaterial({
        map: getFlameTexture(),
        size: preset.size * 1.1,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(fireTrail);

    group.position.copy(origin);
    this.scene.add(group);

    this.projectiles.push({
      group,
      preset,
      curve,
      t: 0,
      speed: 1 / Math.max(0.25, dist / preset.speed),
      trailPos,
      fireTrail,
      onHit: opts.onHit,
      follow: null,
    });
  }

  /** Looping flame aura on a unit (burn DOT, fire totem, ignite). */
  attachFireAura(
    follow: THREE.Object3D,
    opts: { innerColor?: number; outerColor?: number; duration?: number; radius?: number } = {},
  ) {
    const aura = new FireAura3D({
      innerColor: opts.innerColor ?? 0xffe39a,
      outerColor: opts.outerColor ?? 0xff3b14,
      count: 40,
      height: 1.2,
      radius: opts.radius ?? 0.5,
      size: 0.12,
    });
    aura.group.position.y = 0.1;
    follow.add(aura.group);
    this.fireAuras.push({
      aura,
      follow,
      until: opts.duration != null && opts.duration > 0 ? this.clock + opts.duration : Infinity,
    });
    return aura;
  }

  /** Ground hot-zone / DOT ring under a unit. */
  attachStatusZone(follow: THREE.Object3D, spec: StatusSpec) {
    const mat = createHotZoneMaterial(spec.color, spec.kind === "hot", 0.5);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06;
    follow.add(mesh);

    if (spec.kind === "burn") {
      this.attachFireAura(follow, {
        innerColor: 0xffe39a,
        outerColor: 0xff3b14,
        duration: spec.duration,
        radius: 0.42,
      });
    }

    this.statusZones.push({
      mesh,
      mat,
      follow,
      until: this.clock + spec.duration,
      kind: spec.kind,
    });
  }

  pulseCastAura(origin: THREE.Vector3, element: SkillElement) {
    const color = elementColor(element);
    const mat = createHotZoneMaterial(color, true, 0.65);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 36), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(origin.x, 0.08, origin.z);
    this.scene.add(mesh);
    this.statusZones.push({
      mesh,
      mat,
      follow: null,
      until: this.clock + 0.55,
      kind: "hot",
    });
    if (element === "fire") {
      const aura = new FireAura3D({ count: 28, height: 0.9, radius: 0.38, size: 0.1 });
      aura.group.position.copy(origin).setY(0.1);
      this.scene.add(aura.group);
      this.fireAuras.push({ aura, follow: null, until: this.clock + 0.7 });
    }
  }

  update(delta: number) {
    if (this.disposed) return;
    this.clock += delta;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.t += delta / p.speed;
      const u = Math.min(1, p.t);
      const pos = p.curve.getPoint(u);
      p.group.position.copy(pos);
      if (p.preset.spin) {
        const spr = p.group.children[1] as THREE.Sprite;
        if (spr?.material) (spr.material as THREE.SpriteMaterial).rotation = this.clock * p.preset.spin;
      }
      const arr = p.trailPos;
      for (let j = arr.length / 3 - 1; j > 0; j--) {
        arr[j * 3] = arr[(j - 1) * 3]!;
        arr[j * 3 + 1] = arr[(j - 1) * 3 + 1]!;
        arr[j * 3 + 2] = arr[(j - 1) * 3 + 2]!;
      }
      arr[0] = pos.x;
      arr[1] = pos.y;
      arr[2] = pos.z;
      (p.fireTrail.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

      if (u >= 1) {
        p.onHit?.();
        this.removeProjectile(i);
      }
    }

    for (let i = this.fireAuras.length - 1; i >= 0; i--) {
      const f = this.fireAuras[i]!;
      if (this.clock >= f.until) {
        if (f.follow) f.follow.remove(f.aura.group);
        else this.scene.remove(f.aura.group);
        f.aura.dispose();
        this.fireAuras.splice(i, 1);
        continue;
      }
      f.aura.update(this.clock, delta);
    }

    for (let i = this.statusZones.length - 1; i >= 0; i--) {
      const z = this.statusZones[i]!;
      z.mat.uniforms.uTime!.value = this.clock;
      const life = z.until - this.clock;
      z.mat.uniforms.uOpacity!.value = Math.min(0.55, life * 0.35);
      if (this.clock >= z.until) {
        if (z.follow) z.follow.remove(z.mesh);
        else this.scene.remove(z.mesh);
        z.mat.dispose();
        z.mesh.geometry.dispose();
        this.statusZones.splice(i, 1);
      }
    }
  }

  private removeProjectile(i: number) {
    const p = this.projectiles[i]!;
    this.scene.remove(p.group);
    p.group.traverse((c) => {
      const s = c as THREE.Sprite;
      if (s.material) (s.material as THREE.Material).dispose();
    });
    this.scene.remove(p.fireTrail);
    p.fireTrail.geometry.dispose();
    (p.fireTrail.material as THREE.Material).dispose();
    this.projectiles.splice(i, 1);
  }

  dispose() {
    this.disposed = true;
    while (this.projectiles.length) this.removeProjectile(0);
    for (const f of this.fireAuras) {
      if (f.follow) f.follow.remove(f.aura.group);
      else this.scene.remove(f.aura.group);
      f.aura.dispose();
    }
    this.fireAuras = [];
    for (const z of this.statusZones) {
      if (z.follow) z.follow.remove(z.mesh);
      else this.scene.remove(z.mesh);
      z.mat.dispose();
      z.mesh.geometry.dispose();
    }
    this.statusZones = [];
    disposeVfxTextures();
  }
}