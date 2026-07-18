/**
 * MOBA mode — three lanes, towers, waves, Annihilate hero pick.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Swords, Castle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveFighter, FIGHTERS } from "@/data/fighters";
import { ANNIHILATE_FIGHTERS } from "@/data/annihilateHeroes";
import { getFighterKit } from "@/data/fighterSkills";
import {
  createMobaMatch,
  updateMobaMatch,
  type MobaMatchState,
} from "@/game/MobaMode";

export default function MobaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MobaMatchState | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const [hud, setHud] = useState({ message: "", wave: 0, gold: 0, hp: 0, kills: 0 });
  const [winner, setWinner] = useState<string | null>(null);
  const fighter = useMemo(() => getActiveFighter(), []);
  const kit = useMemo(() => getFighterKit(fighter.id), [fighter.id]);

  useEffect(() => {
    document.title = "MOBA — Flare Boss Arena";
    const match = createMobaMatch(fighter.id);
    stateRef.current = match;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      keysRef.current[e.code] = down;
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let raf = 0;
    let last = performance.now();

    const worldToScreen = (x: number, z: number, w: number, h: number) => {
      // Map -55..55 → screen with margin
      const sx = ((x + 55) / 110) * w;
      const sy = ((z + 55) / 110) * h;
      return { sx, sy };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const keys = keysRef.current;
      let x = 0;
      let z = 0;
      if (keys["KeyW"] || keys["ArrowUp"]) z -= 1;
      if (keys["KeyS"] || keys["ArrowDown"]) z += 1;
      if (keys["KeyA"] || keys["ArrowLeft"]) x -= 1;
      if (keys["KeyD"] || keys["ArrowRight"]) x += 1;
      const len = Math.hypot(x, z) || 1;
      x /= len;
      z /= len;

      const attack = !!(keys["KeyF"] || keys["Space"] || keys["KeyE"]);
      if (stateRef.current && !stateRef.current.winner) {
        stateRef.current = updateMobaMatch(stateRef.current, dt, { x, z, attack });
      }
      const st = stateRef.current!;
      setHud({
        message: st.message,
        wave: st.wave,
        gold: Math.floor(st.player.gold),
        hp: Math.max(0, Math.floor(st.player.hp)),
        kills: st.player.kills,
      });
      if (st.winner) setWinner(st.winner);

      // Draw
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#0a0c12";
      ctx.fillRect(0, 0, w, h);

      // Lanes
      ctx.strokeStyle = "rgba(197,160,89,0.25)";
      ctx.lineWidth = 3 * devicePixelRatio;
      for (const lane of [
        [
          [-40, -40],
          [-40, 40],
          [40, 40],
        ],
        [
          [-40, -40],
          [40, 40],
        ],
        [
          [-40, -40],
          [40, -40],
          [40, 40],
        ],
      ] as number[][][]) {
        ctx.beginPath();
        lane.forEach((p, i) => {
          const { sx, sy } = worldToScreen(p[0]!, p[1]!, w, h);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      // Towers
      for (const t of st.towers) {
        if (t.destroyed) continue;
        const { sx, sy } = worldToScreen(t.pos.x, t.pos.z, w, h);
        const r = t.id.includes("core") ? 14 : 9;
        ctx.fillStyle = t.team === "radiant" ? "#3b82f6" : "#ef4444";
        ctx.beginPath();
        ctx.arc(sx, sy, r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
        // HP bar
        const pct = t.hp / t.maxHp;
        ctx.fillStyle = "#222";
        ctx.fillRect(sx - 16 * devicePixelRatio, sy - 18 * devicePixelRatio, 32 * devicePixelRatio, 4 * devicePixelRatio);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(sx - 16 * devicePixelRatio, sy - 18 * devicePixelRatio, 32 * devicePixelRatio * pct, 4 * devicePixelRatio);
      }

      // Minions
      for (const m of st.minions) {
        const { sx, sy } = worldToScreen(m.pos.x, m.pos.z, w, h);
        ctx.fillStyle = m.team === "radiant" ? "#60a5fa" : "#f87171";
        ctx.fillRect(sx - 3 * devicePixelRatio, sy - 3 * devicePixelRatio, 6 * devicePixelRatio, 6 * devicePixelRatio);
      }

      // Bots
      for (const b of st.bots) {
        if (b.hp <= 0) continue;
        const { sx, sy } = worldToScreen(b.pos.x, b.pos.z, w, h);
        ctx.fillStyle = b.team === "radiant" ? "#93c5fd" : "#fca5a5";
        ctx.beginPath();
        ctx.arc(sx, sy, 7 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player
      {
        const { sx, sy } = worldToScreen(st.player.pos.x, st.player.pos.z, w, h);
        ctx.fillStyle = "#c5a059";
        ctx.beginPath();
        ctx.arc(sx, sy, 9 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [fighter.id]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#060608]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <Link href="/">
          <Button variant="outline" size="sm" className="border-[#c5a059]/40 bg-black/70 text-[#c5a059]">
            <ArrowLeft className="mr-1 h-4 w-4" /> War Panel
          </Button>
        </Link>
        <div className="rounded border border-[#c5a059]/30 bg-black/70 px-3 py-1.5 text-xs text-[#e8d5a3]">
          <Swords className="mr-1 inline h-3.5 w-3.5 text-[#c5a059]" />
          {fighter.name} · {kit.skills.length} skills
        </div>
      </div>

      <div className="absolute top-3 right-3 z-20 space-y-1 text-right">
        <div className="rounded border border-[#c5a059]/30 bg-black/70 px-3 py-1 font-mono text-xs text-[#e8d5a3]">
          Wave {hud.wave} · Gold {hud.gold} · HP {hud.hp} · Kills {hud.kills}
        </div>
        <div className="max-w-xs rounded border border-border/40 bg-black/60 px-3 py-1 text-[10px] text-muted-foreground">
          {hud.message}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-20 rounded border border-[#c5a059]/25 bg-black/75 px-4 py-3 text-[11px] text-muted-foreground">
        <div className="mb-1 font-serif text-xs uppercase tracking-widest text-[#c5a059]">
          <Castle className="mr-1 inline h-3.5 w-3.5" /> MOBA Controls
        </div>
        <div>WASD — move · F / Space — attack minions & towers</div>
        <div className="mt-1 text-[10px] opacity-80">
          24 Annihilate heroes available on /select · skill kits on /skills
        </div>
      </div>

      {winner && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
          <div className="rounded-xl border border-[#c5a059]/40 bg-[#0c0a08] p-8 text-center">
            <h2 className="font-serif text-2xl text-[#c5a059]">
              {winner === "radiant" ? "Radiant Victory" : "Dire Victory"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{hud.message}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                className="bg-[#c5a059] text-black"
                onClick={() => {
                  stateRef.current = createMobaMatch(fighter.id);
                  setWinner(null);
                }}
              >
                Rematch
              </Button>
              <Link href="/select">
                <Button variant="outline" className="border-[#c5a059]/40">
                  Change Hero
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-20 max-h-40 w-48 overflow-y-auto rounded border border-border/40 bg-black/70 p-2 text-[10px] text-muted-foreground">
        <div className="mb-1 font-serif text-[10px] uppercase tracking-wider text-[#c5a059]">
          Annihilate roster ({ANNIHILATE_FIGHTERS.length})
        </div>
        {ANNIHILATE_FIGHTERS.slice(0, 8).map((f) => (
          <div key={f.id}>{f.name}</div>
        ))}
        <div className="opacity-60">+{Math.max(0, ANNIHILATE_FIGHTERS.length - 8)} more on Select…</div>
        <div className="mt-1 opacity-50">Total fighters: {FIGHTERS.length}</div>
      </div>
    </div>
  );
}
