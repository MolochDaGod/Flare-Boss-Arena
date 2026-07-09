import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Flame, LayoutGrid, Menu } from "lucide-react";
import { NAV_SECTIONS, SYSTEMS_HOTKEY } from "@/data/gameFlow";
import { SystemHub } from "@/components/SystemHub";
import { getWallet } from "@/data/wallet";
import { getActiveFighter } from "@/data/fighters";
import { getPartyAllyIds } from "@/data/grudge6Roster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [hubOpen, setHubOpen] = useState(false);
  const wallet = getWallet();
  const fighter = getActiveFighter();
  const partyCount = getPartyAllyIds().length;

  // Global M opens systems hub (when not typing in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === SYSTEMS_HOTKEY && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setHubOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-background text-foreground selection:bg-primary/30">
        <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur">
          <SidebarHeader className="py-5 px-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-[0_0_16px_-2px_rgba(197,160,89,0.5)]">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-primary uppercase tracking-widest leading-none">
                  Flare Boss
                </h1>
                <h2 className="text-[10px] font-sans text-muted-foreground uppercase tracking-[0.2em] leading-none mt-1">
                  Grudge Studio
                </h2>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between font-serif tracking-widest text-xs border-primary/40 hover:bg-primary/10"
              onClick={() => setHubOpen(true)}
            >
              <span className="flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5" />
                All Systems
              </span>
              <kbd className="pointer-events-none rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                M
              </kbd>
            </Button>
          </SidebarHeader>

          <SidebarContent>
            {NAV_SECTIONS.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="text-[10px] font-serif uppercase tracking-[0.2em] text-muted-foreground">
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const active = location === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.description ?? item.label}
                            className={cn(item.primary && "text-primary")}
                          >
                            <Link href={item.href} className="flex items-center gap-3">
                              <item.icon className="w-4 h-4 shrink-0" />
                              <span className="font-serif tracking-wide truncate">{item.label}</span>
                              {item.badge && (
                                <span className="ml-auto text-[8px] font-mono uppercase text-primary border border-primary/40 rounded px-1">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-border/40 p-3 space-y-2">
            <div className="rounded-md border border-border/40 bg-background/40 px-3 py-2 text-[10px] font-mono uppercase tracking-wide text-muted-foreground space-y-1">
              <p className="truncate">
                <span className="text-muted-foreground/70">Fighter</span>{" "}
                <span className="text-primary">{fighter.name}</span>
              </p>
              <p>
                <span className="text-muted-foreground/70">Party</span>{" "}
                <span className="text-primary">{partyCount}/2</span>
                {" · "}
                <span className="text-muted-foreground/70">🪙</span>{" "}
                <span className="text-primary">{wallet.gold}</span>
              </p>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col relative overflow-hidden h-[100dvh] flex-1">
          {/* Mobile top bar */}
          <header className="flex md:hidden items-center gap-2 border-b border-border/40 px-3 py-2 bg-background/80 backdrop-blur sticky top-0 z-20">
            <SidebarTrigger className="shrink-0">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <p className="font-serif text-xs uppercase tracking-widest text-primary flex-1 truncate">
              Flare Boss
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] font-serif tracking-widest border-primary/40"
              onClick={() => setHubOpen(true)}
            >
              Systems
            </Button>
          </header>

          <div className="pointer-events-none fixed inset-0 opacity-[0.015] mix-blend-overlay z-50 bg-[url('https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev/noise.png')] bg-repeat" />
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl mx-auto p-4 md:p-8 h-full">{children}</div>
          </div>
        </SidebarInset>

        <SystemHub open={hubOpen} onOpenChange={setHubOpen} />
      </div>
    </SidebarProvider>
  );
}
