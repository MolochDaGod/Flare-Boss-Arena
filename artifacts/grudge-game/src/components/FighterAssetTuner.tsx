import { useMemo, useState } from "react";
import { Copy, Move3d, RotateCw, RotateCcw, Scaling, Settings2 } from "lucide-react";
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
  defaultTuningFor,
  resetFighterAssetTuning,
  saveFighterAssetTuning,
} from "@/data/fighterAssetTuning";
import { useToast } from "@/hooks/use-toast";

export interface FighterAssetTunerProps {
  fighterId: string;
  fighterName: string;
  tuning: FighterAssetTuning;
  meshNames: string[];
  clipNames: string[];
  weaponPreview: "sword" | "pistol";
  onTuningChange: (next: FighterAssetTuning) => void;
  onWeaponPreviewChange: (mode: "sword" | "pistol") => void;
  onPreviewClip: (clip: string) => void;
  onOpenChange?: (open: boolean) => void;
}

function AxisSliders({
  title,
  values,
  min,
  max,
  step,
  labels,
  onChange,
  fmt = (v: number) => String(v),
}: {
  title: string;
  values: [number, number, number];
  min: number;
  max: number;
  step: number;
  labels: [string, string, string];
  onChange: (next: [number, number, number]) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <div className="space-y-2 rounded border border-white/10 bg-black/30 p-3">
      <p className="font-serif text-[10px] uppercase tracking-widest text-[#c5a059]/90">{title}</p>
      {values.map((v, i) => (
        <div key={labels[i]} className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>{labels[i]}</span>
            <span>{fmt(v)}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[v]}
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

function WeaponEditor({
  label,
  weapon,
  onChange,
}: {
  label: string;
  weapon: WeaponMountTuning;
  onChange: (w: WeaponMountTuning) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-serif text-xs uppercase tracking-widest text-[#e8c87a]">{label}</p>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Move3d className="h-3.5 w-3.5 text-[#c5a059]" />
        <span className="font-serif uppercase tracking-widest">Move</span>
      </div>
      <AxisSliders
        title="Position (hand local)"
        values={weapon.position}
        min={-0.35}
        max={0.35}
        step={0.005}
        labels={["X", "Y", "Z"]}
        onChange={(position) => onChange({ ...weapon, position })}
        fmt={(v) => v.toFixed(3)}
      />

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <RotateCw className="h-3.5 w-3.5 text-[#c5a059]" />
        <span className="font-serif uppercase tracking-widest">Rotate</span>
      </div>
      <AxisSliders
        title="Rotation (degrees)"
        values={weapon.rotation}
        min={-180}
        max={180}
        step={0.5}
        labels={["Pitch X", "Yaw Y", "Roll Z"]}
        onChange={(rotation) => onChange({ ...weapon, rotation })}
        fmt={(v) => `${v.toFixed(1)}°`}
      />

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Scaling className="h-3.5 w-3.5 text-[#c5a059]" />
        <span className="font-serif uppercase tracking-widest">Scale</span>
      </div>
      <div className="space-y-2 rounded border border-white/10 bg-black/30 p-3">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Weapon length</span>
            <span>{weapon.targetLength.toFixed(2)}</span>
          </div>
          <Slider
            min={0.08}
            max={2.5}
            step={0.01}
            value={[weapon.targetLength]}
            onValueChange={([targetLength]) => onChange({ ...weapon, targetLength })}
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Grip offset Y</span>
            <span>{weapon.gripYOffset.toFixed(3)}</span>
          </div>
          <Slider
            min={-0.2}
            max={0.2}
            step={0.005}
            value={[weapon.gripYOffset]}
            onValueChange={([gripYOffset]) => onChange({ ...weapon, gripYOffset })}
          />
        </div>
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
    <div className="rounded border border-white/10 bg-black/30 p-2 text-[10px]">
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
}: FighterAssetTunerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const setSheetOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  const [tab, setTab] = useState<"sword" | "pistol" | "meshes">("sword");

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

  const updateWeapon = (key: "sword" | "pistol", w: WeaponMountTuning) => {
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
        className="z-50 w-[min(440px,94vw)] overflow-y-auto border-[#c5a059]/25 bg-[#0a0806] text-foreground"
      >
        <SheetHeader>
          <SheetTitle className="font-serif uppercase tracking-widest text-[#c5a059]">
            Weapon Editor
          </SheetTitle>
          <SheetDescription>
            Move, rotate, and scale {fighterName}&apos;s props. Changes save automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {showWeapons && (
            <div className="flex gap-1">
              {(["sword", "pistol", "meshes"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded px-2 py-2 font-serif text-[10px] uppercase tracking-widest ${
                    tab === t
                      ? "bg-[#c5a059]/25 text-[#e8c87a] ring-1 ring-[#c5a059]/50"
                      : "bg-black/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "meshes" ? "Hidden parts" : t}
                </button>
              ))}
            </div>
          )}

          {showWeapons && tab !== "meshes" && (
            <>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={weaponPreview === "sword" ? "default" : "outline"}
                  className="flex-1 text-[10px]"
                  onClick={() => onWeaponPreviewChange("sword")}
                >
                  Show sword
                </Button>
                <Button
                  size="sm"
                  variant={weaponPreview === "pistol" ? "default" : "outline"}
                  className="flex-1 text-[10px]"
                  onClick={() => onWeaponPreviewChange("pistol")}
                >
                  Show pistol
                </Button>
              </div>
              <WeaponEditor
                label={tab === "sword" ? "Brothers' Keeper" : "Corsair Pistol"}
                weapon={tuning.weapons[tab]}
                onChange={(w) => updateWeapon(tab, w)}
              />
            </>
          )}

          {(tab === "meshes" || !showWeapons) && (
            <div className="space-y-2">
              <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
                Hide parts until an animation reveals them.
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
              Preview clip
            </p>
            <div className="flex flex-wrap gap-1">
              {clipNames.map((clip) => (
                <button
                  key={clip}
                  type="button"
                  onClick={() => onPreviewClip(clip)}
                  className="rounded bg-black/50 px-2 py-1 font-mono text-[9px] uppercase text-[#c5a059] hover:bg-[#c5a059]/15"
                >
                  {clip}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1 text-[10px]" onClick={copyJson}>
              <Copy className="h-3 w-3" /> Copy JSON
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1 text-[10px]" onClick={reset}>
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}