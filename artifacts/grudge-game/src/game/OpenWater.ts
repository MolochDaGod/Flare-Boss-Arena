/**
 * Open-water pilot mode — ocean + player skiff + crew deck slots.
 *
 * Patterns inspired by three-sails (sum-of-sines water, boat pitch/roll) and
 * bythelee (boat state), implemented natively for our Vite/Three stack.
 * Uses existing public/models/pirates/world/Ship_*.gltf assets at human scale.
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGLTFCached } from "./assets";
import type { ArchipelagoChart, ArchipelagoIsland } from "../data/archipelago";
import { nearestLandableIsland } from "../data/archipelago";

const MODELS = `${import.meta.env.BASE_URL}models/pirates`;

export type PlayDomain = "land" | "open_water";

export interface OpenWaterOpts {
  seaHalfExtent: number;
  chart: ArchipelagoChart;
  embarkWorld: THREE.Vector3;
  /** Target boat length in meters (~ skiff). */
  boatLength?: number;
}

export interface OpenWaterHandle {
  group: THREE.Group;
  boat: THREE.Group;
  domain: PlayDomain;
  /** Boat helm position (world). */
  boatPos: THREE.Vector3;
  heading: number;
  speed: number;
  crewSlots: THREE.Vector3[];
  chart: ArchipelagoChart;
  embark: () => void;
  disembark: (landPos: THREE.Vector3) => void;
  update: (
    delta: number,
    keys: Set<string>,
    opts: { canPilot: boolean },
  ) => void;
  sampleWaveY: (x: number, z: number, t: number) => number;
  nearestIsland: (maxDist?: number) => ArchipelagoIsland | null;
  setChart: (chart: ArchipelagoChart) => void;
  dispose: () => void;
}

function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x0a2a3a) },
      uColorShallow: { value: new THREE.Color(0x1a6a7a) },
      uOpacity: { value: 0.88 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      // Sum-of-sines (three-sails style, simplified)
      float wave(vec2 p) {
        float t = uTime;
        float h = 0.0;
        h += sin(p.x * 0.08 + t * 1.1) * 0.35;
        h += sin(p.y * 0.11 - t * 0.9) * 0.28;
        h += sin((p.x + p.y) * 0.06 + t * 0.7) * 0.22;
        h += sin(p.x * 0.22 - p.y * 0.15 + t * 1.6) * 0.08;
        return h;
      }
      void main() {
        vUv = uv;
        vec3 pos = position;
        vWave = wave(pos.xz);
        pos.y += vWave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float foam = smoothstep(0.25, 0.55, vWave);
        vec3 col = mix(uColorDeep, uColorShallow, 0.45 + vWave * 0.35);
        col = mix(col, vec3(0.75, 0.9, 0.95), foam * 0.25);
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });
}

function fitBoatLength(root: THREE.Object3D, targetLen: number) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const foot = Math.max(size.x, size.z, 0.1);
  root.scale.multiplyScalar(targetLen / foot);
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
  // Center XZ under holder
  const c = new THREE.Vector3();
  b2.getCenter(c);
  root.position.x -= c.x - root.position.x;
  root.position.z -= c.z - root.position.z;
}

/**
 * Create open-water systems. Ocean sits under/around the island; boat docks at embarkWorld.
 */
export function createOpenWater(
  scene: THREE.Scene,
  loader: GLTFLoader,
  opts: OpenWaterOpts,
): OpenWaterHandle {
  const group = new THREE.Group();
  group.name = "OpenWater";
  scene.add(group);

  const sea = opts.seaHalfExtent;
  const waterMat = waterMaterial();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(sea * 2.4, sea * 2.4, 96, 96),
    waterMat,
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.35;
  ocean.receiveShadow = true;
  ocean.name = "ocean_plane";
  ocean.userData.dynamic = true; // wave anim — do not freeze bake
  group.add(ocean);

  // Horizon fog ring (simple dark skirt)
  const skirt = new THREE.Mesh(
    new THREE.RingGeometry(sea * 0.95, sea * 1.35, 64),
    new THREE.MeshBasicMaterial({
      color: 0x061018,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -0.2;
  group.add(skirt);

  const boat = new THREE.Group();
  boat.name = "PlayerSkiff";
  boat.position.copy(opts.embarkWorld);
  boat.position.y = 0;
  group.add(boat);

  const boatLength = opts.boatLength ?? 8.5;
  const hullPlaceholder = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.6, boatLength * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.85 }),
  );
  hullPlaceholder.position.y = 0.35;
  boat.add(hullPlaceholder);

  void loadGLTFCached(loader, `${MODELS}/world/Ship_Small.gltf`).then((gltf) => {
    if (group.userData.disposed) return;
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    fitBoatLength(root, boatLength);
    boat.remove(hullPlaceholder);
    hullPlaceholder.geometry.dispose();
    (hullPlaceholder.material as THREE.Material).dispose();
    boat.add(root);
  });

  // Island chart markers (distant buoys)
  const markers = new THREE.Group();
  markers.name = "ArchipelagoMarkers";
  group.add(markers);

  const rebuildMarkers = (chart: ArchipelagoChart) => {
    while (markers.children.length) {
      const c = markers.children.pop()!;
      markers.remove(c);
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose?.();
      }
    }
    for (const isle of chart.islands) {
      if (isle.isHome) continue;
      const buoy = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 4.5, 5),
        new THREE.MeshStandardMaterial({
          color: isle.color,
          emissive: isle.color,
          emissiveIntensity: 0.35,
          roughness: 0.6,
        }),
      );
      buoy.position.set(isle.x, 2.2, isle.z);
      buoy.userData.islandId = isle.id;
      markers.add(buoy);
      // Soft ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(isle.radius * 0.9, isle.radius, 32),
        new THREE.MeshBasicMaterial({
          color: isle.color,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(isle.x, 0.15, isle.z);
      markers.add(ring);
    }
  };
  rebuildMarkers(opts.chart);

  // Crew deck slots relative to boat local space
  const crewLocal = [
    new THREE.Vector3(-0.8, 1.1, 0.6),
    new THREE.Vector3(0.8, 1.1, 0.6),
    new THREE.Vector3(0, 1.1, -1.2),
  ];

  let domain: PlayDomain = "land";
  let heading = Math.PI * 0.15;
  let speed = 0;
  const boatPos = opts.embarkWorld.clone();
  let chart = opts.chart;
  const embarkHome = opts.embarkWorld.clone();

  const sampleWaveY = (x: number, z: number, t: number) => {
    let h = 0;
    h += Math.sin(x * 0.08 + t * 1.1) * 0.35;
    h += Math.sin(z * 0.11 - t * 0.9) * 0.28;
    h += Math.sin((x + z) * 0.06 + t * 0.7) * 0.22;
    return h * 0.35;
  };

  const handle: OpenWaterHandle = {
    group,
    boat,
    get domain() {
      return domain;
    },
    boatPos,
    get heading() {
      return heading;
    },
    get speed() {
      return speed;
    },
    get crewSlots() {
      return crewLocal.map((l) => {
        const w = l.clone();
        w.applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
        w.add(boatPos);
        w.y = 1.1 + sampleWaveY(boatPos.x, boatPos.z, performance.now() / 1000);
        return w;
      });
    },
    get chart() {
      return chart;
    },
    embark: () => {
      domain = "open_water";
      boat.visible = true;
      speed = 0;
    },
    disembark: (landPos) => {
      domain = "land";
      speed = 0;
      boatPos.copy(landPos);
      boat.position.copy(landPos);
      boat.position.y = sampleWaveY(landPos.x, landPos.z, performance.now() / 1000) * 0.2;
    },
    sampleWaveY,
    nearestIsland: (maxDist = 28) =>
      nearestLandableIsland(chart, boatPos.x, boatPos.z, maxDist),
    setChart: (c) => {
      chart = c;
      rebuildMarkers(c);
    },
    update: (delta, keys, { canPilot }) => {
      const t = performance.now() / 1000;
      waterMat.uniforms.uTime!.value = t;

      if (domain !== "open_water" || !canPilot) {
        // Idle dock bob
        const y = sampleWaveY(boatPos.x, boatPos.z, t) * 0.25;
        boat.position.set(boatPos.x, y, boatPos.z);
        boat.rotation.y = heading;
        boat.rotation.x = Math.sin(t * 1.2) * 0.02;
        boat.rotation.z = Math.cos(t * 0.9) * 0.03;
        return;
      }

      // Helm — arcade sail (patterns from three-sails / boat demos, not full sim)
      const turn = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
      const thrust = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 0.45 : 0);

      heading += turn * 1.35 * delta;
      const targetSpeed = thrust * 14;
      speed += (targetSpeed - speed) * Math.min(1, delta * 1.8);

      boatPos.x += Math.sin(heading) * speed * delta;
      boatPos.z += Math.cos(heading) * speed * delta;

      // Soft sea bounds
      const lim = chart.seaHalfExtent - 8;
      boatPos.x = Math.max(-lim, Math.min(lim, boatPos.x));
      boatPos.z = Math.max(-lim, Math.min(lim, boatPos.z));

      const wave = sampleWaveY(boatPos.x, boatPos.z, t);
      boat.position.set(boatPos.x, wave * 0.4, boatPos.z);
      boat.rotation.y = heading;
      // Pitch/roll from wave gradient (three-sails vibe)
      const gx =
        sampleWaveY(boatPos.x + 1, boatPos.z, t) - sampleWaveY(boatPos.x - 1, boatPos.z, t);
      const gz =
        sampleWaveY(boatPos.x, boatPos.z + 1, t) - sampleWaveY(boatPos.x, boatPos.z - 1, t);
      boat.rotation.x = THREE.MathUtils.clamp(-gz * 0.15, -0.12, 0.12);
      boat.rotation.z = THREE.MathUtils.clamp(gx * 0.12, -0.14, 0.14);
    },
    dispose: () => {
      group.userData.disposed = true;
      scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) mat.dispose();
      });
      void embarkHome;
    },
  };

  return handle;
}
