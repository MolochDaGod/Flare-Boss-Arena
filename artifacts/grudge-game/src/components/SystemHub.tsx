/**
 * System Hub — searchable panel of every game system.
 * Opened from Shell (M key / button) or Escape overlay in game modes.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ALL_NAV_ITEMS, NAV_SECTIONS, PLAY_LOOP, type NavItem } from "@/data/gameFlow";
import { getWallet } from "@/data/wallet";
import { getActiveFighter } from "@/data/fighters";
import { getPartyAllyIds, getGrudge6Hero } from "@/data/grudge6Roster";
import { getEquippedStones } from "@/data/stones";
import { Search, Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const GOLD = "#c5a059";

export function SystemHub({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [location, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const wallet = getWallet();
  const fighter = getActiveFighter();
  const party = getPartyAllyIds().map((id) => getGrudge6Hero(id)?.displayName ?? id);
  const stones = getEquippedStones().length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return ALL_NAV_ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        i.description?.toLowerCase().includes(needle) ||
        i.href.includes(needle),
    );
  }, [q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    setLocation(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[min(90dvh,720px)] overflow-hidden border-primary/30 bg-[#0c0a08]/98 p-0 gap-0 shadow-[0_0_60px_-12px_rgba(197,160,89,0.35)]"
        style={{ borderColor: `${GOLD}44` }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-primary/20 flex items-center justify-center">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-serif text-xl uppercase tracking-widest text-primary">
                Systems
              </DialogTitle>
              <DialogDescription className="font-serif text-xs tracking-wide">
                Every panel & mode · press M anytime
              </DialogDescription>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stones, party, boss, wallet…"
              className="pl-9 font-serif bg-background/60 border-border/50"
            />
          </div>
          {/* Live status strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono uppercase text-muted-foreground">
            <span>
              Fighter <span className="text-primary">{fighter.name}</span>
            </span>
            <span>
              Party{" "}
              <span className="text-primary">
                {party.length ? party.join(" · ") : "none"}
              </span>
            </span>
            <span>
              Stones <span className="text-primary">{stones}/8</span>
            </span>
            <span>
              🪙 <span className="text-primary">{wallet.gold}</span>
            </span>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[min(58dvh,480px)] px-4 py-4 space-y-5">
          {filtered ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground font-serif px-2">
                  No systems match “{q}”.
                </p>
              ) : (
                filtered.map((item) => (
                  <SystemCard
                    key={item.href}
                    item={item}
                    active={location === item.href}
                    onClick={() => go(item.href)}
                  />
                ))
              )}
            </div>
          ) : (
            <>
              {NAV_SECTIONS.map((section) => (
                <div key={section.label}>
                  <div className="flex items-baseline justify-between mb-2 px-1">
                    <h3 className="font-serif text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      {section.label}
                    </h3>
                    {section.blurb && (
                      <span className="text-[10px] font-mono text-muted-foreground/60">{section.blurb}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {section.items.map((item) => (
                      <SystemCard
                        key={item.href}
                        item={item}
                        active={location === item.href}
                        onClick={() => go(item.href)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <h3 className="font-serif text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2 px-1">
                  Recommended loop
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {PLAY_LOOP.map((step) => (
                    <button
                      key={step.step}
                      type="button"
                      onClick={() => go(step.route)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-3 py-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <span className="text-primary/80">{step.step}</span>
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SystemCard({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all",
        "bg-card/40 hover:bg-primary/10 hover:border-primary/40",
        active ? "border-primary/60 ring-1 ring-primary/30" : "border-border/40",
        item.primary && !active && "border-primary/30",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border",
          active ? "border-primary/50 bg-primary/20 text-primary" : "border-border/50 bg-background/50 text-muted-foreground group-hover:text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-serif text-sm tracking-wide text-foreground">{item.label}</span>
          {item.badge && (
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
              {item.badge}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground font-serif leading-snug">{item.description}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary mt-1" />
    </button>
  );
}

/** Escape / pause menu for fullscreen game modes (no Shell sidebar). */
export function GameEscapeMenu({
  open,
  onOpenChange,
  onResume,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResume?: () => void;
}) {
  const [, setLocation] = useLocation();

  const quick: NavItem[] = [
    ALL_NAV_ITEMS.find((i) => i.href === "/")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/party")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/equipment")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/skills")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/perks")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/account")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/boss")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/camp")!,
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) onResume?.();
      }}
    >
      <DialogContent className="max-w-md border-primary/30 bg-[#0c0a08]/98">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl uppercase tracking-widest text-primary text-center">
            Pause
          </DialogTitle>
          <DialogDescription className="text-center font-serif text-xs">
            Esc resume · M full systems
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {quick.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-2 py-3 hover:border-primary/40 hover:bg-primary/10 transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  setLocation(item.href);
                }}
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="font-serif text-[11px] tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="w-full h-11 rounded font-serif tracking-widest uppercase text-sm"
          style={{ background: GOLD, color: "#1a1208" }}
          onClick={() => {
            onOpenChange(false);
            onResume?.();
          }}
        >
          Resume
        </button>
      </DialogContent>
    </Dialog>
  );
}
