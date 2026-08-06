import { useMemo, useState } from "react";
import { getPlayableCharacter } from "@/data/playableIdentity";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Flame, Loader2, Sparkles, Swords, BookOpen, Check } from "lucide-react";
import { useResolvedSkills } from "@/data/skillsResolver";
import { SkillIcon } from "@/components/SkillIcon";
import type { ClassSkill } from "@/data/classSkills";
import type { WeaponSlot } from "@/game/weaponSkills";
import {
  SPELLBOOK_SCHOOLS,
  SPELLBOOK_VERSION,
  iconsForSchool,
  spellbookChromeUrl,
  spellbookIconUrl,
  spellbookSlotUrl,
  spellbookGemUrl,
  schoolForElement,
  type SpellSchoolId,
} from "@/data/spellbookAssets";
import {
  listFirstBooks,
  learnSkillBook,
  getFocusSchool,
  setFocusSchool,
  schoolUnlocked,
  STUDY_TOME_GOLD,
} from "@/data/skillBooks";
import { toast } from "sonner";
import { Link } from "wouter";

const SLOT_ACCENT: Record<string, string> = {
  primary: "border-primary/40 text-primary",
  secondary: "border-secondary/40 text-secondary",
  ability: "border-[#4a9eff]/40 text-[#4a9eff]",
  ultimate: "border-[#ffaa00]/50 text-[#ffaa00]",
};

function ClassSkillCard({ skill }: { skill: ClassSkill }) {
  const school = schoolForElement(
    skill.effects?.find((e) => !/aoe|slash|wave|special|ground/i.test(e)) ?? skill.type,
  );
  const accent = SPELLBOOK_SCHOOLS.find((s) => s.id === school)?.accent ?? "#c5a059";
  return (
    <div
      className={`flex gap-3 p-3 rounded border bg-background/50 transition-colors ${
        skill.isSignature
          ? "border-[#ffaa00]/50 shadow-[inset_0_0_20px_rgba(255,170,0,0.08)]"
          : "border-border/50 hover:border-primary/30"
      }`}
      style={skill.isSignature ? undefined : { borderColor: `${accent}44` }}
    >
      <div
        className="w-14 h-14 rounded shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${spellbookSlotUrl("slot_default")})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          border: `1px solid ${accent}55`,
        }}
      >
        <SkillIcon icon={skill.icon} glyph={skill.glyph} size={40} radius={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-serif text-sm tracking-wide text-primary truncate">{skill.name}</h3>
          {skill.isSignature && (
            <span className="text-[9px] font-mono text-[#ffaa00] uppercase px-2 py-0.5 rounded bg-[#ffaa00]/10 border border-[#ffaa00]/40 shrink-0">
              Signature
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
        <div className="flex flex-wrap gap-3 mt-2">
          {skill.cooldown ? (
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              <span className="text-foreground">CD:</span> {skill.cooldown}s
            </span>
          ) : null}
          {skill.manaCost ? (
            <span className="text-[10px] font-mono uppercase">
              <span className="text-[#3b82f6]">MP:</span> {skill.manaCost}
            </span>
          ) : null}
          {skill.damage ? (
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              <span className="text-[#ff4444]">DMG:</span> {skill.damage}x
            </span>
          ) : null}
        </div>
        {skill.effects?.length ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {skill.effects.map((e) => (
              <span
                key={e}
                className="text-[9px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/40 border border-border/40"
              >
                {e}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WeaponSlotBlock({ slot }: { slot: WeaponSlot }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-serif tracking-widest uppercase px-2 py-0.5 rounded border ${SLOT_ACCENT[slot.type] ?? "border-border/50 text-muted-foreground"}`}
        >
          {slot.label}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground uppercase">Unlock T{slot.unlockTier}</span>
      </div>
      <div className="space-y-2">
        {slot.skills.map((sk) => (
          <div key={sk.id} className="flex items-start justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="font-serif text-foreground/90">{sk.name}</span>
              <span className="text-muted-foreground"> — {sk.description}</span>
            </div>
            <div className="flex gap-2 shrink-0 font-mono text-[10px] text-muted-foreground">
              {sk.damage ? <span className="text-[#ff4444]">{sk.damage}</span> : null}
              {sk.cooldown ? <span>{sk.cooldown}s</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FirstBooksPanel({ onLearned }: { onLearned: () => void }) {
  const books = listFirstBooks();
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
        Ally skill tomes (CraftPix 172265 v{SPELLBOOK_VERSION}). Spend{" "}
        <span className="text-[#c5a059]">{STUDY_TOME_GOLD} gold</span> to study — unlocks elemental arts you{" "}
        <Link href="/party" className="text-primary underline-offset-2 hover:underline">
          bind on party allies
        </Link>
        . Not free player hotbar unlocks.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {books.map((b) => (
          <div
            key={b.id}
            className="relative overflow-hidden rounded-lg border p-3 flex gap-3"
            style={{
              borderColor: `${b.accent}55`,
              background: `linear-gradient(135deg, ${b.accent}18, rgba(8,6,4,0.92))`,
            }}
          >
            <div
              className="w-16 h-20 shrink-0 rounded border flex items-center justify-center"
              style={{
                borderColor: `${b.accent}66`,
                backgroundImage: `url(${spellbookChromeUrl("bookPage")})`,
                backgroundSize: "cover",
                imageRendering: "pixelated",
              }}
            >
              {b.coverIconUrl ? (
                <img
                  src={b.coverIconUrl}
                  alt=""
                  className="w-10 h-10"
                  style={{ imageRendering: "pixelated" }}
                  draggable={false}
                />
              ) : (
                <BookOpen className="w-6 h-6" style={{ color: b.accent }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: b.accent }}>
                {b.schoolLabel} · ally skills
              </p>
              <h3 className="font-serif text-sm text-primary truncate">{b.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{b.blurb}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-1 truncate">
                {b.allySkillIds.map((id) => id.replace(/_/g, " ")).join(" · ")}
              </p>
              <button
                type="button"
                disabled={b.learned}
                onClick={() => {
                  const r = learnSkillBook(b.id);
                  if (r.ok) {
                    toast.success(
                      r.already ? "Already studied" : `Studied ${r.book.title} (−${r.cost}g)`,
                      {
                        description: r.already
                          ? r.book.blurb
                          : `Bind skills on Party · ${r.book.unlockSkillIds.join(", ")}`,
                      },
                    );
                    onLearned();
                  } else if (r.reason === "need_gold") {
                    toast.error(`Need ${r.need} gold`, {
                      description: `Have ${r.have}. Earn gold in dungeon/boss, then study.`,
                    });
                  }
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-serif uppercase tracking-widest transition-colors disabled:opacity-60"
                style={{
                  borderColor: `${b.accent}99`,
                  color: b.learned ? "#9ca3af" : b.accent,
                  background: b.learned ? "transparent" : `${b.accent}22`,
                }}
              >
                {b.learned ? (
                  <>
                    <Check className="w-3 h-3" /> Studied
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3 h-3" /> Study · {b.studyCost}g
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpellbookPanel() {
  const [tick, setTick] = useState(0);
  const focus = getFocusSchool();
  void tick;

  const schools = SPELLBOOK_SCHOOLS;
  const activeSchool: SpellSchoolId =
    focus === "all" ? (schools.find((s) => schoolUnlocked(s.id))?.id ?? "fire") : focus;
  const icons = iconsForSchool(activeSchool);
  const schoolMeta = schools.find((s) => s.id === activeSchool);
  const unlocked = schoolUnlocked(activeSchool);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setFocusSchool("all");
            setTick((t) => t + 1);
          }}
          className={`px-3 py-1 rounded font-serif text-[10px] tracking-widest uppercase border ${
            focus === "all" ? "border-primary bg-primary/15 text-primary" : "border-border/40 text-muted-foreground"
          }`}
        >
          Ally Tomes
        </button>
        {schools.map((s) => {
          const open = schoolUnlocked(s.id);
          const gem = spellbookGemUrl(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setFocusSchool(s.id);
                setTick((t) => t + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded font-serif text-[10px] tracking-widest uppercase border transition-colors"
              style={{
                borderColor: focus === s.id ? s.accent : `${s.accent}44`,
                color: open ? s.accent : "#666",
                background: focus === s.id ? `${s.accent}22` : "transparent",
                opacity: open ? 1 : 0.55,
              }}
            >
              {gem ? (
                <img src={gem} alt="" className="w-4 h-4" style={{ imageRendering: "pixelated" }} draggable={false} />
              ) : null}
              {s.label.replace(" Magic", "")}
              <span className="font-mono opacity-70">({s.iconCount})</span>
              {!open ? " · locked" : ""}
            </button>
          );
        })}
      </div>

      {focus === "all" || !unlocked ? (
        <FirstBooksPanel onLearned={() => setTick((t) => t + 1)} />
      ) : (
        <div
          className="rounded-lg border p-4 min-h-[280px]"
          style={{
            borderColor: `${schoolMeta?.accent ?? "#c5a059"}44`,
            backgroundImage: `linear-gradient(180deg, rgba(12,8,6,0.94), rgba(8,6,4,0.97)), url(${spellbookChromeUrl("bookPage")})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundBlendMode: "multiply",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Book className="w-5 h-5" style={{ color: schoolMeta?.accent }} />
            <h3 className="font-serif text-lg tracking-widest uppercase" style={{ color: schoolMeta?.accent }}>
              {schoolMeta?.label}
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              {icons.length} icons · slots from sells_full · pack 172265
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
            {icons.map((icon, i) => {
              const url = spellbookIconUrl(icon.id);
              const slot = spellbookSlotUrl(
                ["slot_a", "slot_b", "slot_c", "slot_d", "slot_e", "slot_f", "slot_g", "slot_h", "slot_i"][i % 9]!,
              );
              return (
                <div
                  key={icon.id}
                  className="group flex flex-col items-center gap-1 p-1 transition-transform hover:scale-105"
                  title={icon.label}
                >
                  <div
                    className="w-14 h-[4.5rem] flex items-center justify-center"
                    style={{
                      backgroundImage: `url(${slot})`,
                      backgroundSize: "100% 100%",
                      backgroundRepeat: "no-repeat",
                      imageRendering: "pixelated",
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={icon.label}
                        className="w-9 h-9"
                        style={{ imageRendering: "pixelated" }}
                        draggable={false}
                      />
                    ) : null}
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground text-center line-clamp-2 leading-tight w-full">
                    {icon.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Skills() {
  const activeChar = getPlayableCharacter();
  const mainHandId = activeChar.equipment?.mainHand ?? undefined;
  const {
    classSkills,
    weaponType,
    weaponSlots,
    isLoading: isLoadingTrees,
  } = useResolvedSkills(activeChar.class, mainHandId);

  const loadoutSkills = classSkills?.skills ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div>
        <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Grimoire</h1>
        <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">
          Ally skill tomes · elemental icons · fighter arts
        </p>
      </div>

      <Tabs defaultValue="spellbook" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card/50 border border-border/50 p-1">
          <TabsTrigger
            value="spellbook"
            className="font-serif tracking-widest uppercase text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Ally Tomes
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="font-serif tracking-widest uppercase text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Active Loadout
          </TabsTrigger>
          <TabsTrigger
            value="trees"
            className="font-serif tracking-widest uppercase text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Weapon Arts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spellbook" className="flex-1 min-h-0 mt-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <CardTitle className="font-serif tracking-widest uppercase text-base">Ally Skill Tomes</CardTitle>
              </div>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wide">
                Study for gold · bind skills on /party · CraftPix 172265
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <SpellbookPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="flex-1 min-h-0 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
            <Card className="border-border/50 bg-card/80 backdrop-blur flex flex-col">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-primary" />
                  <CardTitle className="font-serif tracking-widest uppercase text-base">
                    {activeChar.name} · Combat Kit
                  </CardTitle>
                </div>
                <CardDescription className="font-mono text-[10px] uppercase">
                  Icons from spellbook schools by skill element
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <ScrollArea className="h-[min(60vh,480px)] p-4">
                  <div className="space-y-3">
                    {loadoutSkills.length === 0 ? (
                      <p className="text-sm text-muted-foreground font-mono">No skills on loadout.</p>
                    ) : (
                      loadoutSkills.map((sk) => <ClassSkillCard key={sk.id} skill={sk} />)
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <CardTitle className="font-serif tracking-widest uppercase text-base">How to cast</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-[11px] font-mono text-muted-foreground leading-relaxed">
                <p>1–5 — fighter skills (AoE: key then LMB place)</p>
                <p>R — signature special</p>
                <p>Study ally tomes (gold) then bind skills on Party</p>
                <p>Capital Harbor skills station opens this grimoire</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trees" className="flex-1 min-h-0 mt-6">
          {isLoadingTrees ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card className="border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <Swords className="w-5 h-5 text-primary" />
                  <CardTitle className="font-serif tracking-widest uppercase text-base">
                    {weaponType?.name ?? "Weapon"} Arts
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {weaponSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No weapon slots.</p>
                ) : (
                  weaponSlots.map((slot) => <WeaponSlotBlock key={slot.type + slot.label} slot={slot} />)
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
