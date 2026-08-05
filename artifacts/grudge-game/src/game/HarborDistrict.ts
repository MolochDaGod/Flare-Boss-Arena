/**
 * Harbor district — bring Camp/city shops + training onto the island at true scale.
 *
 * Maps campTown station layouts into world space near Pirate Cove so the
 * generative island and the remade hub are one continuous place.
 */

import * as THREE from "three";
import {
  CAMP_STATION_LAYOUTS,
  CAMP_BOUNDS,
  type CampStationLayout,
} from "../data/campTown";

/** Harbor footprint relative to cove center — human-scale district, not 5× yard. */
export const HARBOR_DISTRICT_SCALE = 0.42;

export interface HarborStationMarker {
  id: string;
  layout: CampStationLayout;
  world: THREE.Vector3;
  group: THREE.Group;
}

export interface HarborDistrictHandle {
  group: THREE.Group;
  stations: HarborStationMarker[];
  nearest: (x: number, z: number, maxDist?: number) => HarborStationMarker | null;
  dispose: () => void;
}

/**
 * Place shop/training pads around coveCenter. Coordinates from campTown are
 * normalized by CAMP_BOUNDS then scaled into the island harbor ring.
 */
export function buildHarborDistrict(
  scene: THREE.Scene,
  coveCenter: THREE.Vector3,
): HarborDistrictHandle {
  const group = new THREE.Group();
  group.name = "HarborDistrict";
  group.userData.bakeStatic = true;
  scene.add(group);

  const stations: HarborStationMarker[] = [];
  // Offset district slightly inland from jetty (west of ships)
  const origin = new THREE.Vector3(coveCenter.x - 18, 0, coveCenter.z + 8);

  for (const layout of CAMP_STATION_LAYOUTS) {
    // campTown uses ~±CAMP_BOUNDS layout space
    const nx = (layout.x / CAMP_BOUNDS) * 22 * HARBOR_DISTRICT_SCALE * (1 / 0.42);
    const nz = (layout.z / CAMP_BOUNDS) * 22 * HARBOR_DISTRICT_SCALE * (1 / 0.42);
    // Simpler: map layout x,z into ~±14m district
    const wx = origin.x + layout.x * (14 / CAMP_BOUNDS);
    const wz = origin.z + layout.z * (14 / CAMP_BOUNDS);
    void nx;
    void nz;

    const holder = new THREE.Group();
    holder.position.set(wx, 0, wz);
    holder.name = `harbor_${layout.id}`;

    // Pad
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.55, 0.12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x2a2820,
        emissive: layout.color,
        emissiveIntensity: 0.15,
        roughness: 0.9,
      }),
    );
    pad.position.y = 0.06;
    pad.receiveShadow = true;
    holder.add(pad);

    // Column / signpost
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 2.0, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.8 }),
    );
    post.position.y = 1.05;
    post.castShadow = true;
    holder.add(post);

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({
        color: layout.color,
        emissive: layout.color,
        emissiveIntensity: 0.65,
        roughness: 0.4,
      }),
    );
    lamp.position.y = 2.15;
    holder.add(lamp);

    const light = new THREE.PointLight(layout.color, 0.55, 8, 2);
    light.position.y = 2.2;
    holder.add(light);

    // Label sprite
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 8, 256, 48);
    ctx.fillStyle = "#e8d5a3";
    ctx.font = "bold 18px Cinzel, serif";
    ctx.textAlign = "center";
    ctx.fillText(layout.shortLabel.slice(0, 16), 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    spr.position.y = 2.8;
    spr.scale.set(3.2, 0.8, 1);
    holder.add(spr);

    group.add(holder);
    stations.push({
      id: layout.id,
      layout,
      world: new THREE.Vector3(wx, 0, wz),
      group: holder,
    });
  }

  // District ground plate (subtle)
  const plate = new THREE.Mesh(
    new THREE.CircleGeometry(16, 40),
    new THREE.MeshStandardMaterial({
      color: 0x2c281f,
      roughness: 0.95,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(origin.x, 0.04, origin.z);
  plate.receiveShadow = true;
  group.add(plate);

  return {
    group,
    stations,
    nearest: (x, z, maxDist = 3.5) => {
      let best: HarborStationMarker | null = null;
      let bestD = maxDist;
      for (const s of stations) {
        const d = Math.hypot(s.world.x - x, s.world.z - z);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    },
    dispose: () => {
      scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          for (const mat of mats) {
            const sm = mat as THREE.MeshStandardMaterial;
            sm.map?.dispose?.();
            mat.dispose();
          }
        }
        if ((o as THREE.Sprite).isSprite) {
          const s = o as THREE.Sprite;
          (s.material as THREE.SpriteMaterial).map?.dispose();
          s.material.dispose();
        }
      });
    },
  };
}
