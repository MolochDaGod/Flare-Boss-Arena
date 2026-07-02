import { useState } from "react";
import { useLocation } from "wouter";
import { Flame, Check, ArrowRight } from "lucide-react";
import {
  FIGHTERS,
  ATTR_ORDER,
  getActiveFighterId,
  setActiveFighterId,
  DEFAULT_FIGHTER_ID,
  type FighterDef,
  type AttrKey,
} from "@/data/fighters";
import { FighterPreview } from "@/components/FighterPreview";
import { useToast } from "@/hooks/use-toast";

const ATTR_LABEL: Record<AttrKey, string> = {
  strength: "Strength",
  vitality: "Vitality",
  dexterity: "Dexterity",
  agility: "Agility",
  endurance: "Endurance",
  intellect: "Intellect",
  tactics: "Tactics",
  wisdom: "Wisdom",
};

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 font-serif text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-[#c5a059]/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7a5a23] to-[#c5a059]"
          style={{ width: `${Math.min(100, value * 10)}%` }}
        />
      </div>
      <span className="w-5 shrink-0 text-right font-mono text-xs text-[#c5a059]">{value}</span>
    </div>
  );
}

export default function Select() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const initial = getActiveFighterId() ?? DEFAULT_FIGHTER_ID;
  const [selectedId, setSelectedId] = useState(
    FIGHTERS.some((f) => f.id === initial) ? initial : FIGHTERS[0].id,
  );
  const selected: FighterDef = FIGHTERS.find((f) => f.id === selectedId) ?? FIGHTERS[0];

  const confirm = () => {
    setActiveFighterId(selected.id);
    toast({
      title: `${selected.name} chosen`,
      description: `${selected.title} — ${selected.role}. Ready to fight.`,
    });
    navigate("/");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between border-b border-[#c5a059]/20 pb-4">
        <div>
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground">
            The Roster
          </p>
          <h1 className="font-serif text-4xl font-bold uppercase tracking-widest text-[#c5a059]">
            Choose Fighter
          </h1>
        </div>
        <Flame className="h-8 w-8 text-[#c5a059]/60" />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Preview + details */}
        <div className="overflow-hidden rounded-lg border border-[#c5a059]/20 bg-gradient-to-b from-[#1a1410]/80 to-black/60">
          <div className="relative h-[420px] w-full bg-[radial-gradient(ellipse_at_center,_rgba(197,160,89,0.12),_transparent_70%)]">
            <FighterPreview skinId={selected.skinId} />
            {selected.featured && (
              <span className="absolute left-4 top-4 rounded-full border border-[#c5a059]/50 bg-black/50 px-3 py-1 font-serif text-[10px] uppercase tracking-widest text-[#c5a059]">
                Featured
              </span>
            )}
          </div>
          <div className="space-y-4 p-6">
            <div>
              <h2 className="font-serif text-3xl font-bold uppercase tracking-wide text-foreground">
                {selected.name}
              </h2>
              <p className="font-serif text-sm uppercase tracking-[0.25em] text-[#c5a059]">
                {selected.title} · {selected.role}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.blurb}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ATTR_ORDER.map((attr) => (
                <StatBar key={attr} label={ATTR_LABEL[attr]} value={selected.stats[attr]} />
              ))}
            </div>
            <button
              onClick={confirm}
              className="group flex w-full items-center justify-center gap-2 rounded-md border border-[#c5a059]/40 bg-gradient-to-b from-[#3a2a12] to-[#1a1208] py-3 font-serif text-sm uppercase tracking-widest text-[#c5a059] transition hover:from-[#4a3618] hover:to-[#241a0c] hover:text-[#e8c87a]"
            >
              <Check className="h-4 w-4" />
              Fight as {selected.name}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Roster grid */}
        <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-3">
          {FIGHTERS.map((f) => {
            const active = f.id === selectedId;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                className={`group flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                  active
                    ? "border-[#c5a059] bg-[#c5a059]/10 shadow-[0_0_18px_rgba(197,160,89,0.25)]"
                    : "border-border/50 bg-black/30 hover:border-[#c5a059]/50 hover:bg-[#c5a059]/5"
                }`}
              >
                <span
                  className={`font-serif text-sm font-bold uppercase tracking-wide ${
                    active ? "text-[#c5a059]" : "text-foreground"
                  }`}
                >
                  {f.name}
                </span>
                <span className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
                  {f.role}
                </span>
                {active && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#c5a059]">
                    <Check className="h-3 w-3" /> Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
