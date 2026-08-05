/**
 * Grudge6 field deploy — single entry for loading party allies with the
 * production loader (CDN race GLB + atlas + mesh allow-list + baked anims + AI agent).
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  getPartyAllyIds,
  getGrudge6Hero,
  MAX_PARTY_ALLIES,
  type Grudge6HeroDef,
} from "../../data/grudge6Roster";
import { isGrudge6Owned, getOwnedGrudge6Ids } from "../../data/rosterOwnership";
import { targetHeightForRace } from "../../data/grudge6Assets";
import { createGrudge6Character, Grudge6Factory, type Grudge6Instance } from "./Grudge6Character";
import { createAllyAgent, type AllyAgent } from "./AllyBrain";

export interface DeployResult {
  agents: AllyAgent[];
  errors: string[];
  loaded: string[];
}

/**
 * Resolve which ally ids should spawn: party selection ∩ owned roster.
 * Never invents a default party.
 */
export function resolveDeployIds(): { ids: string[]; skipped: string[] } {
  const party = getPartyAllyIds().slice(0, MAX_PARTY_ALLIES);
  const owned = new Set(getOwnedGrudge6Ids());
  const ids: string[] = [];
  const skipped: string[] = [];
  for (const id of party) {
    if (!getGrudge6Hero(id)) {
      skipped.push(`${id}: unknown`);
      continue;
    }
    if (!owned.has(id) && !isGrudge6Owned(id)) {
      skipped.push(`${id}: not owned`);
      continue;
    }
    ids.push(id);
  }
  return { ids, skipped };
}

/**
 * Load all selected allies into the scene near the player.
 */
export async function deployPartyAllies(opts: {
  factory?: Grudge6Factory;
  loader?: GLTFLoader;
  playerPos: THREE.Vector3;
  scene: THREE.Scene;
  isDisposed?: () => boolean;
  onProgress?: (name: string, ok: boolean, err?: string) => void;
}): Promise<DeployResult> {
  const { ids, skipped } = resolveDeployIds();
  const errors = [...skipped];
  const agents: AllyAgent[] = [];
  const loaded: string[] = [];

  if (!ids.length) {
    return {
      agents,
      errors: errors.length ? errors : ["No party selected — visit /party"],
      loaded,
    };
  }

  const factory = opts.factory ?? new Grudge6Factory();
  let slot = 0;

  for (const id of ids) {
    if (opts.isDisposed?.()) break;
    const def = getGrudge6Hero(id);
    if (!def) continue;
    try {
      const height = targetHeightForRace(def.race);
      const inst: Grudge6Instance = opts.loader
        ? await createGrudge6Character(def, opts.loader, { height })
        : await factory.create(def, height);

      if (opts.isDisposed?.()) {
        inst.dispose();
        break;
      }

      // Ground-scale sanity: factory already fits; ensure group origin at feet
      inst.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(inst.group);
      if (box.min.y !== 0 && Number.isFinite(box.min.y)) {
        inst.group.position.y -= box.min.y;
      }

      const agent = createAllyAgent(inst, slot);
      agent.pos.set(
        opts.playerPos.x + (slot === 0 ? -2.2 : 2.2),
        0,
        opts.playerPos.z + 1.8,
      );
      inst.group.position.copy(agent.pos);
      opts.scene.add(inst.group);
      agents.push(agent);
      loaded.push(def.displayName);
      opts.onProgress?.(def.displayName, true);
      // Log anim source for debugging
      if (inst.debug.animSource === "none") {
        errors.push(`${def.displayName}: no clips (animSource=none)`);
      }
      slot++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${def.displayName}: ${msg}`);
      opts.onProgress?.(def.displayName, false, msg);
    }
  }

  return { agents, errors, loaded };
}

export function describeDeploy(def: Grudge6HeroDef): string {
  return `${def.displayName} [${def.brain}] ${def.race}/${def.role}`;
}
