import * as THREE from "three";

/**
 * Procedural flame/spark sprite textures — generated once on a 2D canvas and
 * cached, so the rich flame VFX need no external (R2/public) asset fetch.
 * Ported from the VFX sandbox so the dungeon engine can build volumetric
 * point-cloud flames imperatively (no React/R3F).
 */

let sprite: THREE.Texture | null = null;

/** Soft radial glow disc — the generic additive spark/glow particle. */
export function getSpriteTexture(): THREE.Texture {
  if (sprite) return sprite;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.55, "rgba(255,255,255,0.3)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sprite = tex;
  return tex;
}

let flame: THREE.Texture | null = null;

/**
 * A flame "tongue" sprite: pointed at the top, rounded at the base, with a
 * bright near-opaque core and feathered edges. Stacked billboards build a
 * volumetric flame body instead of flat translucent discs.
 */
export function getFlameTexture(): THREE.Texture {
  if (flame) return flame;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const topY = size * 0.05;
  const botY = size * 0.94;
  const w = size * 0.36;

  // Flame silhouette: a teardrop pointing up.
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.bezierCurveTo(cx + w * 0.55, size * 0.3, cx + w, size * 0.62, cx + w * 0.45, botY);
  ctx.quadraticCurveTo(cx, size * 1.02, cx - w * 0.45, botY);
  ctx.bezierCurveTo(cx - w, size * 0.62, cx - w * 0.55, size * 0.3, cx, topY);
  ctx.closePath();

  // Vertical gradient: opaque hot base fading out toward the wispy tip.
  const g = ctx.createLinearGradient(0, botY, 0, topY);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.96)");
  g.addColorStop(0.78, "rgba(255,255,255,0.55)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  try {
    ctx.filter = "blur(3px)";
  } catch {
    /* filter unsupported — crisper edges, still fine */
  }
  ctx.fill();
  ctx.filter = "none";

  // A dense inner core so overlapping flames stack into a bright solid heart.
  const core = ctx.createRadialGradient(cx, size * 0.7, 0, cx, size * 0.7, size * 0.3);
  core.addColorStop(0.0, "rgba(255,255,255,0.95)");
  core.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, size * 0.7, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  flame = tex;
  return tex;
}
