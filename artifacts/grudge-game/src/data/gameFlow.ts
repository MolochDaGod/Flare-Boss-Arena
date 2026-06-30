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
} from "lucide-react";

/**
 * Navigation + flow map aligned with ARPG / MMO / RTS conventions:
 *
 * | Pattern (reference games)     | Our route        |
 * |-------------------------------|------------------|
 * | MMO hub / garrison            | /camp            |
 * | MMO character select          | /select, /units  |
 * | MMO inventory / armory        | /equipment       |
 * | MMO talent trees              | /skills, /perks  |
 * | MMO auction / wallet          | /account         |
 * | MMO dailies / battle pass     | /rewards         |
 * | RTS unit compendium           | /units, /enemies |
 * | RTS tech / content tree       | /content         |
 * | ARPG endgame map              | /game, /boss     |
 * | ARPG war room                 | / (War Panel)    |
 */

export type NavHref =
  | "/"
  | "/select"
  | "/units"
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
  | "/game";

export interface NavItem {
  label: string;
  href: NavHref;
  icon: LucideIcon;
  description?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Command",
    items: [
      { label: "War Panel", href: "/", icon: Flame, description: "Home — deploy to modes" },
      { label: "Content Atlas", href: "/content", icon: Map, description: "Modes, zones, interactables" },
      { label: "Rewards", href: "/rewards", icon: Gift, description: "Dailies, season, achievements" },
      { label: "Account & Wallet", href: "/account", icon: Wallet, description: "Currencies & profile" },
    ],
  },
  {
    label: "Roster & Build",
    items: [
      { label: "Choose Fighter", href: "/select", icon: Users },
      { label: "Unit Roster", href: "/units", icon: PawPrint, description: "Playable champions compendium" },
      { label: "New Character", href: "/character/new", icon: ScrollText },
      { label: "Equipment", href: "/equipment", icon: Sword },
      { label: "Skills", href: "/skills", icon: Book },
      { label: "Perks", href: "/perks", icon: Sparkles, description: "KF2-style perk machines" },
    ],
  },
  {
    label: "World & Combat",
    items: [
      { label: "Sanctuary Camp", href: "/camp", icon: Tent },
      { label: "Enter World", href: "/game", icon: Swords },
      { label: "Boss Arena", href: "/boss", icon: Skull },
      { label: "Bestiary", href: "/enemies", icon: Shield },
    ],
  },
];

export const PLAY_LOOP: { step: number; label: string; route: NavHref; note: string }[] = [
  { step: 1, label: "Choose fighter", route: "/select", note: "MMO character select / RTS faction pick" },
  { step: 2, label: "Build loadout", route: "/equipment", note: "Diablo armory / WoW gear" },
  { step: 3, label: "Allocate skills & perks", route: "/skills", note: "Talent trees + KF2 perk row at camp" },
  { step: 4, label: "Hub prep", route: "/camp", note: "Town hub — stations, gumball, weapon panel" },
  { step: 5, label: "Dungeon crawl", route: "/game", note: "ARPG loop — collect perk symbols" },
  { step: 6, label: "Boss & rewards", route: "/boss", note: "Endgame encounter → /rewards claim" },
];