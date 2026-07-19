import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  createFrameTimer,
  createGltfLoader,
  disposeRenderer,
} from "@/game/threeSetup";

const MODELS_BASE = `${import.meta.env.BASE_URL}models/monsters`;

/** Dispose a material AND every texture it references (material.dispose() alone leaks GPU texture memory). */
function disposeMaterial(mat: THREE.Material) {
  const m = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(m)) {
    const val = m[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
  mat.dispose();
}

/** Release every geometry, material and texture under an object. */
function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else if (mat) disposeMaterial(mat);
  });
}

interface Props {
  /** GLB file name under public/models/monsters/. */
  file: string;
  /** Skeletal clip to loop, or null for static (rig-less) GLBs. */
  clip: string | null;
  /** Rim-light accent (matches the tier colour). */
  accent?: string;
}

/**
 * Self-contained Three.js preview for a single GLB monster. Loads the model
 * fresh (no clone — keeps skinned meshes animating correctly), scales it to a
 * fixed frame, plays its looped skeletal clip when present, and spins slowly.
 *
 * Mirrors `PortraitCanvas` for hook-safety and the no-GPU/headless fallback:
 * every long-lived value lives in the effect scope, the effect runs once per
 * model and disposes its renderer/scene/geometry/materials/textures on cleanup
 * (and immediately on a terminal load failure).
 */
export function MonsterCanvas({ file, clip, accent = "#c9a04e" }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const w = host.clientWidth || 220;
    const h = host.clientHeight || 200;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // headless / no-GPU — static fallback panel.
      host.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#6a5e4a;font-size:10px;letter-spacing:1px;text-transform:uppercase;">Preview unavailable</div>`;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 1.25, 3.4);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffe9c0, 1.1);
    key.position.set(2, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.8);
    rim.position.set(-2, 1.5, -2);
    scene.add(rim);

    let root: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let ro: ResizeObserver | null = null;
    const timer = createFrameTimer();
    timer.connect(document);
    let raf = 0;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      disposed = true;
      cancelAnimationFrame(raf);
      timer.disconnect();
      ro?.disconnect();
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
        mixer = null;
      }
      if (root) {
        scene.remove(root);
        disposeObject(root);
        root = null;
      }
      disposeRenderer(renderer);
    };

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      timer.update();
      const dt = timer.getDelta();
      if (root) root.rotation.y += 0.006;
      if (mixer) mixer.update(dt);
      renderer.render(scene, camera);
    };

    createGltfLoader().load(
      `${MODELS_BASE}/${file}`,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const inner = gltf.scene;

        const box = new THREE.Box3().setFromObject(inner);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const scale = 2.0 / Math.max(size.y, 0.001);
        inner.scale.setScalar(scale);
        inner.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);

        inner.traverse((child) => {
          const mesh = child as THREE.Mesh & { isSkinnedMesh?: boolean };
          if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
        });

        if (clip && gltf.animations.length > 0) {
          const anim =
            gltf.animations.find((a) => a.name === clip) ??
            gltf.animations.find((a) => /idle/i.test(a.name)) ??
            gltf.animations[0];
          if (anim) {
            mixer = new THREE.AnimationMixer(inner);
            const action = mixer.clipAction(anim);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
          }
        }

        root = inner;
        scene.add(inner);
        tick();
      },
      undefined,
      () => {
        // Terminal load failure — tear everything down now, then show fallback.
        cleanup();
        host.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#6a5e4a;font-size:10px;letter-spacing:1px;text-transform:uppercase;">Model load failed</div>`;
      },
    );

    ro = new ResizeObserver(() => {
      const nw = host.clientWidth, nh = host.clientHeight;
      if (nw && nh) {
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(host);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, clip]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%", position: "relative" }} />;
}
