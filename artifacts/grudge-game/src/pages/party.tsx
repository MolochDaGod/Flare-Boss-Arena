/**
 * Party — recruit earned Grudge6 allies, rank them, bind spellbook ally skills.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { MAX_PARTY_ALLIES } from "@/data/grudge6Roster";
import { defaultColorSetForHero, colorSetLabel } from "@/data/toonRtsColorSets";
import {
  equipAllySkill,
  equipSkillCost,
  listAvailableAllySkills,
  listPartyRoster,
  partyProgressSummary,
  recruitAlly,
  sanitizePartySelection,
  togglePartyAllyGated,
  unequipAllySkill,
  upgradeAllyRank,
  MAX_ALLY_RANK,
  MAX_ALLY_SKILL_SLOTS,
  type AllySkillDef,
} from "@/data/partyProgress";
import { getWallet } from "@/data/wallet";
import { spellbookSlotUrl } from "@/data/spellbookAssets";
import { BookOpen, Coins, Tent, Users, ChevronUp, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

const ROLE_COLOR: Record<string, string> = {
  healer: "#7dd3fc",
  tank: "#94a3b8",
  ranger: "#86efac",
  bruiser: "#fca5a5",
  fighter: "#fcd34d",
  skirmisher: "#d8b4fe",
  unarmed: "#a3a3a3",
};

export default function Party() {
  const [tick, setTick] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  void tick;

  // Ensure party slots only hold unlocked allies
  sanitizePartySelection();

  const roster = useMemo(() => listPartyRoster(), [tick]);
  const summary = useMemo(() => partyProgressSummary(), [tick]);
  const gold = getWallet().gold;
  const focus = focusId ? roster.find((h) => h.id === focusId) : roster.find((h) => h.inParty) ?? roster.find((h) => h.unlocked);

  const refresh = () => setTick((t) => t + 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Earned progression"
        title="Party"
        subtitle={`Recruit allies with gold · rank kits · bind spellbook ally skills · max ${MAX_PARTY_ALLIES} in field`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
              <Link href="/skills" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Ally Tomes
              </Link>
            </Button>
            <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
              <Link href="/game" className="flex items-center gap-2">
                <Tent className="h-4 w-4" /> Enter Dungeon
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
        <Users className="h-5 w-5 text-primary" />
        <p className="text-sm font-serif text-muted-foreground">
          Field{" "}
          <span className="text-primary font-mono">
            {roster.filter((h) => h.inParty).length}/{MAX_PARTY_ALLIES}
          </span>
          {" · "}
          Recruited{" "}
          <span className="font-mono text-foreground">
            {summary.unlocked}/{summary.total}
          </span>
          {" · "}
          <span className="inline-flex items-center gap-1 font-mono text-[#c5a059]">
            <Coins className="h-3.5 w-3.5" />
            {gold} gold
          </span>
          {" · "}
          Ranks {summary.activeRanks} · Skills bound {summary.skillsBound}
        </p>
        <p className="w-full text-[11px] font-mono text-muted-foreground">
          Gold from dungeons &amp; bosses. Two starter allies free · rest recruit · spell primers unlock ally skills only.
        </p>
      </div>

      {focus && (
        <AllySkillDock
          hero={focus}
          onRefresh={refresh}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roster.map((h) => (
          <HeroCard
            key={h.id}
            hero={h}
            selectedFocus={focus?.id === h.id}
            onFocus={() => setFocusId(h.id)}
            onRefresh={refresh}
          />
        ))}
      </div>
    </div>
  );
}

function AllySkillDock({
  hero,
  onRefresh,
}: {
  hero: ReturnType<typeof listPartyRoster>[number];
  onRefresh: () => void;
}) {
  const skills = listAvailableAllySkills(hero.id);
  const schoolAccent =
    ROLE_COLOR[hero.role] ?? "#c5a059";

  return (
    <Card className="border-border/50 bg-card/70 overflow-hidden">
      <div className="h-1" style={{ background: schoolAccent }} />
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base uppercase tracking-widest flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ally skills — {hero.displayName}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground normal-case tracking-normal">
            Prefer {hero.preferredSchool} · {hero.skills.length}/{MAX_ALLY_SKILL_SLOTS} slots · bind {equipSkillCost()}g
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hero.unlocked && (
          <p className="text-xs text-muted-foreground font-serif">
            Recruit this ally before binding spellbook skills.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {skills.map((sk) => (
            <SkillChip
              key={sk.id}
              skill={sk}
              disabled={!hero.unlocked}
              onEquip={() => {
                const r = equipAllySkill(hero.id, sk.id);
                toast[r.ok ? "success" : "error"](r.message);
                onRefresh();
              }}
              onUnequip={() => {
                unequipAllySkill(hero.id, sk.id);
                toast.success(`Unequipped ${sk.name}`);
                onRefresh();
              }}
            />
          ))}
        </div>
        <p className="text-[10px] font-mono text-muted-foreground">
          Study tomes on{" "}
          <Link href="/skills" className="text-primary underline-offset-2 hover:underline">
            Skills → Ally Tomes
          </Link>
          {" "}({160} gold each). Off-role schools still work at reduced potency.
        </p>
      </CardContent>
    </Card>
  );
}

function SkillChip({
  skill,
  disabled,
  onEquip,
  onUnequip,
}: {
  skill: AllySkillDef & {
    studied: boolean;
    equipped: boolean;
    iconUrl: string | null;
    schoolLabel: string;
    accent: string;
    affinity: boolean;
  };
  disabled: boolean;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  return (
    <div
      className="flex gap-2 items-center rounded border p-2"
      style={{
        borderColor: skill.equipped ? `${skill.accent}99` : `${skill.accent}33`,
        background: skill.equipped ? `${skill.accent}14` : "transparent",
        opacity: skill.studied ? 1 : 0.55,
      }}
    >
      <div
        className="w-10 h-10 shrink-0 rounded flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${spellbookSlotUrl("slot_default")})`,
          backgroundSize: "100% 100%",
          imageRendering: "pixelated",
        }}
      >
        {skill.iconUrl ? (
          <img src={skill.iconUrl} alt="" className="w-7 h-7" style={{ imageRendering: "pixelated" }} draggable={false} />
        ) : (
          <BookOpen className="w-4 h-4" style={{ color: skill.accent }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-serif truncate" style={{ color: skill.accent }}>
          {skill.name}
          {!skill.affinity && <span className="text-muted-foreground"> · off-role</span>}
        </p>
        <p className="text-[9px] font-mono text-muted-foreground truncate">{skill.schoolLabel}</p>
      </div>
      {!skill.studied ? (
        <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" /> Study
        </span>
      ) : skill.equipped ? (
        <Button size="sm" variant="ghost" className="h-7 text-[10px] font-mono" onClick={onUnequip} disabled={disabled}>
          Unequip
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px] font-mono"
          disabled={disabled}
          onClick={onEquip}
        >
          Bind
        </Button>
      )}
    </div>
  );
}

function HeroCard({
  hero,
  selectedFocus,
  onFocus,
  onRefresh,
}: {
  hero: ReturnType<typeof listPartyRoster>[number];
  selectedFocus: boolean;
  onFocus: () => void;
  onRefresh: () => void;
}) {
  const r = hero.resolved;
  return (
    <Card
      className={`border-border/50 bg-card/60 overflow-hidden cursor-pointer transition-shadow ${
        hero.inParty ? "ring-1 ring-primary/60" : ""
      } ${selectedFocus ? "ring-1 ring-[#c5a059]/70" : ""} ${!hero.unlocked ? "opacity-90" : ""}`}
      onClick={onFocus}
    >
      <div className="h-1" style={{ background: ROLE_COLOR[hero.role] ?? "#c5a059" }} />
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base uppercase tracking-widest flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            {!hero.unlocked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="truncate">{hero.displayName}</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {hero.faction}
            {hero.unlocked ? ` · R${hero.rank}` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] font-mono uppercase text-muted-foreground">
          {hero.role} · {hero.brain} · {hero.preferredSchool} · dye{" "}
          {colorSetLabel(
            defaultColorSetForHero({ race: hero.race, role: hero.role, faction: hero.faction }),
          )}
        </p>
        <p className="text-xs text-muted-foreground font-serif">
          Dmg {r.damage} · Range {r.attackRange.toFixed(1)}
          {r.healAmount > 0 ? ` · Heal ${r.healAmount}` : ""}
          {" · "}Mult {r.skillMult.toFixed(2)}
        </p>
        {hero.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hero.skills.map((sk) => (
              <span
                key={sk.id}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{ borderColor: `${ROLE_COLOR[hero.role]}55`, color: ROLE_COLOR[hero.role] }}
              >
                {sk.name}
              </span>
            ))}
          </div>
        )}
        {hero.weaponMesh && (
          <p className="text-[10px] font-mono text-muted-foreground truncate">⚔ {hero.weaponMesh}</p>
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          {!hero.unlocked ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full font-serif text-xs tracking-widest"
              onClick={() => {
                const res = recruitAlly(hero.id);
                toast[res.ok ? "success" : "error"](res.message);
                onRefresh();
              }}
            >
              <Coins className="h-3.5 w-3.5 mr-1" />
              Recruit · {hero.recruitGold}g
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant={hero.inParty ? "default" : "outline"}
                className="w-full font-serif text-xs tracking-widest"
                onClick={() => {
                  const res = togglePartyAllyGated(hero.id);
                  toast[res.ok ? "success" : "error"](res.message);
                  onRefresh();
                }}
              >
                {hero.inParty ? "In party" : "Add to party"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full font-mono text-[10px] tracking-wide"
                disabled={hero.rank >= MAX_ALLY_RANK}
                onClick={() => {
                  const res = upgradeAllyRank(hero.id);
                  toast[res.ok ? "success" : "error"](res.message);
                  onRefresh();
                }}
              >
                <ChevronUp className="h-3 w-3 mr-1" />
                {hero.rank >= MAX_ALLY_RANK
                  ? `Max rank ${MAX_ALLY_RANK}`
                  : `Upgrade rank · ${hero.nextRankGold}g`}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
