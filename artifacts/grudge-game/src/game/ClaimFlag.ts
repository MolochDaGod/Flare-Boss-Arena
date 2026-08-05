/**
 * Claim flag scripting (uMMORPG / Legion claim pattern).
 *
 * Place a claim flag → generates harvest nodes inside the claim radius.
 * Visual: pole + banner (Legion Claim Flag texture when available) + ground ring.
 */

import * as THREE from "three";
import { pickClaimNodeDefs, type HarvestNodeDef } from "../data/harvestNodeDefs";
import type { HarvestField, HarvestNode } from "./Harvestables";
import { hashString, seededUnit } from "../data/monsterCatalog";

export const CLAIM_FLAG_TEX =
  "https://molochdagod.github.io/ObjectStore/icons/entities/Legion%20Claim%20Flag.PNG";

export interface ClaimFlagState {
  id: string;
  position: THREE.Vector3;
  radius: number;
  owner: "player" | "faction" | "neutral";
  factionId: string;
  /** Harvest node ids owned by this claim. */
  nodeIds: string[];
  group: THREE.Group;
  claimedAt: number;
}

export interface ClaimFlagField {
  flags: ClaimFlagState[];
  root: THREE.Group;
  dispose: () => void;
}

function makeFlagMesh(color: number, tex?: THREE.Texture | null): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3028, metalness: 0.3, roughness: 0.55 }),
  );
  pole.position.y = 1.2;
  pole.castShadow = true;
  g.add(pole);

  const bannerMat = new THREE.MeshStandardMaterial({
    color,
    map: tex ?? null,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: !!tex,
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), bannerMat);
  banner.position.set(0.55, 2.0, 0);
  banner.castShadow = true;
  g.add(banner);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.25 }),
  );
  finial.position.y = 2.45;
  g.add(finial);
  return g;
}

function makeClaimRing(radius: number, color: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uRadius: { value: radius },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uRadius;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float d = length(p);
        float ring = smoothstep(0.98, 0.92, d) * smoothstep(0.78, 0.88, d);
        float pulse = 0.55 + 0.45 * sin(uTime * 2.5 + d * 8.0);
        float fill = (1.0 - smoothstep(0.0, 1.0, d)) * 0.08;
        float a = (ring * pulse + fill) * 0.9;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  mesh.renderOrder = 2;
  mesh.userData.shaderMat = mat;
  return mesh;
}

export function createClaimFlagField(scene: THREE.Scene): ClaimFlagField {
  const root = new THREE.Group();
  root.name = "ClaimFlags";
  scene.add(root);
  const flags: ClaimFlagState[] = [];
  let tex: THREE.Texture | null = null;
  const loader = new THREE.TextureLoader();
  loader.load(
    CLAIM_FLAG_TEX,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      tex = t;
    },
    undefined,
    () => {
      /* texture optional */
    },
  );

  return {
    flags,
    root,
    dispose: () => {
      scene.remove(root);
      root.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
      tex?.dispose();
      flags.length = 0;
    },
  };
}

export interface PlaceClaimOpts {
  position: THREE.Vector3;
  radius?: number;
  owner?: ClaimFlagState["owner"];
  factionId?: string;
  color?: number;
  /** How many harvest nodes to script inside the claim. */
  nodeCount?: number;
  maxTier?: number;
  now?: number;
  seed?: number;
  /**
   * Show the yellow/gold additive ground ring.
   * Default false — player camps use fence + tower instead.
   */
  showRing?: boolean;
  /** Show the tall banner pole (hide when a full camp is built). */
  showFlag?: boolean;
}

/**
 * Plant a claim flag and return scripted harvest node spawn requests
 * (caller inserts into HarvestField via `spawnScriptedHarvestNodes`).
 */
export function placeClaimFlag(
  field: ClaimFlagField,
  opts: PlaceClaimOpts,
): { claim: ClaimFlagState; nodeSpawns: Array<{ def: HarvestNodeDef; position: THREE.Vector3 }> } {
  const radius = opts.radius ?? 12;
  const color = opts.color ?? 0xc9a227;
  const id = `claim_${field.flags.length}_${(opts.seed ?? Date.now()) >>> 0}`;
  const group = new THREE.Group();
  group.position.copy(opts.position);
  group.position.y = 0;

  // Camps own the visuals (fence + tower). Claim only scripts harvest by default.
  if (opts.showFlag !== false && opts.showRing) {
    const flag = makeFlagMesh(color, null);
    group.add(flag);
  } else if (opts.showFlag === true) {
    const flag = makeFlagMesh(color, null);
    group.add(flag);
  }
  if (opts.showRing) {
    const ring = makeClaimRing(radius, color);
    group.add(ring);
  }
  field.root.add(group);

  const seed = opts.seed ?? hashString(id);
  const defs = pickClaimNodeDefs(seed, opts.nodeCount ?? 8, opts.maxTier ?? 2);
  const nodeSpawns: Array<{ def: HarvestNodeDef; position: THREE.Vector3 }> = [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const u = seededUnit(seed, i * 3 + 1);
    const v = seededUnit(seed, i * 3 + 2);
    const ang = u * Math.PI * 2;
    const r = 2.5 + v * (radius - 3.2);
    nodeSpawns.push({
      def,
      position: new THREE.Vector3(
        opts.position.x + Math.cos(ang) * r,
        0,
        opts.position.z + Math.sin(ang) * r,
      ),
    });
  }

  const claim: ClaimFlagState = {
    id,
    position: opts.position.clone(),
    radius,
    owner: opts.owner ?? "player",
    factionId: opts.factionId ?? "player",
    nodeIds: [],
    group,
    claimedAt: opts.now ?? performance.now() / 1000,
  };
  field.flags.push(claim);
  return { claim, nodeSpawns };
}

export function updateClaimFlags(field: ClaimFlagField, time: number) {
  for (const c of field.flags) {
    c.group.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.userData?.shaderMat as THREE.ShaderMaterial | undefined;
      if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = time;
    });
  }
}

/** True if position is inside any claim. */
export function isInsideClaim(field: ClaimFlagField, pos: THREE.Vector3): ClaimFlagState | null {
  for (const c of field.flags) {
    const d = Math.hypot(pos.x - c.position.x, pos.z - c.position.z);
    if (d <= c.radius) return c;
  }
  return null;
}

/** Attach generated node ids back onto the claim. */
export function bindClaimNodes(claim: ClaimFlagState, nodes: HarvestNode[]) {
  claim.nodeIds = nodes.map((n) => n.id);
}
