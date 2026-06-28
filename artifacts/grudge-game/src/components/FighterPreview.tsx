import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSkin, skinUrl, SKIN_CLIP_SUFFIX } from "@/data/skins";
import { disposeObject3D } from "@/game/kaykitHero";
import { RACALVIN_ID } from "@/data/fighters";
import { RACALVIN_BASE_URL } from "@/game/racalvinHero";

/**
 * Rotating 3D portrait of a fighter's skin GLB for the Choose Fighter lobby.
 * One WebGL canvas (re-loads when `skinId` changes). Plays the skin's native
 * idle clip when present; otherwise stands in its first clip / static bind pose.
 * Falls back to a placeholder when WebGL is unavailable (headless/screenshot).
 */
export function FighterPreview({ skinId }: { skinId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

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

    const w = mount.clientWidth || 360;
    const h = mount.clientHeight || 480;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    camera.position.set(0, 1.25, 4.6);
    camera.lookAt(0, 1.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.5);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc5a059, 1.1);
    rim.position.set(-3, 2.5, -2);
    scene.add(rim);

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let disposed = false;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();

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
          // Uniform fit-to-height + center on origin (feet at y=0).
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

          if (gltf.animations.length) {
            mixer = new THREE.AnimationMixer(m);
            const idle =
              gltf.animations.find((a) =>
                SKIN_CLIP_SUFFIX.idle.some((suf) => a.name.toLowerCase().endsWith(suf)),
              ) ?? gltf.animations[0];
            if (idle) mixer.clipAction(idle).reset().play();
          }
        },
        undefined,
        () => {
          /* missing model — leave empty stage */
        },
      );
    }

    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const d = clock.getDelta();
      mixer?.update(d);
      if (model) model.rotation.y += d * 0.5;
      renderer.render(scene, camera);
    };
    render();

    const onResize = () => {
      const nw = mount.clientWidth || w;
      const nh = mount.clientHeight || h;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mixer?.stopAllAction();
      if (model) {
        scene.remove(model);
        disposeObject3D(model);
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [skinId]);

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
}
