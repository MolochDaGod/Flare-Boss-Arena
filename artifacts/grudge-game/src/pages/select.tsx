import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Flame, Check, ArrowRight, Sparkles, Pause, Play, Lock, Unlock } from "lucide-react";
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
  ANNIHILATE_FIGHTERS,
  isAnnihilateHeroId,
} from "@/data/annihilateHeroes";
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
import {
  GBUX_PER_TOKEN,
  getFlareTokens,
  getFighterLevel,
  isOwned,
  isPlayable,
  isWeeklyFree,
  unlockWithToken,
} from "@/data/flareEconomy";

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
  const owned = isOwned(f.id);
  const weekly = isWeeklyFree(f.id);
  const locked = !isPlayable(f.id);
  return (
    <button
      onClick={onSelect}
      className={`group flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
        active
          ? "border-[#c5a059] bg-[#c5a059]/10 shadow-[0_0_18px_rgba(197,160,89,0.25)]"
          : locked
            ? "border-border/30 bg-black/50 opacity-80 hover:border-red-900/40"
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
        <div className="flex items-center gap-1">
          {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
          {owned && <Unlock className="h-3 w-3 text-[#c5a059]" />}
          {weekly && !owned && (
            <span className="text-[8px] font-mono uppercase text-emerald-400/90">Free</span>
          )}
          <TierBadge fighterId={f.id} />
        </div>
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
  const [tokens, setTokens] = useState(() => getFlareTokens());
  const selected: FighterDef = FIGHTERS.find((f) => f.id === selectedId) ?? FIGHTERS[0];
  const selectedKit = getFighterKit(selected.id);
  const selectedEvo = getEvolutionMeta(selected.id);
  const selectedOwned = isOwned(selected.id);
  const selectedWeekly = isWeeklyFree(selected.id);
  const selectedPlayable = isPlayable(selected.id);
  const selectedLevel = getFighterLevel(selected.id);
  const previewRef = useRef<FighterPreviewHandle>(null);
  const [assetTuning, setAssetTuning] = useState<FighterAssetTuning>(() =>
    getFighterAssetTuning(selectedId),
  );
  const [meshNames, setMeshNames] = useState<string[]>([]);
  const [clipNames, setClipNames] = useState<string[]>([...RACALVIN_ANIMS]);
  const [weaponPreview, setWeaponPreview] = useState<"swordHeld" | "swordRest" | "pistol">("swordHeld");
  const [tunerOpen, setTunerOpen] = useState(false);
  const [previewSpin, setPreviewSpin] = useState(true);
  const [handBoneName, setHandBoneName] = useState<string | null>(null);

  const { evolutionGroups, standalone, grudge24 } = useMemo(() => {
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
    // Warlords 24 first — 6 races × 4 classes, CDN Toon-RTS + baked anims
    const grudge24 = ANNIHILATE_FIGHTERS;
    const g6Ids = new Set(grudge24.map((f) => f.id));
    const solo = FIGHTERS.filter(
      (f) => !inFamily.has(f.id) && !isEvolutionFighter(f.id) && !g6Ids.has(f.id) && !isAnnihilateHeroId(f.id),
    );
    return { evolutionGroups: groups, standalone: solo, grudge24 };
  }, []);

  const onSelectFighter = (id: string) => {
    setSelectedId(id);
    setAssetTuning(getFighterAssetTuning(id));
    setMeshNames([]);
    setClipNames(id === RACALVIN_ID ? [...RACALVIN_ANIMS] : []);
    setWeaponPreview("swordHeld");
    setHandBoneName(null);
  };

  const confirm = () => {
    if (!isPlayable(selected.id)) {
      toast({
        title: "Fighter locked",
        description: "Spend 1 Flare Grudge Token to unlock, or wait for weekly free rotation.",
        variant: "destructive",
      });
      return;
    }
    setActiveFighterId(selected.id);
    toast({
      title: `${selected.name} chosen`,
      description: selectedOwned
        ? `${selected.title} — owned. Level ${selectedLevel} saves to account.`
        : `${selected.title} — weekly free test. Levels will NOT save until owned.`,
    });
    navigate("/");
  };

  const unlock = () => {
    const r = unlockWithToken(selected.id);
    if (!r.ok) {
      toast({
        title: r.reason === "insufficient_tokens" ? "Need a Flare Grudge Token" : "Cannot unlock",
        description:
          r.reason === "insufficient_tokens"
            ? `Buy tokens for ${GBUX_PER_TOKEN} GBUX on Account, or earn via 5 boss kills.`
            : r.reason,
        variant: "destructive",
      });
      return;
    }
    setTokens(r.tokensLeft);
    toast({
      title: `${selected.name} unlocked`,
      description: `1 token spent · ${r.tokensLeft} remaining. Level progress now saves.`,
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between border-b border-[#c5a059]/20 pb-4">
        <div>
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground">
            The Roster · Production locks
          </p>
          <h1 className="font-serif text-4xl font-bold uppercase tracking-widest text-[#c5a059]">
            Choose Fighter
          </h1>
          <p className="mt-1 text-[11px] font-mono text-muted-foreground">
            All locked by default · 1 Flare Grudge Token unlock · 3 free weekly · Grudge Warlords 24 · Toon-RTS baked anims
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Tokens</p>
          <p className="font-mono text-2xl text-[#c5a059]">{tokens}</p>
          <Flame className="ml-auto h-6 w-6 text-[#c5a059]/60" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-[#c5a059]/20 bg-gradient-to-b from-[#1a1410]/80 to-black/60">
          <div className="relative h-[420px] w-full bg-[radial-gradient(ellipse_at_center,_rgba(197,160,89,0.12),_transparent_70%)]">
            <FighterPreview
              ref={previewRef}
              skinId={selected.skinId}
              fighterId={selected.id}
              tuning={assetTuning}
              pauseRotation={!previewSpin}
              freezePose={tunerOpen}
              onMeshesReady={setMeshNames}
              onClipsReady={(clips) => setClipNames(clips.length ? clips : [...RACALVIN_ANIMS])}
              onHandBoneReady={setHandBoneName}
            />
            <button
              type="button"
              title={previewSpin ? "Stop preview spin" : "Resume preview spin"}
              aria-label={previewSpin ? "Stop preview spin" : "Resume preview spin"}
              onClick={() => setPreviewSpin((s) => !s)}
              className="absolute right-14 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[#c5a059]/50 bg-black/80 text-[#c5a059] shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-[#c5a059]/20 hover:text-[#e8c87a]"
            >
              {previewSpin ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
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
              previewSpin={previewSpin}
              onPreviewSpinChange={setPreviewSpin}
              handBoneName={handBoneName}
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
            <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest">
              {selectedOwned && (
                <span className="rounded border border-[#c5a059]/40 bg-[#c5a059]/10 px-2 py-1 text-[#c5a059]">
                  Owned · Lv {selectedLevel}
                </span>
              )}
              {selectedWeekly && !selectedOwned && (
                <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                  Weekly free · levels not saved
                </span>
              )}
              {!selectedPlayable && (
                <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-300">
                  Locked · 1 token
                </span>
              )}
            </div>
            {!selectedOwned && (
              <button
                type="button"
                onClick={unlock}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/50 bg-primary/10 py-2.5 font-serif text-xs uppercase tracking-widest text-primary transition hover:bg-primary/20"
              >
                <Unlock className="h-4 w-4" />
                Unlock with 1 Flare Grudge Token ({tokens} left)
              </button>
            )}
            <button
              onClick={confirm}
              disabled={!selectedPlayable}
              className="group flex w-full items-center justify-center gap-2 rounded-md border border-[#c5a059]/40 bg-gradient-to-b from-[#3a2a12] to-[#1a1208] py-3 font-serif text-sm uppercase tracking-widest text-[#c5a059] transition hover:from-[#4a3618] hover:to-[#241a0c] hover:text-[#e8c87a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedPlayable ? (
                <>
                  <Check className="h-4 w-4" />
                  Fight as {selected.name}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Locked
                </>
              )}
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto pr-1 self-start">
          <div>
            <p className="mb-2 font-serif text-[10px] uppercase tracking-[0.25em] text-[#c5a059]">
              Grudge Warlords 24 — Toon RTS
            </p>
            <p className="mb-2 text-[10px] text-muted-foreground font-mono">
              6 races × Warrior / Mage / Ranger / Worge · CDN meshes · class wardrobe · baked Bip001 clips
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {grudge24.map((f) => (
                <FighterCard
                  key={f.id}
                  f={f}
                  active={f.id === selectedId}
                  onSelect={() => onSelectFighter(f.id)}
                />
              ))}
            </div>
          </div>

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