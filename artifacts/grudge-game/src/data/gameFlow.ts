import type { LucideIcon } from "lucide-react";
import {
  Flame,
  Users,
  Tent,
  ScrollText,
  Sword,
  Book,
  Skull,
  Shield,
  Gift,
  Wallet,
  Sparkles,
  Map,
  Swords,
  PawPrint,
  Gem,
  UserPlus,
  Home,
  Trophy,
  Crosshair,
  Network,
} from "lucide-react";

/**
 * Full system map — every playable panel / mode in Flare Boss Arena.
 * Shell, command palette, home War Room, and in-game Escape menu all read this.
 */

export type NavHref =
  | "/"
  | "/select"
  | "/units"
  | "/party"
  | "/camp"
  | "/character/new"
  | "/equipment"
  | "/skills"
  | "/perks"
  | "/boss"
  | "/enemies"
  | "/rewards"
  | "/account"
  | "/content"
  | "/game"
  | "/pvp"
  | "/leaderboards"
  | "/connections"
  | "/moba";

export interface NavItem {
  label: string;
  href: NavHref;
  icon: LucideIcon;
  description?: string;
  /** Short badge for hub cards */
  badge?: string;
  /** Highlight as primary deploy action */
  primary?: boolean;
}

export interface NavSection {
  label: string;
  blurb?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Command",
    blurb: "Hub, wallet, progress",
    items: [
      { label: "War Panel", href: "/", icon: Home, description: "Home — fighter overview & deploy" },
      { label: "Content Atlas", href: "/content", icon: Map, description: "Modes, zones, interactables" },
      { label: "Rewards", href: "/rewards", icon: Gift, description: "Dailies, season, achievements" },
      { label: "Account & Wallet", href: "/account", icon: Wallet, description: "Gold, embers, souls, tokens" },
      { label: "Connections", href: "/connections", icon: Network, description: "Fleet deploy probes", badge: "FLEET" },
    ],
  },
  {
    label: "Roster & Build",
    blurb: "Fighter, party, power",
    items: [
      { label: "Choose Fighter", href: "/select", icon: Users, description: "Active champion skin & kit" },
      { label: "Party Allies", href: "/party", icon: UserPlus, description: "Up to 2 Grudge6 allies", badge: "NEW" },
      { label: "Unit Roster", href: "/units", icon: PawPrint, description: "Champion compendium" },
      { label: "Stone Sockets", href: "/equipment", icon: Gem, description: "8 attribute stones & rarities" },
      { label: "Grimoire", href: "/skills", icon: Book, description: "Skill ranks & cooldowns" },
      { label: "Perks", href: "/perks", icon: Sparkles, description: "Combat perk machines" },
      { label: "Profile", href: "/character/new", icon: ScrollText, description: "Account profile" },
    ],
  },
  {
    label: "World & Combat",
    blurb: "Deploy into live scenes",
    items: [
      { label: "Enter World", href: "/game", icon: Swords, description: "Dungeon islands, fog map, open water, co-op", primary: true },
      { label: "Boss Arena", href: "/boss", icon: Skull, description: "Boss fight + Arena PvP", primary: true },
      { label: "PvP Arena", href: "/pvp", icon: Crosshair, description: "Fleet Socket.IO multiplayer", badge: "LIVE", primary: true },
      { label: "Leaderboards", href: "/leaderboards", icon: Trophy, description: "Boss · island · arena ranks" },
      { label: "MOBA Lanes", href: "/moba", icon: Flame, description: "Three-lane skirmish mode" },
      { label: "Sanctuary Camp", href: "/camp", icon: Tent, description: "Training ground & stations" },
      { label: "Bestiary", href: "/enemies", icon: Shield, description: "Enemy units" },
    ],
  },
];

/** Flat list for command palette / search. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const PLAY_LOOP: { step: number; label: string; route: NavHref; note: string }[] = [
  { step: 1, label: "Choose fighter", route: "/select", note: "Pick your champion" },
  { step: 2, label: "Form a party", route: "/party", note: "Up to 2 Grudge6 allies" },
  { step: 3, label: "Socket stones", route: "/equipment", note: "Attribute stones & procs" },
  { step: 4, label: "Rank skills & perks", route: "/skills", note: "Grimoire + perk machines" },
  { step: 5, label: "Enter world", route: "/game", note: "Cull hostiles → Island Colossus → sail onward" },
  { step: 6, label: "Boss & rewards", route: "/boss", note: "Standalone arena · claim rewards" },
];

/** Keyboard: open systems hub (also used by Escape in fullscreen modes). */
export const SYSTEMS_HOTKEY = "KeyM";
