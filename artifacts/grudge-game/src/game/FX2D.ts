/**
 * FX2D — 2D overlay effects for Flare Boss Arena.
 *
 * Manages a <canvas> that sits above the Three.js canvas:
 *   • Custom crosshair (replaces CSS cursor: crosshair with something sharp)
 *   • Hit sparks (burst of particles on melee impact)
 *   • Spell impact rings (expanding circle + radial lines on ranged hit)
 *   • Floating projectile trails (drawn per-frame between player and target)
 *
 * Usage:
 *   const fx = new FX2D(containerDiv);
 *   // each frame:
 *   fx.update(dt);
 *   fx.draw();
 *   // on hit:
 *   fx.spawnHitSparks(screenX, screenY, color);
 *   // on spell:
 *   fx.spawnSpellImpact(screenX, screenY, color);
 *   // projectile:
 *   fx.addProjectile(fromScreen, toScreen, speed, color);
 *   // cleanup:
 *   fx.dispose();
 */

export interface ScreenPos { x: number; y: number }

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
}

interface SpellRing {
  x: number; y: number;
  radius: number; maxRadius: number;
  life: number; maxLife: number;
  color: string;
  rays: number;
}

interface Projectile {
  x: number; y: number;
  tx: number; ty: number;
  speed: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
  alive: boolean;
  onHit?: () => void;
}

export class FX2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private rings: SpellRing[] = [];
  private projectiles: Projectile[] = [];
  private mouseX = 0;
  private mouseY = 0;
  private showCrosshair = true;
  private container: HTMLElement;
  private _moveHandler: (e: MouseEvent) => void;
  private _enterHandler: () => void;
  private _leaveHandler: () => void;
  private mouseInside = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();

    // Hide the native cursor on the 3D canvas so our drawn crosshair replaces it
    const threeDom = container.querySelector("canvas:not([style*='pointer-events:none'])") as HTMLCanvasElement | null;
    if (threeDom) threeDom.style.cursor = "none";
    container.style.cursor = "none";

    this._moveHandler = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };
    this._enterHandler = () => { this.mouseInside = true; };
    this._leaveHandler = () => { this.mouseInside = false; };
    container.addEventListener("mousemove", this._moveHandler);
    container.addEventListener("mouseenter", this._enterHandler);
    container.addEventListener("mouseleave", this._leaveHandler);
    window.addEventListener("resize", this._resizeBound);
  }

  private _resizeBound = () => this.resize();

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Crosshair ─────────────────────────────────────────────────

  private drawCrosshair() {
    if (!this.showCrosshair || !this.mouseInside) return;
    const ctx = this.ctx;
    const x = this.mouseX;
    const y = this.mouseY;
    const r = 12; // outer radius
    const gap = 4; // inner gap

    ctx.save();
    ctx.strokeStyle = "#ff6600";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ff3300";
    ctx.shadowBlur = 6;

    // 4 lines with gap in center
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + r);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "#ffaa00";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Hit Sparks ────────────────────────────────────────────────

  spawnHitSparks(sx: number, sy: number, color = "#ffaa00", count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x: sx, y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.3 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  // ── Spell Impact ──────────────────────────────────────────────

  spawnSpellImpact(sx: number, sy: number, color = "#3388ff", maxRadius = 40) {
    this.rings.push({
      x: sx, y: sy,
      radius: 0, maxRadius,
      life: 0.5, maxLife: 0.5,
      color,
      rays: 6 + Math.floor(Math.random() * 4),
    });
    // Also spawn a small spark burst
    this.spawnHitSparks(sx, sy, color, 8);
  }

  // ── Projectiles ───────────────────────────────────────────────

  addProjectile(from: ScreenPos, to: ScreenPos, speed = 600, color = "#ff4400", onHit?: () => void) {
    this.projectiles.push({
      x: from.x, y: from.y,
      tx: to.x, ty: to.y,
      speed,
      color,
      trail: [{ x: from.x, y: from.y }],
      alive: true,
      onHit,
    });
  }

  // ── Update + Draw ─────────────────────────────────────────────

  update(dt: number) {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.radius = r.maxRadius * (1 - r.life / r.maxLife);
      if (r.life <= 0) this.rings.splice(i, 1);
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8) {
        // Hit
        p.alive = false;
        this.spawnHitSparks(p.tx, p.ty, p.color, 10);
        p.onHit?.();
        this.projectiles.splice(i, 1);
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        p.x += nx * p.speed * dt;
        p.y += ny * p.speed * dt;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Projectile trails
    for (const p of this.projectiles) {
      if (p.trail.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.stroke();
      // Head glow
      const head = p.trail[p.trail.length - 1];
      ctx.beginPath();
      ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    }

    // Spell rings
    for (const r of this.rings) {
      const alpha = r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      // Radial lines
      for (let i = 0; i < r.rays; i++) {
        const a = (i / r.rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(r.x + Math.cos(a) * r.radius * 0.3, r.y + Math.sin(a) * r.radius * 0.3);
        ctx.lineTo(r.x + Math.cos(a) * r.radius, r.y + Math.sin(a) * r.radius);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Crosshair (always on top)
    this.drawCrosshair();
  }

  dispose() {
    this.container.removeEventListener("mousemove", this._moveHandler);
    this.container.removeEventListener("mouseenter", this._enterHandler);
    this.container.removeEventListener("mouseleave", this._leaveHandler);
    window.removeEventListener("resize", this._resizeBound);
    this.canvas.remove();
    this.container.style.cursor = "";
  }
}
