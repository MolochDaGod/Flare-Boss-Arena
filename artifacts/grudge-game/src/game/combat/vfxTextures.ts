import * as THREE from "three";

let spriteTex: THREE.Texture | null = null;
let flameTex: THREE.Texture | null = null;
let arrowTex: THREE.Texture | null = null;

function canvasTex(c: HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial glow — projectile halos and particle billboards. */
export function getSpriteTexture(): THREE.Texture {
  if (spriteTex) return spriteTex;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.55, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  spriteTex = canvasTex(c);
  return spriteTex;
}

/** Flame tongue sprite — fire auras and ember projectiles. */
export function getFlameTexture(): THREE.Texture {
  if (flameTex) return flameTex;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const topY = size * 0.05;
  const botY = size * 0.94;
  const w = size * 0.36;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.bezierCurveTo(cx + w * 0.55, size * 0.3, cx + w, size * 0.62, cx + w * 0.45, botY);
  ctx.quadraticCurveTo(cx, size * 1.02, cx - w * 0.45, botY);
  ctx.bezierCurveTo(cx - w, size * 0.62, cx - w * 0.55, size * 0.3, cx, topY);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, botY, 0, topY);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.96)");
  g.addColorStop(0.78, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fill();
  flameTex = canvasTex(c);
  return flameTex;
}

/** Arrow shaft + head silhouette for ranger shots. */
export function getArrowTexture(): THREE.Texture {
  if (arrowTex) return arrowTex;
  const w = 64;
  const h = 16;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const cy = h / 2;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.15, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.85, "rgba(255,255,255,0.95)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, cy);
  ctx.lineTo(w - 10, cy);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  ctx.moveTo(w - 8, cy);
  ctx.lineTo(w - 2, cy - 4);
  ctx.lineTo(w - 2, cy + 4);
  ctx.closePath();
  ctx.fill();
  arrowTex = canvasTex(c);
  return arrowTex;
}

export function disposeVfxTextures() {
  spriteTex?.dispose();
  flameTex?.dispose();
  arrowTex?.dispose();
  spriteTex = flameTex = arrowTex = null;
}