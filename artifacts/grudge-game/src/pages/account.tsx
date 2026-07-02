import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { CURRENCIES, getWallet, saveWallet, type WalletBalances } from "@/data/wallet";
import { getActiveFighter } from "@/data/fighters";
import { ParchmentPanel } from "@/components/CraftpixUI";
import { Gift } from "lucide-react";
import { getPlayableCharacter } from "@/data/playableIdentity";

export default function Account() {
  const [wallet, setWallet] = useState<WalletBalances>(() => getWallet());
  const fighter = getActiveFighter();
  const playable = getPlayableCharacter();

  const addDemoGold = () => {
    const next = { ...wallet, gold: wallet.gold + 100 };
    setWallet(next);
    saveWallet(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Grudge Studio account"
        title="Account"
        subtitle="Wallet, active fighter, and session profile — no character creation required"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ParchmentPanel className="lg:col-span-2 p-6 space-y-4">
          <h2 className="font-serif text-sm uppercase tracking-widest text-[#c5a059]">Play Profile</h2>
          <div className="grid grid-cols-2 gap-4 text-sm font-serif">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active Fighter</p>
              <p className="text-foreground">{fighter.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Class</p>
              <p className="font-mono text-primary capitalize">{playable.class}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Title</p>
              <p className="text-foreground">{fighter.title}</p>
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
              <Link href="/rewards"><Gift className="mr-2 h-4 w-4" /> Rewards</Link>
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
        <h2 className="font-serif text-sm uppercase tracking-widest text-muted-foreground mb-3">Wallet</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CURRENCIES.map((c) => (
            <Card key={c.id} className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-4 text-center">
                <span className="text-2xl">{c.icon}</span>
                <p className="font-serif text-xs uppercase tracking-widest mt-2 text-muted-foreground">{c.label}</p>
                <p className="font-mono text-xl text-primary mt-1">{wallet[c.id]}</p>
                <p className="text-[9px] text-muted-foreground mt-2 leading-snug">{c.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 font-serif text-xs tracking-widest"
          onClick={addDemoGold}
        >
          +100 Gold (demo)
        </Button>
      </div>
    </div>
  );
}