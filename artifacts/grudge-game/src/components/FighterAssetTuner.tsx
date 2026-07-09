import { useMemo, useState } from "react";
import { Copy, RotateCcw, Settings2 } from "lucide-react";
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

function WeaponSliders({
  label,
  weapon,
  onChange,
}: {
  label: string;
  weapon: WeaponMountTuning;
  onChange: (w: WeaponMountTuning) => void;
}) {
  const row = (
    key: keyof WeaponMountTuning,
    title: string,
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string = (v) => String(v),
  ) => {
    const val = weapon[key];
    const isVec = Array.isArray(val);
    if (isVec) {
      return (val as [number, number, number]).map((v, i) => (
        <div key={`${String(key)}-${i}`} className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>
              {title} {["X", "Y", "Z"][i]}
            </span>
            <span>{fmt(v)}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[v]}
            onValueChange={([nv]) => {
              const next = [...(val as [number, number, number])] as [number, number, number];
              next[i] = nv;
              onChange({ ...weapon, [key]: next });
            }}
          />
        </div>
      ));
    }
    return (
      <div key={String(key)} className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>{title}</span>
          <span>{fmt(val as number)}</span>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[val as number]}
          onValueChange={([nv]) => onChange({ ...weapon, [key]: nv })}
        />
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded border border-white/10 bg-black/40 p-3">
      <p className="font-serif text-[10px] uppercase tracking-widest text-[#c5a059]">{label}</p>
      {row("targetLength", "Length", 0.1, 2.5, 0.01, (v) => v.toFixed(2))}
      {row("position", "Position", -0.3, 0.3, 0.005, (v) => v.toFixed(3))}
      {row("rotation", "Rotation°", -180, 180, 0.5, (v) => v.toFixed(1))}
      {row("gripYOffset", "Grip Y", -0.2, 0.2, 0.005, (v) => v.toFixed(3))}
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
      rule.alwaysVisible && rule.showOnClips.length === 0
        ? rest
        : [...rest, rule];
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
          title="Asset placement & visibility"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#c5a059]/40 bg-black/70 text-[#c5a059] shadow-lg transition hover:bg-[#c5a059]/15 hover:text-[#e8c87a]"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(420px,92vw)] overflow-y-auto border-[#c5a059]/20 bg-[#0d0b09]">
        <SheetHeader>
          <SheetTitle className="font-serif uppercase tracking-widest text-[#c5a059]">
            Asset Tuner
          </SheetTitle>
          <SheetDescription>
            Place weapons and hide mesh parts until animations call for them — {fighterName}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {showWeapons && (
            <div className="flex gap-1">
              {(["sword", "pistol", "meshes"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded px-2 py-1.5 font-serif text-[10px] uppercase tracking-widest ${
                    tab === t
                      ? "bg-[#c5a059]/20 text-[#e8c87a] ring-1 ring-[#c5a059]/40"
                      : "bg-black/40 text-muted-foreground"
                  }`}
                >
                  {t === "meshes" ? "Parts" : t}
                </button>
              ))}
            </div>
          )}

          {showWeapons && tab !== "meshes" && (() => {
            const weaponKey = tab as "sword" | "pistol";
            return (
              <>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={weaponPreview === "sword" ? "default" : "outline"}
                    className="flex-1 text-[10px]"
                    onClick={() => onWeaponPreviewChange("sword")}
                  >
                    Preview sword
                  </Button>
                  <Button
                    size="sm"
                    variant={weaponPreview === "pistol" ? "default" : "outline"}
                    className="flex-1 text-[10px]"
                    onClick={() => onWeaponPreviewChange("pistol")}
                  >
                    Preview pistol
                  </Button>
                </div>
                <WeaponSliders
                  label={weaponKey === "sword" ? "Brothers' Keeper" : "Corsair Pistol"}
                  weapon={tuning.weapons[weaponKey]}
                  onChange={(w) => updateWeapon(weaponKey, w)}
                />
              </>
            );
          })()}

          {(tab === "meshes" || !showWeapons) && (
            <div className="space-y-2">
              <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
                Mesh visibility — uncheck &quot;Always visible&quot; then pick clips that reveal the part.
              </p>
              {meshRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">Load the preview to list mesh parts.</p>
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

          <div className="space-y-2">
            <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
              Preview animation
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

          <div className="flex gap-2 pt-2">
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