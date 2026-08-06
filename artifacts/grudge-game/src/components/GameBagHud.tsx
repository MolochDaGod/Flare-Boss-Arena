/**
 * In-game 10-slot bag + crew tray — craftpix slots + codex status icons.
 * Inspired by attachment-style character custom UIs (weapon / tools as slots).
 */
import { useCallback, useEffect, useState } from "react";
import {
  BAG_SLOT_COUNT,
  buildGameBagSnapshot,
  setActiveTool,
  type BagSlot,
  type GameBagSnapshot,
} from "@/data/gameBag";
import { StatusIcon, CodexPanel } from "@/components/CodexUi";
import { CODEX_FROST } from "@/data/codexUiAssets";
import { spellbookSlotUrl } from "@/data/spellbookAssets";
import { Users, Backpack, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const SLOT_BG = spellbookSlotUrl("slot_default");

function SlotCell({
  slot,
  onClick,
}: {
  slot: BagSlot;
  onClick: (s: BagSlot) => void;
}) {
  const filled = slot.kind !== "empty";
  return (
    <button
      type="button"
      title={filled ? `${slot.name}${slot.description ? `\n${slot.description}` : ""}` : "Empty slot"}
      onClick={() => onClick(slot)}
      className="relative w-11 h-11 rounded flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      style={{
        backgroundImage: `url(${SLOT_BG})`,
        backgroundSize: "100% 100%",
        imageRendering: "pixelated",
        border: slot.equipped
          ? `1px solid ${CODEX_FROST.accent}`
          : "1px solid rgba(120,190,230,0.25)",
        boxShadow: slot.equipped ? `0 0 10px ${CODEX_FROST.accent}55` : "inset 0 0 8px rgba(0,0,0,0.5)",
        opacity: filled ? 1 : 0.55,
      }}
    >
      {slot.statusIcon ? (
        <StatusIcon id={slot.statusIcon} size={22} dimmed={!filled} title={slot.name} />
      ) : filled ? (
        <span className="text-lg leading-none drop-shadow">{slot.glyph}</span>
      ) : (
        <span className="text-[14px] text-white/25 font-light">+</span>
      )}
      {slot.count != null && slot.count > 1 && (
        <span
          className="absolute bottom-0.5 right-0.5 text-[8px] font-mono px-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.7)", color: CODEX_FROST.ice }}
        >
          {slot.count}
        </span>
      )}
      <span className="absolute top-0 left-0.5 text-[7px] font-mono text-white/40">
        {slot.index + 1}
      </span>
    </button>
  );
}

export function GameBagHud(props: {
  /** Bump to refresh bag after loot */
  tick?: number;
  onUseSlot?: (slot: BagSlot) => void;
}) {
  const [open, setOpen] = useState(true);
  const [bag, setBag] = useState<GameBagSnapshot>(() => buildGameBagSnapshot());

  useEffect(() => {
    setBag(buildGameBagSnapshot());
  }, [props.tick]);

  const onSlot = useCallback(
    (slot: BagSlot) => {
      if (slot.kind === "empty") {
        toast.message("Empty slot", { description: "Loot fills bag during the run." });
        return;
      }
      if (slot.kind === "tool") {
        if (slot.id?.includes("pick")) {
          setActiveTool("pickaxe");
          toast.success("Pickaxe ready", { description: "Mine stone / ore nodes (RMB)." });
        } else if (slot.id?.includes("hatchet") || slot.glyph === "🪓") {
          setActiveTool("hatchet");
          toast.success("Hatchet ready", { description: "Chop trees (RMB)." });
        }
        setBag(buildGameBagSnapshot());
        props.onUseSlot?.(slot);
        return;
      }
      if (slot.kind === "weapon") {
        setActiveTool("weapon");
        toast.success("Weapon drawn", { description: slot.name });
        setBag(buildGameBagSnapshot());
        props.onUseSlot?.(slot);
        return;
      }
      if (slot.kind === "consumable") {
        toast.message(slot.name, { description: "Use from Main Panel (C) for now." });
        props.onUseSlot?.(slot);
        return;
      }
      toast.message(slot.name, { description: slot.description });
      props.onUseSlot?.(slot);
    },
    [props],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase"
        style={{
          background: CODEX_FROST.panelBg,
          border: `1px solid ${CODEX_FROST.panelBorder}`,
          color: CODEX_FROST.ice,
        }}
      >
        <Backpack className="w-3.5 h-3.5" />
        Bag
        <ChevronUp className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-[min(280px,92vw)]">
      <CodexPanel
        kicker={`Bag · ${BAG_SLOT_COUNT} slots`}
        title="Loadout"
        icon="lucky"
        actions={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-white p-0.5"
            title="Collapse"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        }
      >
        {/* Attachment-style weapon / tool row (from character custom mock) */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground w-10">
            Hand
          </span>
          <div className="flex gap-1">
            {bag.slots.slice(0, 4).map((s) => (
              <SlotCell key={s.index} slot={s} onClick={onSlot} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground w-10">
            Pack
          </span>
          <div className="flex gap-1 flex-wrap">
            {bag.slots.slice(4, 10).map((s) => (
              <SlotCell key={s.index} slot={s} onClick={onSlot} />
            ))}
          </div>
        </div>

        <div
          className="flex flex-wrap gap-2 text-[9px] font-mono text-muted-foreground pt-2 border-t"
          style={{ borderColor: "rgba(120,190,230,0.15)" }}
        >
          <span style={{ color: CODEX_FROST.gold }}>🪙 {bag.gold}</span>
          <span>🪵 {bag.resources.wood ?? 0}</span>
          <span>🪨 {bag.resources.stone ?? 0}</span>
          <span className="ml-auto" style={{ color: CODEX_FROST.accent }}>
            Tool: {bag.activeTool}
          </span>
        </div>

        {/* Crew tray — party allies as attachment slots */}
        <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(120,190,230,0.12)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="w-3 h-3" style={{ color: CODEX_FROST.accent }} />
            <span className="text-[9px] font-serif uppercase tracking-widest" style={{ color: CODEX_FROST.ice }}>
              Crew
            </span>
            <span className="text-[8px] font-mono text-muted-foreground ml-auto">
              {bag.crew.length}/2
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1].map((i) => {
              const c = bag.crew[i];
              return (
                <div
                  key={i}
                  className="flex-1 flex items-center gap-1.5 rounded border px-1.5 py-1 min-h-[36px]"
                  style={{
                    borderColor: c ? "rgba(120,190,230,0.35)" : "rgba(120,190,230,0.12)",
                    background: "rgba(0,0,0,0.25)",
                  }}
                >
                  {c ? (
                    <>
                      <StatusIcon
                        id={c.role === "healer" ? "regen" : c.role === "tank" ? "shield" : "strength"}
                        size={18}
                      />
                      <div className="min-w-0">
                        <p className="text-[9px] font-serif truncate text-foreground">{c.name}</p>
                        <p className="text-[7px] font-mono uppercase text-muted-foreground">{c.role}</p>
                      </div>
                    </>
                  ) : (
                    <span className="text-[9px] font-mono text-muted-foreground w-full text-center">
                      + ally
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CodexPanel>
    </div>
  );
}
