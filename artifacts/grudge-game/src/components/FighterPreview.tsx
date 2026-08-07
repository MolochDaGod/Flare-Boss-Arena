import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import {
  createFrameTimer,
  createGltfLoader,
  disposeRenderer,
  ensureMeshoptReady,
  bindKtx2,
} from "@/game/threeSetup";
import { getSkin, skinUrl, SKIN_CLIP_SUFFIX } from "@/data/skins";
import { disposeObject3D } from "@/game/kaykitHero";
import { RACALVIN_ID, SCOURGE_ID, JOHN_WAYNE_ID } from "@/data/fighters";
import {
  RACALVIN_BASE_URL,
  RACALVIN_ANIMS,
  applyRacalvinAssetTuning,
  attachRacalvinWeapons,
  getRacalvinWeapons,
  loadRacalvinClips,
  refreshRacalvinWeaponMounts,
} from "@/game/racalvinHero";
import {
  isCrewFighterId,
  loadCrewHero,
  type CrewId,
  SCOURGE_ANIMS,
  JOHN_ANIMS,
  getScourgeChain,
  syncScourgeWeaponForClip,
  CREW_SHOWCASE_CYCLE,
  pickCrewPreviewStandClip,
} from "@/game/crewHeroes";
import { getFighterAssetTuning, type FighterAssetTuning } from "@/data/fighterAssetTuning";
import { collectMeshNames, setupFighterMeshVisibility, syncHiddenMeshesForClip } from "@/game/assetVisibility";
import { sampleClipPose } from "@/game/assets";
import { isAnnihilateHeroId, parseAnnihilateHeroId } from "@/data/annihilateHeroes";

export type RacalvinWeaponPreview = "swordHeld" | "swordRest" | "pistol";

export interface FighterPreviewHandle {
  previewClip: (name: string) => void;
  setWeaponPreview: (mode: RacalvinWeaponPreview) => void;
  /** Stop clips and snap skeleton to bind pose for weapon placement. */
  freezeToBindPose: () => void;
  /** Resume idle loop after placement. */
  resumeAnimation: () => void;
}

export interface FighterPreviewProps {
  skinId: string;
  /** Defaults to `skinId` when omitted (home/units roster cards). */
  fighterId?: string;
  /** Defaults to persisted tuning for `fighterId` when omitted. */
  tuning?: FighterAssetTuning;
  pauseRotation?: boolean;
  /** When true, animations stop and the rig holds bind pose (T-pose). */
  freezePose?: boolean;
  /**
   * Cycle idle → walk → run → attack for roster cards (crew looks alive on /units).
   * Ignored when freezePose is true.
   */
  showcaseLocomotion?: boolean;
  onMeshesReady?: (names: string[]) => void;
  onClipsReady?: (names: string[]) => void;
  onHandBoneReady?: (boneName: string | null) => void;
}

/**
 * Rotating 3D portrait for Choose Fighter. Supports live weapon placement and
 * mesh visibility rules from the cog Asset Tuner panel.
 */
export const FighterPreview = forwardRef<FighterPreviewHandle, FighterPreviewProps>(function FighterPreview(
  {
    skinId,
    fighterId: fighterIdProp,
    tuning: tuningProp,
    pauseRotation = false,
    freezePose = false,
    showcaseLocomotion = false,
    onMeshesReady,
    onClipsReady,
    onHandBoneReady,
  },
  ref,
) {
  const fighterId = fighterIdProp ?? skinId;
  const tuning = tuningProp ?? getFighterAssetTuning(fighterId);
  const mountRef = useRef<HTMLDivElement>(null);
  const pauseRotationRef = useRef(pauseRotation);
  const freezePoseRef = useRef(freezePose);
  const showcaseRef = useRef(showcaseLocomotion);
  const sceneRef = useRef<{
    model: THREE.Object3D | null;
    mixer: THREE.AnimationMixer | null;
    clips: THREE.AnimationClip[];
    activeAction: THREE.AnimationAction | null;
    showcaseTimer: number;
    showcaseIdx: number;
  }>({ model: null, mixer: null, clips: [], activeAction: null, showcaseTimer: 0, showcaseIdx: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pauseRotationRef.current = pauseRotation;
  }, [pauseRotation]);

  useEffect(() => {
    freezePoseRef.current = freezePose;
  }, [freezePose]);

  useEffect(() => {
    showcaseRef.current = showcaseLocomotion;
  }, [showcaseLocomotion]);

  const snapBindPose = () => {
    const s = sceneRef.current;
    if (!s.model || !s.mixer || !s.clips.length) return;
    // Crew: stand pose from walk/attack (not get-up idle packs)
    const idle =
      isCrewFighterId(fighterId) || isCrewFighterId(skinId)
        ? pickCrewPreviewStandClip(s.clips)
        : (s.clips.find((c) => c.name === "idle") ?? s.clips[0]);
    if (!idle) return;
    s.activeAction = sampleClipPose(s.model, s.mixer, idle);
    if (fighterId === RACALVIN_ID) {
      applyRacalvinAssetTuning(s.model, tuning);
      refreshRacalvinWeaponMounts(s.model);
    }
  };

  const playClipNamed = (name: string, loop: boolean) => {
    const s = sceneRef.current;
    if (!s.mixer || !s.model || !s.clips.length) return;
    const clip =
      s.clips.find((c) => c.name === name) ??
      s.clips.find((c) => c.name.toLowerCase().includes(name.toLowerCase())) ??
      (isCrewFighterId(fighterId) || isCrewFighterId(skinId)
        ? pickCrewPreviewStandClip(s.clips)
        : s.clips.find((c) => c.name === "idle")) ??
      s.clips[0];
    if (!clip) return;
    s.activeAction?.fadeOut(0.18);
    const action = s.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.fadeIn(0.18).play();
    s.activeAction = action;
    syncHiddenMeshesForClip(s.model, clip.name);
    if (isCrewFighterId(fighterId) || isCrewFighterId(skinId)) {
      syncScourgeWeaponForClip(s.model, clip.name);
    }
  };

  const playIdle = () => {
    // Scourge / Cap'n John: standing walk (or attack), never get-up "idle"
    if (isCrewFighterId(fighterId) || isCrewFighterId(skinId)) {
      const s = sceneRef.current;
      const stand = pickCrewPreviewStandClip(s.clips);
      if (stand) {
        playClipNamed(stand.name, true);
        return;
      }
    }
    playClipNamed("idle", true);
  };

  useEffect(() => {
    if (freezePose) snapBindPose();
    else playIdle();
  }, [freezePose]);

  useImperativeHandle(ref, () => ({
    previewClip(name: string) {
      const s = sceneRef.current;
      if (!s.mixer || !s.model || freezePoseRef.current) return;
      const clip = s.clips.find((c) => c.name === name) ?? s.clips[0];
      if (!clip) return;
      s.activeAction?.fadeOut(0.15);
      const action = s.mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
      s.activeAction = action;
      syncHiddenMeshesForClip(s.model, name);
    },
    setWeaponPreview(mode: RacalvinWeaponPreview) {
      const rig = sceneRef.current.model ? getRacalvinWeapons(sceneRef.current.model) : null;
      if (!rig) return;
      if (mode === "pistol") {
        rig.setMode("pistol");
        return;
      }
      rig.setMode("sword");
      rig.setSwordPose(mode === "swordHeld" ? "held" : "rest");
      refreshRacalvinWeaponMounts(sceneRef.current.model!);
    },
    freezeToBindPose: snapBindPose,
    resumeAnimation: playIdle,
  }));

  // Live tuning updates without reloading the GLB.
  useEffect(() => {
    const model = sceneRef.current.model;
    if (!model) return;
    if (fighterId === RACALVIN_ID) {
      applyRacalvinAssetTuning(model, tuning);
    } else if (isAnnihilateHeroId(fighterId) || isAnnihilateHeroId(skinId)) {
      // Warlords Toon RTS ★ — exclusive equip is applied in Grudge6Factory;
      // do NOT run KayKit deferred-weapon hide (would blank swords/axes at idle).
      return;
    } else {
      const active = sceneRef.current.activeAction?.getClip().name;
      setupFighterMeshVisibility(model, fighterId, tuning.hiddenMeshes, active);
    }
  }, [tuning, fighterId, skinId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);

    const w = Math.max(mount.clientWidth, 1);
    const h = Math.max(mount.clientHeight, 1);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    const lookAt = new THREE.Vector3(0, 1.0, 0);
    let orbitRadius = 4.8;
    let orbitYaw = 0;
    let orbitPitch = 0.12;

    const applyOrbit = () => {
      const cp = Math.cos(orbitPitch);
      camera.position.set(
        Math.sin(orbitYaw) * cp * orbitRadius,
        lookAt.y + Math.sin(orbitPitch) * orbitRadius,
        Math.cos(orbitYaw) * cp * orbitRadius,
      );
      camera.lookAt(lookAt);
    };

    const fitCamera = (nw: number, nh: number) => {
      const aspect = nw / nh;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      if (aspect > 1.15) {
        orbitRadius = 5.4;
        lookAt.set(0, 0.92, 0);
        orbitPitch = 0.08;
      } else {
        orbitRadius = 4.6;
        lookAt.set(0, 1.05, 0);
        orbitPitch = 0.12;
      }
      applyOrbit();
    };
    fitCamera(w, h);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (!pauseRotationRef.current) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || !pauseRotationRef.current) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      orbitYaw -= dx * 0.008;
      orbitPitch = Math.max(-0.6, Math.min(0.85, orbitPitch + dy * 0.006));
      applyOrbit();
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.5);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc5a059, 1.1);
    rim.position.set(-3, 2.5, -2);
    scene.add(rim);

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let clips: THREE.AnimationClip[] = [];
    let disposed = false;
    const timer = createFrameTimer();
    timer.connect(document);
    bindKtx2(renderer);
    const loader = createGltfLoader({ renderer });

    sceneRef.current = {
      model: null,
      mixer: null,
      clips: [],
      activeAction: null,
      showcaseTimer: 0,
      showcaseIdx: 0,
    };

    const fitAndMount = (m: THREE.Object3D, targetH = 2.1) => {
      // Prefer feet-origin groups from loadCrewHero / racalvin fit wrappers
      const box = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      if (size.y > 0.001 && Math.abs(size.y - targetH) > 0.15) {
        const scale = targetH / size.y;
        m.scale.multiplyScalar(scale);
        m.updateWorldMatrix(true, true);
        const b2 = new THREE.Box3().setFromObject(m);
        const c2 = new THREE.Vector3();
        b2.getCenter(c2);
        m.position.x -= c2.x;
        m.position.z -= c2.z;
        m.position.y -= b2.min.y;
      }
      scene.add(m);
      model = m;
      sceneRef.current.model = m;
      onMeshesReady?.(collectMeshNames(m));
    };

    const playIdleFrom = (m: THREE.Object3D, loaded: THREE.AnimationClip[], names: string[]) => {
      clips = loaded;
      sceneRef.current.clips = loaded;
      onClipsReady?.(names);
      if (!mixer) {
        mixer = new THREE.AnimationMixer(m);
        sceneRef.current.mixer = mixer;
      } else {
        // Progressive pack update — keep mixer, refresh clip list
        sceneRef.current.mixer = mixer;
      }
      if (freezePoseRef.current) {
        const idleClip =
          isCrewFighterId(fighterId) || isCrewFighterId(skinId)
            ? pickCrewPreviewStandClip(loaded)
            : (loaded.find((c) => c.name === "idle") ?? loaded[0]);
        if (idleClip && mixer) {
          activeAction = sampleClipPose(m, mixer, idleClip);
          sceneRef.current.activeAction = activeAction;
        }
        return;
      }
      // Crew: walk/run/attack first — Meshy idle packs are get-up recoveries
      const idle =
        isCrewFighterId(fighterId) || isCrewFighterId(skinId)
          ? pickCrewPreviewStandClip(loaded)
          : (loaded.find((c) => c.name === "idle") ??
            loaded.find((c) => c.name === "walk") ??
            loaded[0]);
      if (idle) {
        activeAction?.fadeOut(0.12);
        activeAction = mixer!
          .clipAction(idle)
          .reset()
          .setLoop(THREE.LoopRepeat, Infinity)
          .fadeIn(0.2)
          .play();
        sceneRef.current.activeAction = activeAction;
        syncHiddenMeshesForClip(m, idle.name);
        syncScourgeWeaponForClip(m, idle.name);
        // Start showcase cycle timer for roster portraits
        sceneRef.current.showcaseIdx = 0;
        sceneRef.current.showcaseTimer = 0;
      }
    };

    // ── Racalvin crew (Scourge / Captain John Wayne) — models/crew/* base.glb ──
    // Meshopt WASM must be ready or EXT_meshopt_compression loads fail → "Preview unavailable"
    if (isCrewFighterId(skinId) || isCrewFighterId(fighterId)) {
      const crew = (isCrewFighterId(skinId) ? skinId : fighterId) as CrewId;
      void ensureMeshoptReady().then(() => {
        if (disposed) return;
        // Viewport: SI ~2.0 m — attack-first stand (weapon flair), not get-up idle
        loadCrewHero(
          loader,
          crew,
          2.0,
          (wrapper, root, loadedClips) => {
            if (disposed) {
              disposeObject3D(wrapper);
              return;
            }
            // loadCrewHero already feet-fit; only add to scene (no double scale)
            scene.add(wrapper);
            model = wrapper;
            sceneRef.current.model = wrapper;
            onMeshesReady?.(collectMeshNames(wrapper));
            const names =
              crew === SCOURGE_ID
                ? [...SCOURGE_ANIMS]
                : crew === JOHN_WAYNE_ID
                  ? [...JOHN_ANIMS]
                  : loadedClips.map((c) => c.name);
            playIdleFrom(wrapper, loadedClips, names);
            const chain = getScourgeChain(wrapper) ?? getScourgeChain(root);
            if (chain) {
              onHandBoneReady?.("RightHand (chain+anchor)");
            } else {
              onHandBoneReady?.(null);
            }
          },
          () => {
            if (!disposed) setFailed(true);
          },
          {
            viewportFirst: true,
            onClipsUpdated: (all) => {
              if (disposed || !model) return;
              clips = all;
              sceneRef.current.clips = all;
              const names =
                crew === SCOURGE_ID
                  ? [...SCOURGE_ANIMS]
                  : crew === JOHN_WAYNE_ID
                    ? [...JOHN_ANIMS]
                    : all.map((c) => c.name);
              onClipsReady?.(names);
              // Prefer attack/run once full pack is in — never force get-up idle
              const stand = pickCrewPreviewStandClip(all);
              if (stand && mixer && !freezePoseRef.current) {
                const cur = sceneRef.current.activeAction?.getClip().name;
                const standing = new Set(
                  ["walk", "run", "attack", "slash", "combo"].map((n) => n.toLowerCase()),
                );
                if (!cur || !standing.has(cur.toLowerCase()) || cur === "getup") {
                  activeAction?.fadeOut(0.15);
                  activeAction = mixer
                    .clipAction(stand)
                    .reset()
                    .setLoop(THREE.LoopRepeat, Infinity)
                    .fadeIn(0.2)
                    .play();
                  sceneRef.current.activeAction = activeAction;
                  syncScourgeWeaponForClip(model, stand.name);
                }
              }
            },
          },
        );
      });
    } else if (isAnnihilateHeroId(skinId) || isAnnihilateHeroId(fighterId)) {
      // Warlords Toon RTS ★ — Grudge6Factory → raceGlbUrlCandidates (toon-rts CDN first)
      const g6 =
        parseAnnihilateHeroId(skinId) ?? parseAnnihilateHeroId(fighterId);
      if (!g6) {
        setFailed(true);
      } else {
        void Promise.all([
          import("@/game/grudge6/Grudge6Character"),
          import("@/data/grudge6Assets"),
        ]).then(([{ Grudge6Factory }, { targetHeightForRace, raceGlbUrl }]) => {
          if (disposed) return;
          const factory = new Grudge6Factory();
          const playUrl = raceGlbUrl(g6.race);
          factory
            .createPlayer({
              race: g6.race,
              classId: g6.classId,
              displayName: fighterId,
              height: targetHeightForRace(g6.race),
            })
            .then((inst) => {
              if (disposed) {
                inst.dispose();
                return;
              }
              // Record file system path for UI/debug
              inst.group.userData.playMeshUrl = inst.debug?.glbUrl || playUrl;
              inst.group.userData.playMesh = "toon-rts";
              scene.add(inst.group);
              model = inst.group;
              sceneRef.current.model = inst.group;
              onMeshesReady?.(
                collectMeshNames(inst.group).concat([
                  `[toon] ${String(inst.debug?.glbUrl || playUrl).split("/").pop()}`,
                  `[vis] ${(inst.debug?.visibleMeshes ?? []).slice(0, 8).join(",")}`,
                  `[anim] ${inst.debug?.animSource ?? "?"} bones=${inst.debug?.boneCount ?? 0}`,
                ]),
              );
              if (import.meta.env.DEV || inst.debug?.errors?.length) {
                console.info("[FighterPreview] g6", g6, inst.debug);
              }
              onHandBoneReady?.(null);
              const anim = inst.animator;
              if (anim) {
                anim.setMoving?.(false);
                anim.setGaitFromSpeed?.(0, false);
                anim.update(1 / 30);
                (
                  inst.group as THREE.Object3D & { userData: Record<string, unknown> }
                ).userData.g6Dispose = () => inst.dispose();
              }
              const clips =
                inst.debug.clipNames.length > 0
                  ? inst.debug.clipNames
                  : ["idle", "walk", "run", "attack"];
              onClipsReady?.(clips);
              (inst.group as THREE.Object3D).userData.g6Animator = anim;
              // Slow rotate showcase gait
              if (showcaseRef.current && anim?.setGaitFromSpeed) {
                let t = 0;
                const gaitTick = () => {
                  if (disposed || freezePoseRef.current) return;
                  t += 1 / 60;
                  const phase = Math.floor(t / 3) % 3;
                  if (phase === 0) anim.setGaitFromSpeed?.(0, false);
                  else if (phase === 1) anim.setGaitFromSpeed?.(0.45, false);
                  else anim.setGaitFromSpeed?.(0.9, true);
                };
                (inst.group as THREE.Object3D).userData.g6GaitTick = gaitTick;
              }
            })
            .catch((err) => {
              console.error("[FighterPreview] Toon RTS load failed", g6, playUrl, err);
              if (!disposed) setFailed(true);
            });
        });
      }
    } else {
      const def = getSkin(skinId);
      const url = skinId === RACALVIN_ID ? RACALVIN_BASE_URL() : def ? skinUrl(def) : null;
      if (!url) {
        // Unknown skinId — fail closed so UI shows "Preview unavailable"
        setFailed(true);
      } else {
        loader.load(
          url,
          (gltf) => {
            if (disposed) {
              disposeObject3D(gltf.scene);
              return;
            }
            const m = gltf.scene;
            fitAndMount(m, 2.1);

            if (skinId === RACALVIN_ID) {
              attachRacalvinWeapons(m, loader, { tuning, isDisposed: () => disposed });
              onHandBoneReady?.(
                (m.userData.racalvinHandBone as string | undefined) ?? null,
              );
              loadRacalvinClips(loader).then((loaded) => {
                if (disposed) return;
                playIdleFrom(m, loaded, [...RACALVIN_ANIMS]);
                if (freezePoseRef.current) refreshRacalvinWeaponMounts(m);
              });
            } else if (gltf.animations.length) {
              clips = gltf.animations;
              sceneRef.current.clips = clips;
              const clipNames = clips.map((c) => c.name);
              onClipsReady?.(clipNames);
              mixer = new THREE.AnimationMixer(m);
              sceneRef.current.mixer = mixer;
              const idle =
                gltf.animations.find((a) =>
                  SKIN_CLIP_SUFFIX.idle.some((suf) => a.name.toLowerCase().endsWith(suf)),
                ) ?? gltf.animations[0];
              if (idle) {
                activeAction = mixer.clipAction(idle).reset().play();
                sceneRef.current.activeAction = activeAction;
                setupFighterMeshVisibility(m, fighterId, tuning.hiddenMeshes, idle.name);
              }
            } else {
              onClipsReady?.([]);
              setupFighterMeshVisibility(m, fighterId, tuning.hiddenMeshes);
            }
          },
          undefined,
          () => {
            if (!disposed) setFailed(true);
          },
        );
      }
    }

    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      timer.update();
      const d = timer.getDelta();
      if (!freezePoseRef.current) {
        mixer?.update(d);
        // Warlords Toon RTS animator (preview path)
        const g6Tick = model?.userData?.g6GaitTick as (() => void) | undefined;
        try {
          g6Tick?.();
        } catch {
          /* */
        }
        const g6a = model?.userData?.g6Animator as
          | { update?: (dt: number) => void; setMoving?: (m: boolean) => void }
          | undefined;
        g6a?.update?.(d);
        // Roster showcase: idle → walk → run → one-shot attack → idle
        if (
          showcaseRef.current &&
          mixer &&
          sceneRef.current.clips.length > 0 &&
          (isCrewFighterId(skinId) || isCrewFighterId(fighterId))
        ) {
          const s = sceneRef.current;
          s.showcaseTimer += d;
          const step = CREW_SHOWCASE_CYCLE[s.showcaseIdx % CREW_SHOWCASE_CYCLE.length]!;
          const hold = step.seconds > 0 ? step.seconds : Math.max(0.9, (s.activeAction?.getClip().duration ?? 1.2) * 0.92);
          if (s.showcaseTimer >= hold) {
            s.showcaseTimer = 0;
            s.showcaseIdx = (s.showcaseIdx + 1) % CREW_SHOWCASE_CYCLE.length;
            const next = CREW_SHOWCASE_CYCLE[s.showcaseIdx]!;
            // Loop attack/run/walk; one-shots only for true non-loco clips
            const loop = /^(idle|walk|run|attack|slash|combo)$/i.test(next.name);
            // Inline play — fall back to attack/run, never get-up-only idle
            const clip =
              s.clips.find((c) => c.name === next.name) ??
              pickCrewPreviewStandClip(s.clips) ??
              s.clips[0];
            if (clip && mixer) {
              s.activeAction?.fadeOut(0.16);
              const action = mixer.clipAction(clip);
              action.reset();
              action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
              action.clampWhenFinished = !loop;
              action.fadeIn(0.16).play();
              s.activeAction = action;
              activeAction = action;
              if (model) {
                syncHiddenMeshesForClip(model, clip.name);
                syncScourgeWeaponForClip(model, clip.name);
              }
            }
          }
        }
      }
      // Scourge chain + Minecraft Idol weapon tumble (idle throw/spin/catch)
      if (model) {
        const chain = getScourgeChain(model);
        chain?.update(d, !freezePoseRef.current);
      }
      // Soft auto-orbit on units even when drag-orbit enabled — keeps cards lively
      if (model) {
        if (!pauseRotationRef.current) model.rotation.y += d * 0.5;
        else if (showcaseRef.current) model.rotation.y += d * 0.18;
      }
      renderer.render(scene, camera);
    };
    render();

    const onResize = () => {
      const nw = Math.max(mount.clientWidth, 1);
      const nh = Math.max(mount.clientHeight, 1);
      renderer.setSize(nw, nh);
      fitCamera(nw, nh);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      mixer?.stopAllAction();
      if (model) {
        const g6d = model.userData?.g6Dispose as (() => void) | undefined;
        g6d?.();
        scene.remove(model);
        disposeObject3D(model);
      }
      sceneRef.current = {
        model: null,
        mixer: null,
        clips: [],
        activeAction: null,
        showcaseTimer: 0,
        showcaseIdx: 0,
      };
      timer.disconnect();
      disposeRenderer(renderer);
    };
  }, [skinId, fighterId]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="font-serif text-xs uppercase tracking-widest text-muted-foreground">
          Preview unavailable
        </p>
      </div>
    );
  }
  return <div ref={mountRef} className="h-full w-full" />;
});