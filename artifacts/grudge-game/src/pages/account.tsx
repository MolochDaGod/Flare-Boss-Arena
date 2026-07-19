import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageChrome";
import { CURRENCIES, getWallet, type WalletBalances } from "@/data/wallet";
import { getActiveFighter } from "@/data/fighters";
import { ParchmentPanel } from "@/components/CraftpixUI";
import {
  Gift,
  LogIn,
  LogOut,
  Wallet,
  Link2,
  RefreshCw,
} from "lucide-react";
import { getPlayableCharacter } from "@/data/playableIdentity";
import {
  clearAuthToken,
  fetchAccountGbux,
  fetchAuthMe,
  getAccountId,
  getAuthToken,
  setAuthToken,
  startLogin,
  type AuthMe,
} from "@/data/grudgeAuth";
import {
  BOSSES_PER_TOKEN,
  GBUX_PER_TOKEN,
  buyTokenWithGbux,
  economySummary,
  getBossKillProgress,
  getFlareTokens,
  getOwnedIds,
  getWeeklyFreeIds,
  setGbux,
  STARTER_TOKENS,
} from "@/data/flareEconomy";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletBalances>(() => getWallet());
  const [me, setMe] = useState<AuthMe | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [eco, setEco] = useState(() => economySummary());
  const fighter = getActiveFighter();
  const playable = getPlayableCharacter();
  const killProg = getBossKillProgress();

  const refresh = async () => {
    const profile = await fetchAuthMe();
    setMe(profile.ok ? profile : null);
    const g = await fetchAccountGbux();
    if (g != null) setGbux(g);
    else if (profile.gbux != null) setGbux(profile.gbux);
    setWallet(getWallet());
    setEco(economySummary());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onBuyToken = () => {
    const r = buyTokenWithGbux();
    if (!r.ok) {
      toast({
        title: "Not enough GBUX",
        description: `Need ${GBUX_PER_TOKEN} GBUX for 1 Flare Grudge Token.`,
        variant: "destructive",
      });
      return;
    }
    setWallet(getWallet());
    setEco(economySummary());
    toast({
      title: "Token purchased",
      description: `1 Flare Grudge Token · balance ${r.tokens} · GBUX ${r.gbux}`,
    });
  };

  const onPasteToken = () => {
    const t = tokenDraft.trim();
    if (t.length < 12) {
      toast({ title: "Invalid token", description: "Token too short.", variant: "destructive" });
      return;
    }
    setAuthToken(t);
    toast({ title: "Token stored", description: "Verifying with production API…" });
    void refresh();
  };

  const onLogout = () => {
    clearAuthToken();
    setMe(null);
    toast({ title: "Signed out" });
  };

  const owned = getOwnedIds();
  const weekly = getWeeklyFreeIds();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Grudge Studio · Production"
        title="Account"
        subtitle="Wallet connections, GBUX, Flare Grudge Tokens, and session identity"
      />

      {/* Auth / wallet connections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ParchmentPanel className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[#c5a059]" />
            <h2 className="font-serif text-sm uppercase tracking-widest text-[#c5a059]">
              Grudge Studio connection
            </h2>
          </div>
          {getAuthToken() ? (
            <div className="space-y-3 text-sm font-serif">
              <p className="text-foreground">
                {me?.displayName ?? "Session active"}
                {me?.email ? (
                  <span className="block text-xs text-muted-foreground font-mono mt-1">{me.email}</span>
                ) : null}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Account · {getAccountId() ?? me?.grudgeId ?? me?.id ?? "linked"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="font-serif tracking-widest" onClick={() => void refresh()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Sync
                </Button>
                <Button size="sm" variant="ghost" className="font-serif tracking-widest" onClick={onLogout}>
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Grudge Studio wallet and account to load GBUX and persist owned fighters.
              </p>
              <Button className="font-serif tracking-widest" onClick={() => startLogin("/account")}>
                <LogIn className="mr-2 h-4 w-4" /> Sign in with Grudge ID
              </Button>
              <div className="space-y-2 pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-serif">
                  Or paste verified token
                </p>
                <Input
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="JWT / sso_token"
                  className="font-mono text-xs"
                />
                <Button size="sm" variant="outline" onClick={onPasteToken}>
                  Store token
                </Button>
              </div>
            </div>
          )}
        </ParchmentPanel>

        <ParchmentPanel className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#c5a059]" />
            <h2 className="font-serif text-sm uppercase tracking-widest text-[#c5a059]">
              Account GBUX & tokens
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">GBUX</p>
              <p className="font-mono text-2xl text-primary">{wallet.gbux}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Flare Grudge Tokens
              </p>
              <p className="font-mono text-2xl text-[#c5a059]">{getFlareTokens()}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {GBUX_PER_TOKEN} GBUX → 1 token · {BOSSES_PER_TOKEN} boss kills → 1 token · starter{" "}
            {STARTER_TOKENS} tokens. Owned fighters: {owned.length}. Weekly free: {weekly.length}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="font-serif tracking-widest" onClick={onBuyToken}>
              Buy token ({GBUX_PER_TOKEN} GBUX)
            </Button>
            <Button asChild size="sm" variant="outline" className="font-serif tracking-widest">
              <Link href="/select">Unlock fighters</Link>
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">
            Boss kill progress {killProg.current}/{killProg.needed} · lifetime {killProg.total}
          </p>
        </ParchmentPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ParchmentPanel className="lg:col-span-2 p-6 space-y-4">
          <h2 className="font-serif text-sm uppercase tracking-widest text-[#c5a059]">Play Profile</h2>
          <div className="grid grid-cols-2 gap-4 text-sm font-serif">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active Fighter</p>
              <p className="text-foreground">{fighter.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Level</p>
              <p className="font-mono text-primary">
                {playable.level}
                {!playable.owned && (
                  <span className="ml-2 text-[9px] text-muted-foreground uppercase">
                    (not saved — not owned)
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ownership</p>
              <p className="text-foreground">{playable.owned ? "Token owned" : "Weekly / locked"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</p>
              <p className="text-muted-foreground">{fighter.role}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="font-serif tracking-widest">
            <Link href="/select">Change fighter</Link>
          </Button>
        </ParchmentPanel>

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="font-serif text-sm uppercase tracking-widest">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="ghost" className="w-full justify-start font-serif text-xs">
              <Link href="/rewards">
                <Gift className="mr-2 h-4 w-4" /> Rewards
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start font-serif text-xs">
              <Link href="/equipment">Equipment</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start font-serif text-xs">
              <Link href="/perks">Perks</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-serif text-sm uppercase tracking-widest text-muted-foreground mb-3">
          Production wallet scheme
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CURRENCIES.map((c) => (
            <Card key={c.id} className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-4 text-center">
                <span className="text-2xl">{c.icon}</span>
                <p className="font-serif text-xs uppercase tracking-widest mt-2 text-muted-foreground">
                  {c.label}
                </p>
                <p className="font-mono text-xl text-primary mt-1">{wallet[c.id]}</p>
                <p className="text-[9px] text-muted-foreground mt-2 leading-snug">{c.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-mono text-muted-foreground">
          Week {eco.weekKey} free rotation: {eco.weeklyFree.join(", ") || "—"}
        </p>
      </div>
    </div>
  );
}
