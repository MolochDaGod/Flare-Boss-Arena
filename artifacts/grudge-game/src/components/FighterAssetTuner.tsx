import { useMemo, useState } from "react";
import { Copy, Move3d, Pause, Play, RotateCw, RotateCcw, Scaling, Settings2, Swords } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RACALVIN_ID } from "@/data/fighters";
import {
  type FighterAssetTuning,
  type HiddenMeshRule,
  type WeaponMountTuning,
  MIXAMO_SWORD_HELD,
  MIXAMO_SWORD_REST,
  defaultTuningFor,
  resetFighterAssetTuning,
  saveFighterAssetTuning,
} from "@/data/fighterAssetTuning";
import { useToast } from "@/hooks/use-toast";

export type RacalvinWeaponPreview = "swordHeld" | "swordRest" | "pistol";

export interface FighterAssetTunerProps {
  fighterId: string;
  fighterName: string;
  tuning: FighterAssetTuning;
  meshNames: string[];
  clipNames: string[];
  weaponPreview: RacalvinWeaponPreview;
  onTuningChange: (next: FighterAssetTuning) => void;
  onWeaponPreviewChange: (mode: RacalvinWeaponPreview) => void;
  onPreviewClip: (clip: string) => void;
  onOpenChange?: (open: boolean) => void;
  previewSpin: boolean;
  onPreviewSpinChange: (spin: boolean) => void;
  handBoneName?: string | null;
}

type EditorTab = RacalvinWeaponPreview | "meshes";

function clampNum(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function AxisSliders({
  title,
  values,
  min,
  max,
  step,
  labels,
  onChange,
}: {
  title: string;
  values: [number, number, number];
  min: number;
  max: number;
  step: number;
  labels: [string, string, string];
  onChange: (next: [number, number, number]) => void;
}) {
  const setAxis = (i: number, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const next = [...values] as [number, number, number];
    next[i] = clampNum(n, min, max);
    onChange(next);
  };

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/35 p-3">
      <p className="font-serif text-[10px] uppercase tracking-widest text-[#c5a059]/90">{title}</p>
      {values.map((v, i) => (
        <div key={labels[i]} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
            <span className="shrink-0">{labels[i]}</span>
            <Input
              type="number"
              step={step}
              value={Number.isFinite(v) ? String(v) : "0"}
              onChange={(e) => setAxis(i, e.target.value)}
              className="h-7 w-[5.5rem] border-white/15 bg-black/50 px-2 py-0 text-right text-[10px] font-mono"
            />
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[clampNum(v, min, max)]}
            onValueChange={([nv]) => {
              const next = [...values] as [number, number, number];
              next[i] = nv;
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ScalarControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt = (v: number) => v.toFixed(3),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  const setValue = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(clampNum(n, min, max));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
        <span>{label}</span>
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? String(value) : "0"}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-[5.5rem] border-white/15 bg-black/50 px-2 py-0 text-right text-[10px] font-mono"
        />
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[clampNum(value, min, max)]}
        onValueChange={([nv]) => onChange(nv)}
      />
    </div>
  );
}

function WeaponEditor({
  label,
  hint,
  weapon,
  onChange,
  onApplyPreset,
  onCopyFrom,
}: {
  label: string;
  hint: string;
  weapon: WeaponMountTuning;
  onChange: (w: WeaponMountTuning) => void;
  onApplyPreset?: () => void;
  onCopyFrom?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-sm uppercase tracking-widest text-[#e8c87a]">{label}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {onApplyPreset && (
            <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={onApplyPreset}>
              Mixamo preset
            </Button>
          )}
          {onCopyFrom && (
            <Button size="sm" variant="ghost" className="h-7 text-[9px] text-muted-foreground" onClick={onCopyFrom}>
              Copy other grip
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Move3d className="h-3.5 w-3.5 text-[#c5a059]" />
        <span className="font-serif uppercase tracking-widest">Position</span>
      </div>
      <AxisSliders
        title="Local offset on hand bone"
        values={weapon.position}
        min={-2}
        max={2}
        step={0.002}
        labels={["X", "Y", "Z"]}
        onChange={(position) => onChange({ ...weapon, position })}
      />

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <RotateCw className="h-3.5 w-3.5 text-[#c5a059]" />
        <span className="font-serif uppercase tracking-widest">Rotation</span>
      </div>
      <AxisSliders
        title="Euler degrees"
        values={weapon.rotation}
        min={-360}
        max={360}
        step={0.25}
        labels={["Pitch X", "Yaw Y", "Roll Z"]}
        onChange={(rotation) => onChange({ ...weapon, rotation })}
      />

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Scaling className="h-3.5 w-3.5 text-[#c5a059]" />
        <span className="font-serif uppercase tracking-widest">Scale</span>
      </div>
      <div className="space-y-2 rounded-lg border border-white/10 bg-black/35 p-3">
        <ScalarControl
          label="Weapon length"
          value={weapon.targetLength}
          min={0.02}
          max={5}
          step={0.01}
          onChange={(targetLength) => onChange({ ...weapon, targetLength })}
          fmt={(v) => v.toFixed(2)}
        />
        <ScalarControl
          label="Grip offset Y"
          value={weapon.gripYOffset}
          min={-1}
          max={1}
          step={0.002}
          onChange={(gripYOffset) => onChange({ ...weapon, gripYOffset })}
        />
      </div>
    </div>
  );
}

function MeshRuleRow({
  meshName,
  rule,
  clipNames,
  onChange,
}: {
  meshName: string;
  rule: HiddenMeshRule;
  clipNames: string[];
  onChange: (r: HiddenMeshRule) => void;
}) {
  const toggleClip = (clip: string) => {
    const has = rule.showOnClips.includes(clip);
    onChange({
      ...rule,
      showOnClips: has ? rule.showOnClips.filter((c) => c !== clip) : [...rule.showOnClips, clip],
    });
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-[10px]">
      <p className="truncate font-mono text-foreground">{meshName}</p>
      <label className="mt-1 flex items-center gap-2 text-muted-foreground">
        <input
          type="checkbox"
          checked={rule.alwaysVisible}
          onChange={(e) => onChange({ ...rule, alwaysVisible: e.target.checked })}
        />
        Always visible
      </label>
      {!rule.alwaysVisible && (
        <div className="mt-2 flex flex-wrap gap-1">
          {clipNames.map((clip) => (
            <button
              key={clip}
              type="button"
              onClick={() => toggleClip(clip)}
              className={`rounded px-1.5 py-0.5 font-mono uppercase ${
                rule.showOnClips.includes(clip)
                  ? "bg-[#c5a059]/25 text-[#e8c87a] ring-1 ring-[#c5a059]/50"
                  : "bg-black/50 text-muted-foreground"
              }`}
            >
              {clip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const RACALVIN_TABS: { id: EditorTab; label: string; short: string }[] = [
  { id: "swordHeld", label: "Sword — held", short: "Held" },
  { id: "swordRest", label: "Sword — rest", short: "Rest" },
  { id: "pistol", label: "Pistol", short: "Pistol" },
  { id: "meshes", label: "Hidden parts", short: "Meshes" },
];

export function FighterAssetTuner({
  fighterId,
  fighterName,
  tuning,
  meshNames,
  clipNames,
  weaponPreview,
  onTuningChange,
  onWeaponPreviewChange,
  onPreviewClip,
  onOpenChange,
  previewSpin,
  onPreviewSpinChange,
  handBoneName,
}: FighterAssetTunerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const setSheetOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
    if (v) onPreviewSpinChange(false);
  };
  const [tab, setTab] = useState<EditorTab>("swordHeld");

  const meshRules = useMemo(() => {
    const byName = new Map(tuning.hiddenMeshes.map((r) => [r.meshName, r]));
    return meshNames.map((name) => {
      return (
        byName.get(name) ?? {
          meshName: name,
          alwaysVisible: true,
          showOnClips: [],
        }
      );
    });
  }, [meshNames, tuning.hiddenMeshes]);

  const persist = (next: FighterAssetTuning) => {
    onTuningChange(next);
    saveFighterAssetTuning(fighterId, next);
  };

  const updateWeapon = (key: keyof FighterAssetTuning["weapons"], w: WeaponMountTuning) => {
    persist({ ...tuning, weapons: { ...tuning.weapons, [key]: w } });
  };

  const updateMeshRule = (rule: HiddenMeshRule) => {
    const rest = tuning.hiddenMeshes.filter((r) => r.meshName !== rule.meshName);
    const hiddenMeshes =
      rule.alwaysVisible && rule.showOnClips.length === 0 ? rest : [...rest, rule];
    persist({ ...tuning, hiddenMeshes });
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(tuning, null, 2));
    toast({ title: "Tuning copied", description: "JSON on clipboard." });
  };

  const reset = () => {
    resetFighterAssetTuning(fighterId);
    onTuningChange(defaultTuningFor(fighterId));
    toast({ title: "Reset", description: "Asset tuning restored to defaults." });
  };

  const selectTab = (t: EditorTab) => {
    setTab(t);
    if (t === "swordHeld" || t === "swordRest" || t === "pistol") {
      onWeaponPreviewChange(t);
    }
  };

  const showWeapons = fighterId === RACALVIN_ID;

  return (
    <Sheet open={open} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          title="Open weapon editor (move, rotate, scale)"
          aria-label="Open weapon editor"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[#c5a059]/50 bg-black/80 text-[#c5a059] shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-[#c5a059]/20 hover:text-[#e8c87a]"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="z-50 flex w-[min(460px,96vw)] flex-col gap-0 overflow-hidden border-[#c5a059]/25 bg-[#0a0806] p-0 text-foreground"
      >
        <SheetHeader className="shrink-0 border-b border-[#c5a059]/20 bg-[#0d0b09] px-6 py-4">
          <SheetTitle className="flex items-center gap-2 font-serif uppercase tracking-widest text-[#c5a059]">
            <Swords className="h-4 w-4" />
            Weapon Editor
          </SheetTitle>
          <SheetDescription className="text-[11px] leading-relaxed">
            {fighterName} — both sword grips parent to the same Mixamo{" "}
            <span className="font-mono text-emerald-300">RightHand</span> bone. Opening this panel
            freezes the idle pose for placement; drag the canvas to orbit.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {showWeapons && handBoneName && (
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2.5">
              <p className="font-serif text-[9px] uppercase tracking-widest text-emerald-400/90">
                Attach bone
              </p>
              <p className="font-mono text-xs text-emerald-100">{handBoneName}</p>
              <p className="mt-1 text-[9px] text-emerald-200/70">
                Same joint Mixamo uses for sword-and-shield packs.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/35 px-3 py-2.5">
            <div>
              <p className="font-serif text-[10px] uppercase tracking-widest text-[#c5a059]/90">
                Preview
              </p>
              <p className="text-[9px] text-muted-foreground">
                Pause spin only stops rotation — model stays visible. Stop spin to orbit the hand.
              </p>
            </div>
            <Button
              size="sm"
              variant={previewSpin ? "default" : "outline"}
              className="gap-1 text-[10px]"
              onClick={() => onPreviewSpinChange(!previewSpin)}
            >
              {previewSpin ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {previewSpin ? "Spinning" : "Stopped"}
            </Button>
          </div>

          {showWeapons && (
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
              {RACALVIN_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  className={`rounded-md px-1 py-2 font-serif text-[9px] uppercase leading-tight tracking-wide ${
                    tab === t.id
                      ? "bg-[#c5a059]/30 text-[#e8c87a] ring-1 ring-[#c5a059]/55"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {t.short}
                </button>
              ))}
            </div>
          )}

          {showWeapons && tab === "swordHeld" && (
            <WeaponEditor
              label="Brothers' Keeper — combat grip"
              hint="Used during attack, combo, hammer, and cast clips. Matches Mixamo sword-and-shield right-hand orientation."
              weapon={tuning.weapons.swordHeld}
              onChange={(w) => updateWeapon("swordHeld", w)}
              onApplyPreset={() => updateWeapon("swordHeld", { ...MIXAMO_SWORD_HELD })}
              onCopyFrom={() => updateWeapon("swordHeld", { ...tuning.weapons.swordRest })}
            />
          )}

          {showWeapons && tab === "swordRest" && (
            <WeaponEditor
              label="Brothers' Keeper — rest grip"
              hint="Used during idle, walk, run, dodge, and hit. Blade rests along the leg on the same hand bone."
              weapon={tuning.weapons.swordRest}
              onChange={(w) => updateWeapon("swordRest", w)}
              onApplyPreset={() => updateWeapon("swordRest", { ...MIXAMO_SWORD_REST })}
              onCopyFrom={() => updateWeapon("swordRest", { ...tuning.weapons.swordHeld })}
            />
          )}

          {showWeapons && tab === "pistol" && (
            <WeaponEditor
              label="Corsair Pistol"
              hint="Shown on psychic skills and Mind Shot. Shares the right hand mount."
              weapon={tuning.weapons.pistol}
              onChange={(w) => updateWeapon("pistol", w)}
            />
          )}

          {(tab === "meshes" || !showWeapons) && (
            <div className="space-y-2">
              <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
                Hide parts until an animation reveals them
              </p>
              {meshRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">Waiting for model meshes…</p>
              ) : (
                meshRules.map((rule) => (
                  <MeshRuleRow
                    key={rule.meshName}
                    meshName={rule.meshName}
                    rule={rule}
                    clipNames={clipNames}
                    onChange={updateMeshRule}
                  />
                ))
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
              Test animation clip
            </p>
            <p className="text-[9px] text-muted-foreground">
              Resume spin first, then pick a clip to see held vs rest swap in motion.
            </p>
            <div className="flex flex-wrap gap-1">
              {clipNames.map((clip) => (
                <button
                  key={clip}
                  type="button"
                  onClick={() => onPreviewClip(clip)}
                  className="rounded-md bg-black/50 px-2 py-1 font-mono text-[9px] uppercase text-[#c5a059] ring-1 ring-transparent transition hover:bg-[#c5a059]/15 hover:ring-[#c5a059]/30"
                >
                  {clip}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex gap-2 border-t border-white/10 bg-[#0d0b09] px-6 py-4">
          <Button size="sm" variant="outline" className="flex-1 gap-1 text-[10px]" onClick={copyJson}>
            <Copy className="h-3 w-3" /> Copy JSON
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1 text-[10px]" onClick={reset}>
            <RotateCcw className="h-3 w-3" /> Reset defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}