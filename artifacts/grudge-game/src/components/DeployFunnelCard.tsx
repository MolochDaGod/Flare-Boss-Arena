import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDeployReadiness } from "@/data/deployFunnel";
import { openInfoPanel } from "@/data/gameInfo";
import { Swords, ChevronRight, Check, Circle, Anchor, HelpCircle } from "lucide-react";

const GOLD = "#c5a059";

export function DeployFunnelCard() {
  const [, setLocation] = useLocation();
  const ready = getDeployReadiness();

  return (
    <Card className="border-primary/35 bg-gradient-to-br from-card/90 to-black/40 shadow-[0_0_28px_-8px_rgba(197,160,89,0.35)]">
      <CardHeader className="border-b border-primary/20 pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 font-serif text-sm uppercase tracking-widest" style={{ color: GOLD }}>
          <Anchor className="h-4 w-4" />
          Deploy Funnel
        </CardTitle>
        <button
          type="button"
          onClick={() => openInfoPanel("deploy")}
          className="inline-flex items-center gap-1 rounded border border-primary/30 px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:text-primary"
        >
          <HelpCircle className="h-3 w-3" />
          How
        </button>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-lg uppercase tracking-wide text-foreground">
              {ready.resume ? `Island Round ${ready.islandRound}` : "First sortie"}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              Phase: {ready.islandPhase.replace("_", " ")}
              {ready.recommended ? ` · Next: ${ready.recommended.label}` : " · Ready to deploy"}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!ready.canDeploy}
            className="font-serif tracking-widest bg-primary text-primary-foreground shadow-[0_0_18px_-4px_rgba(255,165,0,0.45)]"
            onClick={() => setLocation(ready.deployHref)}
          >
            <Swords className="mr-2 h-5 w-5" />
            {ready.deployLabel}
          </Button>
        </div>

        <div className="grid gap-2">
          {ready.steps.map((step) => (
            <Link
              key={step.id}
              href={step.route}
              className="group flex items-center gap-3 rounded border border-border/30 bg-background/40 px-3 py-2 transition-colors hover:border-primary/40"
            >
              {step.done ? (
                <Check className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xs uppercase tracking-widest text-foreground">{step.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{step.note}</p>
              </div>
              <span className="text-[9px] font-mono uppercase text-muted-foreground/70">{step.status}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}