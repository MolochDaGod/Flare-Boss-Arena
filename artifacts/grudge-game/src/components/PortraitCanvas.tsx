import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * GLB cache so re-mounts and race switches don't re-download.
 * Keyed by absolute URL → Promise<THREE.Group>. We always .clone() before use.
 */
const glbCache = new Map<string, Promise<THREE.Group>>();
function loadGlb(url: string): Promise<THREE.Group> {
  let p = glbCache.get(url);
  if (!p) {
    p = new Promise<THREE.Group>((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err),
      );
    });
    glbCache.set(url, p);
  }
  return p.then((scene) => scene.clone(true));
}

interface Props {
  /** Primary model URL. */
  src: string;
  /** Optional fallback URL if `src` fails. */
  fallbackSrc?: string;
  /**
   * Given every mesh name discovered in the loaded GLB, return the set that
   * should be VISIBLE. Everything else is hidden. Use this for the toon-rts
   * models where every weapon/body variant is baked into one file.
   */
  visibilityFor?: (meshNames: string[]) => Set<string>;
  /**
   * Legacy fallback for the KayKit-style "show everything, hide a few" model.
   * Ignored if `visibilityFor` is supplied.
   */
  hiddenMeshes?: Set<string>;
  /** Accent colour for the rim light (matches faction). */
  accent?: string;
}

/**
 * Self-contained Three.js portrait renderer. Replaces <model-viewer> so we
 * can toggle individual mesh visibility (KayKit equipment parts).
 *
 * Hook safety: every long-lived value lives on a ref. The mount effect runs
 * ONCE per src and tears down its renderer/scene on cleanup; the visibility
 * effect only mutates `.visible` flags on already-loaded meshes — no setState
 * inside RAF, no cross-component state. This avoids the "Invalid hook call"
 * surface that the old PlayerPortrait class triggered.
 */
export function PortraitCanvas({ src, fallbackSrc, visibilityFor, hiddenMeshes, accent = "#c9a04e" }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const meshIndexRef = useRef<Map<string, THREE.Object3D>>(new Map());
  // Stash the latest resolver on a ref so the visibility effect (and the
  // initial install) always uses the freshest value without re-running the
  // expensive mount/load effect.
  const visibilityForRef = useRef(visibilityFor);
  const hiddenRef = useRef(hiddenMeshes);
  visibilityForRef.current = visibilityFor;
  hiddenRef.current = hiddenMeshes;

  // ─── Mount / load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const w = host.clientWidth || 200;
    const h = host.clientHeight || 280;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // headless / no-GPU — render a static fallback panel.
      host.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#6a5e4a;font-size:10px;letter-spacing:1px;text-transform:uppercase;">Preview unavailable</div>`;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 1.4, 3.2);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffe9c0, 1.0);
    key.position.set(2, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.7);
    rim.position.set(-2, 1.5, -2);
    scene.add(rim);

    let raf = 0;
    let rot = 0;
    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      rot += 0.005;
      if (rootRef.current) rootRef.current.rotation.y = rot;
      renderer.render(scene, camera);
    };

    const applyVisibility = () => {
      const idx = meshIndexRef.current;
      const resolver = visibilityForRef.current;
      if (resolver) {
        // toon-rts model: explicit allow-list of visible mesh names.
        const visible = resolver(Array.from(idx.keys()));
        idx.forEach((obj, name) => { obj.visible = visible.has(name); });
      } else {
        const hide = hiddenRef.current ?? new Set<string>();
        idx.forEach((obj, name) => { obj.visible = !hide.has(name); });
      }
    };

    const installModel = (group: THREE.Group) => {
      if (disposed) return;
      // Centre + scale to fit a ~2.4m frame.
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const scale = 2.0 / Math.max(size.y, 0.001);
      group.scale.setScalar(scale);
      group.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);

      // Index meshes by name so the visibility effect can toggle them.
      const idx = meshIndexRef.current;
      idx.clear();
      group.traverse((obj) => {
        if (obj.name) idx.set(obj.name, obj);
      });

      rootRef.current = group;
      scene.add(group);
      applyVisibility();
      tick();
    };

    loadGlb(src)
      .then(installModel)
      .catch(() => {
        if (disposed || !fallbackSrc) return;
        loadGlb(fallbackSrc).then(installModel).catch(() => {
          if (disposed) return;
          host.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#6a5e4a;font-size:10px;">Model load failed</div>`;
        });
      });

    // Resize observer keeps the canvas sharp inside the side panel.
    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth, nh = host.clientHeight;
      if (nw && nh) {
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (rootRef.current) {
        scene.remove(rootRef.current);
        rootRef.current.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) mat.dispose();
        });
        rootRef.current = null;
      }
      meshIndexRef.current.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
    // `accent` and visibility are NOT in deps — they're applied through other effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackSrc]);

  // ─── Visibility toggle on equipment change ────────────────────────────────
  useEffect(() => {
    const idx = meshIndexRef.current;
    if (idx.size === 0) return; // model not loaded yet — install will apply.
    if (visibilityFor) {
      const visible = visibilityFor(Array.from(idx.keys()));
      idx.forEach((obj, name) => { obj.visible = visible.has(name); });
    } else if (hiddenMeshes) {
      idx.forEach((obj, name) => { obj.visible = !hiddenMeshes.has(name); });
    }
  }, [visibilityFor, hiddenMeshes]);

  return (
    <div
      ref={hostRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
}
