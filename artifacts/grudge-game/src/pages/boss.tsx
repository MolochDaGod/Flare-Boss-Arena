import React, { useState, useEffect, useRef } from "react";
import { useListCharacters, useGenerateBoss, useGetBossAction } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skull, Swords, Sword, Loader2, Sparkles, Anchor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  type: 'boss' | 'player' | 'system' | 'damage';
  text: string;
  amount?: number;
  ability?: string;
}

export default function Boss() {
  const { data: characters } = useListCharacters();
  const activeChar = characters?.[0];

  const [activeBoss, setActiveBoss] = useState<any>(null);
  const [combatLog, setCombatLog] = useState<LogEntry[]>([]);
  const [bossHp, setBossHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  const [round, setRound] = useState(1);
  const [isCombatActive, setIsCombatActive] = useState(false);
  const [alliesCalled, setAlliesCalled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const generateBoss = useGenerateBoss({
    mutation: {
      onSuccess: (boss) => {
        setActiveBoss(boss);
        setBossHp(boss.maxHp);
        setPlayerHp(1000); // placeholder player HP
        setRound(1);
        setAlliesCalled(false);
        setCombatLog([{
          id: Date.now().toString(),
          type: 'system',
          text: `The arena gates close. ${boss.name}, ${boss.title} approaches.`
        }]);
        setIsCombatActive(true);
      },
      onError: () => toast.error("Failed to conjure boss")
    }
  });

  const getBossAction = useGetBossAction({
    mutation: {
      onSuccess: (action) => {
        if (!activeBoss) return;
        
        const newLogs: LogEntry[] = [];
        
        if (action.taunt) {
          newLogs.push({ id: Date.now() + '-taunt', type: 'boss', text: `"${action.taunt}"` });
        }
        
        newLogs.push({
          id: Date.now() + '-action',
          type: 'damage',
          text: `${activeBoss.name} uses ${action.ability.name}`,
          ability: action.ability.name,
          amount: action.damage
        });

        if (action.statusEffect) {
          newLogs.push({ id: Date.now() + '-status', type: 'system', text: `You are afflicted with ${action.statusEffect}!` });
        }

        setCombatLog(prev => [...prev, ...newLogs]);
        setPlayerHp(prev => Math.max(0, prev - action.damage));

        if (playerHp - action.damage <= 0) {
          setIsCombatActive(false);
          setCombatLog(prev => [...prev, { id: Date.now() + '-death', type: 'system', text: "You have been defeated." }]);
        }
      }
    }
  });

  // Auto-scroll combat log
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [combatLog]);

  const handleStartCombat = () => {
    if (!activeChar) return;
    generateBoss.mutate({
      data: {
        tier: 1,
        playerClass: activeChar.class,
        playerLevel: activeChar.level
      }
    });
  };

  const handlePlayerAttack = () => {
    if (!activeBoss || !isCombatActive) return;

    // Simulate player attack
    const playerDmg = Math.floor(Math.random() * 50) + 20;
    
    setCombatLog(prev => [...prev, {
      id: Date.now() + '-pattack',
      type: 'player',
      text: `You strike ${activeBoss.name}`,
      amount: playerDmg
    }]);

    const newBossHp = Math.max(0, bossHp - playerDmg);
    setBossHp(newBossHp);

    if (newBossHp <= 0) {
      setIsCombatActive(false);
      setCombatLog(prev => [...prev, { id: Date.now() + '-victory', type: 'system', text: `VICTORY. ${activeBoss.name} falls.` }]);
      return;
    }

    // Trigger Boss Turn
    getBossAction.mutate({
      id: activeBoss.id,
      data: {
        bossHpPercent: (newBossHp / activeBoss.maxHp) * 100,
        playerHpPercent: (playerHp / 1000) * 100,
        phase: activeBoss.phase,
        roundNumber: round,
        playerActions: ["Attack"]
      }
    });

    setRound(r => r + 1);
  };

  const handleCallAllies = () => {
    if (!activeBoss || !isCombatActive || alliesCalled || getBossAction.isPending) return;
    setAlliesCalled(true);

    const allies = [
      { name: "Anne Bonny", line: "Fire the broadside, beast!" },
      { name: "Capt. Barbarossa", line: "No quarter for ye!" },
      { name: "Henry Morgan", line: "Cutlasses out, lads!" },
    ];

    const logs: LogEntry[] = [{
      id: Date.now() + '-allies',
      type: 'system',
      text: "\u2693 Your pirate crew storms the arena to your aid!"
    }];

    let total = 0;
    allies.forEach((a, i) => {
      const dmg = Math.floor(Math.random() * 55) + 45;
      total += dmg;
      logs.push({
        id: Date.now() + '-ally-' + i,
        type: 'player',
        text: `${a.name}: "${a.line}"`,
        amount: dmg,
      });
    });

    setCombatLog(prev => [...prev, ...logs]);
    const newBossHp = Math.max(0, bossHp - total);
    setBossHp(newBossHp);

    if (newBossHp <= 0) {
      setIsCombatActive(false);
      setCombatLog(prev => [...prev, { id: Date.now() + '-victory', type: 'system', text: `VICTORY. ${activeBoss.name} falls to the pirate assault.` }]);
    }
  };

  if (!activeChar) {
    return <div className="p-8 text-center font-serif text-muted-foreground tracking-widest">No character selected.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      <div className="shrink-0 text-center">
        <h1 className="text-4xl font-serif text-destructive uppercase tracking-widest flex items-center justify-center gap-3">
          <Skull className="w-8 h-8" /> Arena of Blood
        </h1>
      </div>

      {!activeBoss && !generateBoss.isPending && (
        <Card className="border-destructive/30 bg-card/80 backdrop-blur m-auto max-w-md">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border border-destructive/30">
              <Swords className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h2 className="font-serif text-2xl uppercase tracking-widest mb-2">Summon Adversary</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The AI will forge a unique boss encounter tailored to your class and level. Death is permanent (mostly).
              </p>
            </div>
            <Button size="lg" onClick={handleStartCombat} className="w-full h-14 font-serif text-lg tracking-widest uppercase bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_0_20px_-5px_rgba(255,0,0,0.5)]">
              Conjure Encounter
            </Button>
          </CardContent>
        </Card>
      )}

      {generateBoss.isPending && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-destructive" />
          <p className="font-serif tracking-widest uppercase text-muted-foreground animate-pulse">Forging Adversary...</p>
        </div>
      )}

      {activeBoss && (
        <div className="flex-1 flex flex-col min-h-0 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 shrink-0">
            {/* Player StatusBar */}
            <div className="space-y-2">
              <div className="flex justify-between items-end font-serif tracking-widest">
                <span className="uppercase text-primary">{activeChar.name}</span>
                <span className="text-xs text-muted-foreground">{playerHp} / 1000 HP</span>
              </div>
              <Progress value={(playerHp / 1000) * 100} className="h-3 bg-muted border border-border/50 [&>div]:bg-primary" />
            </div>

            {/* Boss StatusBar */}
            <div className="space-y-2">
              <div className="flex justify-between items-end font-serif tracking-widest">
                <span className="uppercase text-destructive">{activeBoss.name}</span>
                <span className="text-xs text-muted-foreground">{bossHp} / {activeBoss.maxHp} HP</span>
              </div>
              <Progress value={(bossHp / activeBoss.maxHp) * 100} className="h-3 bg-muted border border-border/50 [&>div]:bg-destructive" />
            </div>
          </div>

          {/* Combat Log */}
          <Card className="flex-1 border-border/50 bg-background/80 backdrop-blur flex flex-col min-h-0 overflow-hidden relative">
             <div className="absolute inset-0 bg-[url('https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay z-0" />
            <CardHeader className="py-3 border-b border-border/50 bg-card/50 shrink-0 z-10">
              <div className="flex justify-between items-center">
                <CardTitle className="font-serif tracking-widest uppercase text-sm text-muted-foreground">Combat Log - Round {round}</CardTitle>
                {activeBoss.phase && <span className="font-serif text-xs uppercase tracking-widest text-destructive px-2 py-1 bg-destructive/10 rounded border border-destructive/20">Phase {activeBoss.phase}</span>}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 z-10">
              <ScrollArea className="h-full p-4" ref={scrollRef}>
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {combatLog.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 rounded border font-serif tracking-wide text-sm ${
                          log.type === 'system' ? 'border-border/50 bg-muted/20 text-muted-foreground text-center italic' :
                          log.type === 'boss' ? 'border-destructive/20 bg-destructive/5 text-destructive ml-8' :
                          log.type === 'damage' ? 'border-destructive/30 bg-destructive/10 text-white ml-8 border-l-4 border-l-destructive' :
                          'border-primary/20 bg-primary/5 text-primary mr-8 border-l-4 border-l-primary'
                        }`}
                      >
                        {log.text}
                        {log.amount !== undefined && (
                          <span className={`font-mono ml-2 font-bold ${log.type === 'damage' ? 'text-destructive' : 'text-primary'}`}>
                            [-{log.amount}]
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {getBossAction.isPending && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 text-muted-foreground font-serif ml-8">
                      <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                      <span className="italic text-sm">Boss is thinking...</span>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Action Bar */}
          <div className="shrink-0 flex gap-4">
            <Button 
              size="lg" 
              className="flex-1 h-16 font-serif text-xl tracking-widest uppercase"
              disabled={!isCombatActive || getBossAction.isPending}
              onClick={handlePlayerAttack}
            >
              <Sword className="w-6 h-6 mr-2" /> Strike
            </Button>
             <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 font-serif text-xl tracking-widest uppercase border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
              disabled={!isCombatActive || getBossAction.isPending}
            >
              <Sparkles className="w-6 h-6 mr-2" /> Spell
            </Button>
             <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 font-serif text-xl tracking-widest uppercase border-amber-500/60 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-40"
              disabled={!isCombatActive || getBossAction.isPending || alliesCalled}
              onClick={handleCallAllies}
              title={alliesCalled ? "Your pirate crew has already struck" : "Summon your pirate allies for a one-time assault"}
            >
              <Anchor className="w-6 h-6 mr-2" /> {alliesCalled ? "Crew Spent" : "Call Allies"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

