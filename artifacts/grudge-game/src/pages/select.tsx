import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Flame, Check, ArrowRight, Sparkles } from "lucide-react";
import {
  FIGHTERS,
  ATTR_ORDER,
  getActiveFighterId,
  setActiveFighterId,
  DEFAULT_FIGHTER_ID,
  RACALVIN_ID,
  type FighterDef,
  type AttrKey,
} from "@/data/fighters";
import {
  evolutionFamilyIds,
  getEvolutionMeta,
  isEvolutionFighter,
  tiersInFamily,
} from "@/data/fighterEvolutions";
import { getFighterKit } from "@/data/fighterSkills";
import { FighterPreview, type FighterPreviewHandle } from "@/components/FighterPreview";
import { FighterAssetTuner } from "@/components/FighterAssetTuner";
import {
  getFighterAssetTuning,
  type FighterAssetTuning,
} from "@/data/fighterAssetTuning";
import { RACALVIN_ANIMS } from "@/game/racalvinHero";
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

function TierBadge({ fighterId }: { fighterId: string }) {
  const evo = getEvolutionMeta(fighterId);
  if (!evo) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
        evo.isFinalForm
          ? "border border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200"
          : "border border-[#c5a059]/40 bg-[#c5a059]/10 text-[#c5a059]"
      }`}
    >
      {evo.isFinalForm ? (
        <>
          <Sparkles className="h-2.5 w-2.5" /> Final
        </>
      ) : (
        <>T{evo.tier}</>
      )}
    </span>
  );
}

function FighterCard({
  f,
  active,
  onSelect,
}: {
  f: FighterDef;
  active: boolean;
  onSelect: () => void;
}) {
  const evo = getEvolutionMeta(f.id);
  return (
    <button
      onClick={onSelect}
      className={`group flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
        active
          ? "border-[#c5a059] bg-[#c5a059]/10 shadow-[0_0_18px_rgba(197,160,89,0.25)]"
          : "border-border/50 bg-black/30 hover:border-[#c5a059]/50 hover:bg-[#c5a059]/5"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span
          className={`font-serif text-sm font-bold uppercase tracking-wide ${
            active ? "text-[#c5a059]" : "text-foreground"
          }`}
        >
          {f.name}
        </span>
        <TierBadge fighterId={f.id} />
      </div>
      <span className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
        {evo ? evo.tierLabel : f.role}
      </span>
      <span className="line-clamp-1 text-[9px] font-mono text-muted-foreground/80">{f.title}</span>
      {active && (
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#c5a059]">
          <Check className="h-3 w-3" /> Selected
        </span>
      )}
    </button>
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
  const selectedKit = getFighterKit(selected.id);
  const selectedEvo = getEvolutionMeta(selected.id);
  const previewRef = useRef<FighterPreviewHandle>(null);
  const [assetTuning, setAssetTuning] = useState<FighterAssetTuning>(() =>
    getFighterAssetTuning(selectedId),
  );
  const [meshNames, setMeshNames] = useState<string[]>([]);
  const [clipNames, setClipNames] = useState<string[]>([...RACALVIN_ANIMS]);
  const [weaponPreview, setWeaponPreview] = useState<"sword" | "pistol">("sword");
  const [tunerOpen, setTunerOpen] = useState(false);

  const { evolutionGroups, standalone } = useMemo(() => {
    const inFamily = new Set<string>();
    const groups: { familyId: string; familyName: string; fighters: FighterDef[] }[] = [];
    for (const familyId of evolutionFamilyIds()) {
      const tiers = tiersInFamily(familyId);
      const fighters = FIGHTERS.filter((f) => getEvolutionMeta(f.id)?.familyId === familyId).sort(
        (a, b) => (getEvolutionMeta(a.id)?.tier ?? 0) - (getEvolutionMeta(b.id)?.tier ?? 0),
      );
      fighters.forEach((f) => inFamily.add(f.id));
      if (fighters.length > 0) {
        groups.push({ familyId, familyName: tiers[0]!.familyName, fighters });
      }
    }
    const solo = FIGHTERS.filter((f) => !inFamily.has(f.id) && !isEvolutionFighter(f.id));
    return { evolutionGroups: groups, standalone: solo };
  }, []);

  const onSelectFighter = (id: string) => {
    setSelectedId(id);
    setAssetTuning(getFighterAssetTuning(id));
    setMeshNames([]);
    setClipNames(id === RACALVIN_ID ? [...RACALVIN_ANIMS] : []);
    setWeaponPreview("sword");
  };

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
          <p className="mt-1 text-[11px] font-mono text-muted-foreground">
            Same-name fighters evolve low → high. Final forms carry the ultimate R.
          </p>
        </div>
        <Flame className="h-8 w-8 text-[#c5a059]/60" />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-[#c5a059]/20 bg-gradient-to-b from-[#1a1410]/80 to-black/60">
          <div className="relative h-[420px] w-full bg-[radial-gradient(ellipse_at_center,_rgba(197,160,89,0.12),_transparent_70%)]">
            <FighterPreview
              ref={previewRef}
              skinId={selected.skinId}
              fighterId={selected.id}
              tuning={assetTuning}
              pauseRotation={tunerOpen}
              onMeshesReady={setMeshNames}
              onClipsReady={(clips) => setClipNames(clips.length ? clips : [...RACALVIN_ANIMS])}
            />
            <FighterAssetTuner
              fighterId={selected.id}
              fighterName={selected.name}
              tuning={assetTuning}
              meshNames={meshNames}
              clipNames={clipNames}
              weaponPreview={weaponPreview}
              onTuningChange={setAssetTuning}
              onWeaponPreviewChange={(mode) => {
                setWeaponPreview(mode);
                previewRef.current?.setWeaponPreview(mode);
              }}
              onPreviewClip={(clip) => previewRef.current?.previewClip(clip)}
              onOpenChange={setTunerOpen}
            />
            {selected.featured && (
              <span className="absolute left-4 top-4 rounded-full border border-[#c5a059]/50 bg-black/50 px-3 py-1 font-serif text-[10px] uppercase tracking-widest text-[#c5a059]">
                Featured
              </span>
            )}
            {selectedEvo?.isFinalForm && (
              <span className="absolute right-4 top-4 rounded-full border border-fuchsia-400/50 bg-fuchsia-500/20 px-3 py-1 font-serif text-[10px] uppercase tracking-widest text-fuchsia-200">
                Ultimate R
              </span>
            )}
          </div>
          <div className="space-y-4 p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-3xl font-bold uppercase tracking-wide text-foreground">
                  {selected.name}
                </h2>
                <TierBadge fighterId={selected.id} />
              </div>
              <p className="font-serif text-sm uppercase tracking-[0.25em] text-[#c5a059]">
                {selected.title} · {selected.role}
              </p>
              {selectedEvo && (
                <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                  Evolution {selectedEvo.tier}
                  {selectedEvo.evolvesFrom ? ` · evolves from ${FIGHTERS.find((x) => x.id === selectedEvo.evolvesFrom)?.title ?? selectedEvo.evolvesFrom}` : ""}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.blurb}</p>
              <div className="mt-3 rounded border border-white/10 bg-black/40 px-3 py-2">
                <p className="text-[9px] font-serif uppercase tracking-widest text-[#c5a059] mb-1">
                  R — {selectedKit.special.isUltimate ? "Ultimate" : "Power-Up"}
                </p>
                <p className="font-serif text-sm text-foreground">{selectedKit.special.name}</p>
                <p className="text-[11px] text-muted-foreground">{selectedKit.special.description}</p>
              </div>
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

        <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto pr-1 self-start">
          {evolutionGroups.map((g) => (
            <div key={g.familyId}>
              <p className="mb-2 font-serif text-[10px] uppercase tracking-[0.25em] text-[#c5a059]/80">
                {g.familyName} — Evolution Line
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.fighters.map((f) => (
                  <FighterCard
                    key={f.id}
                    f={f}
                    active={f.id === selectedId}
                    onSelect={() => onSelectFighter(f.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 font-serif text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Champions
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {standalone.map((f) => (
                <FighterCard
                  key={f.id}
                  f={f}
                  active={f.id === selectedId}
                  onSelect={() => onSelectFighter(f.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}