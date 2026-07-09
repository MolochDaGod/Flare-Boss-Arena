import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSkin, skinUrl, SKIN_CLIP_SUFFIX } from "@/data/skins";
import { disposeObject3D } from "@/game/kaykitHero";
import { RACALVIN_ID } from "@/data/fighters";
import {
  RACALVIN_BASE_URL,
  RACALVIN_ANIMS,
  applyRacalvinAssetTuning,
  attachRacalvinWeapons,
  getRacalvinWeapons,
  loadRacalvinClips,
} from "@/game/racalvinHero";
import { getFighterAssetTuning, type FighterAssetTuning } from "@/data/fighterAssetTuning";
import { collectMeshNames, setupFighterMeshVisibility, syncHiddenMeshesForClip } from "@/game/assetVisibility";

export interface FighterPreviewHandle {
  previewClip: (name: string) => void;
  setWeaponPreview: (mode: "sword" | "pistol") => void;
}

export interface FighterPreviewProps {
  skinId: string;
  /** Defaults to `skinId` when omitted (home/units roster cards). */
  fighterId?: string;
  /** Defaults to persisted tuning for `fighterId` when omitted. */
  tuning?: FighterAssetTuning;
  pauseRotation?: boolean;
  onMeshesReady?: (names: string[]) => void;
  onClipsReady?: (names: string[]) => void;
}

/**
 * Rotating 3D portrait for Choose Fighter. Supports live weapon placement and
 * mesh visibility rules from the cog Asset Tuner panel.
 */
export const FighterPreview = forwardRef<FighterPreviewHandle, FighterPreviewProps>(function FighterPreview(
  { skinId, fighterId: fighterIdProp, tuning: tuningProp, pauseRotation = false, onMeshesReady, onClipsReady },
  ref,
) {
  const fighterId = fighterIdProp ?? skinId;
  const tuning = tuningProp ?? getFighterAssetTuning(fighterId);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    model: THREE.Object3D | null;
    mixer: THREE.AnimationMixer | null;
    clips: THREE.AnimationClip[];
    activeAction: THREE.AnimationAction | null;
  }>({ model: null, mixer: null, clips: [], activeAction: null });
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    previewClip(name: string) {
      const s = sceneRef.current;
      if (!s.mixer || !s.model) return;
      const clip = s.clips.find((c) => c.name === name) ?? s.clips[0];
      if (!clip) return;
      s.activeAction?.fadeOut(0.15);
      const action = s.mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
      s.activeAction = action;
      syncHiddenMeshesForClip(s.model, name);
    },
    setWeaponPreview(mode: "sword" | "pistol") {
      const rig = sceneRef.current.model ? getRacalvinWeapons(sceneRef.current.model) : null;
      rig?.setMode(mode);
    },
  }));

  // Live tuning updates without reloading the GLB.
  useEffect(() => {
    const model = sceneRef.current.model;
    if (!model) return;
    if (fighterId === RACALVIN_ID) {
      applyRacalvinAssetTuning(model, tuning);
    } else {
      const active = sceneRef.current.activeAction?.getClip().name;
      setupFighterMeshVisibility(model, fighterId, tuning.hiddenMeshes, active);
    }
  }, [tuning, fighterId]);

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
    const fitCamera = (nw: number, nh: number) => {
      const aspect = nw / nh;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      if (aspect > 1.15) {
        camera.position.set(0, 1.05, 5.4);
        camera.lookAt(0, 0.92, 0);
      } else {
        camera.position.set(0, 1.25, 4.6);
        camera.lookAt(0, 1.05, 0);
      }
    };
    fitCamera(w, h);

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
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();

    sceneRef.current = { model: null, mixer: null, clips: [], activeAction: null };

    const def = getSkin(skinId);
    const url = skinId === RACALVIN_ID ? RACALVIN_BASE_URL() : def ? skinUrl(def) : null;
    if (url) {
      loader.load(
        url,
        (gltf) => {
          if (disposed) {
            disposeObject3D(gltf.scene);
            return;
          }
          const m = gltf.scene;
          const box = new THREE.Box3().setFromObject(m);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const target = 2.1;
          const scale = size.y > 0.001 ? target / size.y : 1;
          m.scale.setScalar(scale);
          m.position.x = -center.x * scale;
          m.position.z = -center.z * scale;
          m.position.y = -box.min.y * scale;
          scene.add(m);
          model = m;
          sceneRef.current.model = m;

          onMeshesReady?.(collectMeshNames(m));

          if (skinId === RACALVIN_ID) {
            attachRacalvinWeapons(m, loader, { tuning, isDisposed: () => disposed });
            mixer = new THREE.AnimationMixer(m);
            loadRacalvinClips(loader).then((loaded) => {
              if (disposed || !mixer) return;
              clips = loaded;
              sceneRef.current.clips = loaded;
              onClipsReady?.([...RACALVIN_ANIMS]);
              const idle = loaded.find((c) => c.name === "idle") ?? loaded[0];
              if (idle) {
                activeAction = mixer.clipAction(idle).reset().play();
                sceneRef.current.activeAction = activeAction;
                syncHiddenMeshesForClip(m, idle.name);
              }
            });
          } else if (gltf.animations.length) {
            clips = gltf.animations;
            sceneRef.current.clips = clips;
            const clipNames = clips.map((c) => c.name);
            onClipsReady?.(clipNames);
            mixer = new THREE.AnimationMixer(m);
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
          sceneRef.current.mixer = mixer;
        },
        undefined,
        () => {
          /* missing model */
        },
      );
    }

    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const d = clock.getDelta();
      mixer?.update(d);
      if (model && !pauseRotation) model.rotation.y += d * 0.5;
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
      mixer?.stopAllAction();
      if (model) {
        scene.remove(model);
        disposeObject3D(model);
      }
      sceneRef.current = { model: null, mixer: null, clips: [], activeAction: null };
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
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