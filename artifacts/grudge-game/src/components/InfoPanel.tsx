/**
 * Pop-out info drawer — game overview, deploy path, upgrades, controls, fleet.
 * Opened from Shell (? / Help), Home chips, DeployFunnel, SystemHub.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INFO_TABS,
  type InfoTabId,
  GAME_OVERVIEW,
  DEPLOY_GUIDE,
  UPGRADES_GUIDE,
  CONTROLS_GUIDE,
  FLEET_GUIDE,
} from "@/data/gameInfo";
import { getDeployReadiness } from "@/data/deployFunnel";
import {
  economySummary,
  getFlareTokens,
  BOSSES_PER_TOKEN,
} from "@/data/flareEconomy";
import { getActiveFighter } from "@/data/fighters";
import { getWallet } from "@/data/wallet";
import {
  BookOpen,
  Rocket,
  Sparkles,
  Keyboard,
  Network,
  ExternalLink,
  ChevronRight,
  Swords,
  Check,
  Circle,
  Flame,
  HelpCircle,
} from "lucide-react";

const GOLD = "#c5a059";

const TAB_ICONS: Record<InfoTabId, typeof BookOpen> = {
  game: BookOpen,
  deploy: Rocket,
  upgrades: Sparkles,
  controls: Keyboard,
  fleet: Network,
};

export function InfoPanel({
  open,
  onOpenChange,
  initialTab = "game",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: InfoTabId;
}) {
  const [tab, setTab] = useState<InfoTabId>(initialTab);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const go = (href: string) => {
    onOpenChange(false);
    setLocation(href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-l border-primary/30 bg-[#0c0a08]/98 p-0 flex flex-col gap-0 shadow-[-12px_0_48px_-16px_rgba(197,160,89,0.25)]"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 space-y-1 text-left">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-primary/20 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="font-serif text-lg uppercase tracking-widest text-primary">
                Field Manual
              </SheetTitle>
              <SheetDescription className="font-serif text-[11px] tracking-wide">
                Game · deploy · upgrades · controls · fleet
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto shrink-0">
          {INFO_TABS.map((t) => {
            const Icon = TAB_ICONS[t.id];
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors",
                  active
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "text-muted-foreground border border-transparent hover:border-border/50 hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {tab === "game" && <GameTab onGo={go} />}
          {tab === "deploy" && <DeployTab onGo={go} />}
          {tab === "upgrades" && <UpgradesTab onGo={go} />}
          {tab === "controls" && <ControlsTab />}
          {tab === "fleet" && <FleetTab onGo={go} />}
        </div>

        <div className="shrink-0 border-t border-border/40 px-4 py-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 font-serif text-[10px] tracking-widest border-primary/40"
            onClick={() => go("/")}
          >
            War Panel
          </Button>
          <Button
            size="sm"
            className="flex-1 font-serif text-[10px] tracking-widest"
            style={{ background: GOLD, color: "#1a1208" }}
            onClick={() => go("/game")}
          >
            <Swords className="h-3.5 w-3.5 mr-1.5" />
            Enter World
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Compact trigger button for headers / cards. */
export function InfoTrigger({
  onClick,
  label = "Info",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  const iconOnly = label === "?" || label === "";
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-8 gap-1.5 font-serif text-[10px] tracking-widest border-primary/40 hover:bg-primary/10",
        className,
      )}
      aria-label="Open field manual"
    >
      <HelpCircle className="h-3.5 w-3.5" />
      {!iconOnly && (
        <>
          {label}
          <kbd className="pointer-events-none hidden sm:inline rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
            ?
          </kbd>
        </>
      )}
    </Button>
  );
}

/** Global host — mount once in App so Shell, game, boss, and camp can open the manual. */
export function InfoPanelHost() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InfoTabId>("game");

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: InfoTabId }>).detail;
      setTab(detail?.tab ?? "game");
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (
        (e.key === "?" || (e.code === "Slash" && e.shiftKey)) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("flare:open-info", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("flare:open-info", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return <InfoPanel open={open} onOpenChange={setOpen} initialTab={tab} />;
}

function GameTab({ onGo }: { onGo: (h: string) => void }) {
  const fighter = getActiveFighter();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-base uppercase tracking-widest" style={{ color: GOLD }}>
          {GAME_OVERVIEW.title}
        </h3>
        <p className="mt-1 text-[11px] font-mono text-muted-foreground">{GAME_OVERVIEW.tagline}</p>
      </div>
      {GAME_OVERVIEW.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} className="text-sm text-muted-foreground font-serif leading-relaxed">
          {p}
        </p>
      ))}
      <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] font-mono">
        Active fighter{" "}
        <span className="text-primary">{fighter.name}</span>
        {fighter.featured ? " · featured" : ""}
      </div>
      <div>
        <h4 className="font-serif text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Modes
        </h4>
        <div className="space-y-1.5">
          {GAME_OVERVIEW.modes.map((m) => (
            <button
              key={m.href}
              type="button"
              onClick={() => onGo(m.href)}
              className="w-full flex items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2.5 text-left hover:border-primary/40 transition-colors"
            >
              <Flame className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm tracking-wide">{m.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{m.note}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeployTab({ onGo }: { onGo: (h: string) => void }) {
  const ready = getDeployReadiness();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-base uppercase tracking-widest" style={{ color: GOLD }}>
          {DEPLOY_GUIDE.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground font-serif">
          {ready.resume
            ? `You have a run in progress (Round ${ready.islandRound} · ${ready.islandPhase.replace(/_/g, " ")}).`
            : "Prepare once, then deploy. Optional steps still power you up."}
        </p>
      </div>

      <Button
        className="w-full font-serif tracking-widest"
        style={{ background: GOLD, color: "#1a1208" }}
        disabled={!ready.canDeploy}
        onClick={() => onGo(ready.deployHref)}
      >
        <Swords className="h-4 w-4 mr-2" />
        {ready.deployLabel}
      </Button>

      <div className="space-y-1.5">
        {ready.steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onGo(s.route)}
            className="w-full flex items-center gap-3 rounded-md border border-border/40 bg-card/30 px-3 py-2 text-left hover:border-primary/40"
          >
            {s.done ? (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xs uppercase tracking-widest">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.note}</p>
            </div>
            <span className="text-[9px] font-mono uppercase text-muted-foreground/70">{s.status}</span>
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {DEPLOY_GUIDE.tips.map((tip) => (
          <li
            key={tip.slice(0, 28)}
            className="text-[11px] text-muted-foreground font-serif leading-snug border-l-2 border-primary/30 pl-3"
          >
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpgradesTab({ onGo }: { onGo: (h: string) => void }) {
  const tokens = getFlareTokens();
  const wallet = getWallet();
  const econ = economySummary();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-base uppercase tracking-widest" style={{ color: GOLD }}>
          {UPGRADES_GUIDE.title}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatChip label="Flare Tokens" value={String(tokens)} />
        <StatChip label="GBUX" value={String(wallet.gbux ?? econ.gbux ?? 0)} />
        <StatChip
          label="Boss → token"
          value={`${econ.bossProgress ?? 0}/${econ.bossesPerToken ?? BOSSES_PER_TOKEN}`}
        />
        <StatChip label="Owned fighters" value={String(econ.ownedCount ?? 0)} />
      </div>

      <div>
        <h4 className="font-serif text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Economy
        </h4>
        <div className="space-y-2">
          {UPGRADES_GUIDE.economy.map((e) => (
            <div key={e.label} className="rounded-md border border-border/40 bg-card/30 px-3 py-2">
              <p className="font-serif text-xs uppercase tracking-widest text-primary">{e.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-serif leading-snug">{e.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-serif text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Power paths
        </h4>
        <div className="space-y-1.5">
          {UPGRADES_GUIDE.power.map((p) => (
            <button
              key={p.route}
              type="button"
              onClick={() => onGo(p.route)}
              className="w-full flex items-center gap-3 rounded-md border border-border/40 bg-card/30 px-3 py-2.5 text-left hover:border-primary/40"
            >
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm tracking-wide">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.detail}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full font-serif text-[10px] tracking-widest border-primary/40"
        onClick={() => onGo("/account")}
      >
        Open Account & Wallet
      </Button>
    </div>
  );
}

function ControlsTab() {
  return (
    <div className="space-y-4">
      <h3 className="font-serif text-base uppercase tracking-widest" style={{ color: GOLD }}>
        {CONTROLS_GUIDE.title}
      </h3>
      {CONTROLS_GUIDE.sections.map((sec) => (
        <div key={sec.heading}>
          <h4 className="font-serif text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            {sec.heading}
          </h4>
          <div className="rounded-md border border-border/40 overflow-hidden">
            {sec.rows.map((row, i) => (
              <div
                key={row.keys}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2 text-[11px]",
                  i % 2 === 0 ? "bg-card/40" : "bg-background/20",
                )}
              >
                <kbd className="font-mono text-primary shrink-0 border border-primary/30 rounded px-1.5 py-0.5 bg-primary/10">
                  {row.keys}
                </kbd>
                <span className="text-muted-foreground font-serif text-right">{row.action}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <ul className="space-y-2">
        {CONTROLS_GUIDE.combatTips.map((t) => (
          <li
            key={t.slice(0, 24)}
            className="text-[11px] text-muted-foreground font-serif leading-snug border-l-2 border-primary/30 pl-3"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FleetTab({ onGo }: { onGo: (h: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-base uppercase tracking-widest" style={{ color: GOLD }}>
          {FLEET_GUIDE.title}
        </h3>
        <a
          href={FLEET_GUIDE.deployUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono text-primary hover:underline"
        >
          {FLEET_GUIDE.deployUrl}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="space-y-1.5">
        {FLEET_GUIDE.services.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md border border-border/40 bg-card/30 px-3 py-2 hover:border-primary/40 transition-colors"
          >
            <Network className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xs uppercase tracking-widest">{s.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.note}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
          </a>
        ))}
      </div>

      <ul className="space-y-2">
        {FLEET_GUIDE.notes.map((n) => (
          <li
            key={n.slice(0, 28)}
            className="text-[11px] text-muted-foreground font-serif leading-snug border-l-2 border-primary/30 pl-3"
          >
            {n}
          </li>
        ))}
      </ul>

      <Button
        variant="outline"
        className="w-full font-serif text-[10px] tracking-widest border-primary/40"
        onClick={() => onGo("/connections")}
      >
        Open Connections probe
      </Button>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/40 px-3 py-2">
      <p className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-serif text-lg text-primary mt-0.5">{value}</p>
    </div>
  );
}

