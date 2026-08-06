/**
 * Copy + structure for the Info pop-out (game, deploy, upgrades, controls, fleet).
 * Keep this SSOT so Shell / Home / Escape can open the same panels.
 */

import { FLEET } from "./grudgeFleet";
import {
  BOSSES_PER_TOKEN,
  GBUX_PER_TOKEN,
  STARTER_TOKENS,
  UNLOCK_TOKEN_COST,
  WEEKLY_FREE_COUNT,
} from "./flareEconomy";
import { PLAY_LOOP } from "./gameFlow";

export type InfoTabId = "game" | "deploy" | "upgrades" | "controls" | "fleet";

export interface InfoTab {
  id: InfoTabId;
  label: string;
  blurb: string;
}

export const INFO_TABS: InfoTab[] = [
  { id: "game", label: "Game", blurb: "What Flare Boss Arena is" },
  { id: "deploy", label: "Deploy", blurb: "How to enter the world" },
  { id: "upgrades", label: "Upgrades", blurb: "Tokens, unlocks, power" },
  { id: "controls", label: "Controls", blurb: "Keys, mouse, zoom" },
  { id: "fleet", label: "Fleet", blurb: "Live deploy & services" },
];

export const GAME_OVERVIEW = {
  title: "Flare Boss Arena",
  tagline: "Dark-fantasy isometric ARPG · Grudge Studio Armada",
  paragraphs: [
    "Command a champion across dungeon islands, train in camp, and duel multi-phase bosses. Earn Flare Grudge Tokens, unlock fighters, and climb fleet leaderboards.",
    "Built on the Grudge fleet: Grudge ID auth, Railway account API, R2 assets, and Socket.IO PvP — all wired for production on Vercel.",
  ],
  modes: [
    {
      name: "Enter World",
      href: "/game" as const,
      note: "Open-world islands · harvest · colossus · sail rounds",
    },
    {
      name: "Boss Arena",
      href: "/boss" as const,
      note: "Standalone boss · stages · telegraphs · zoom",
    },
    {
      name: "Sanctuary Camp",
      href: "/camp" as const,
      note: "Train skills, dummy spar, town stations",
    },
    {
      name: "PvP Arena",
      href: "/pvp" as const,
      note: "Fleet multiplayer · Socket.IO rooms",
    },
    {
      name: "Leaderboards",
      href: "/leaderboards" as const,
      note: "Boss kills · island rounds · arena score",
    },
  ],
};

export const DEPLOY_GUIDE = {
  title: "Deploy into the world",
  steps: PLAY_LOOP.map((s) => ({
    step: s.step,
    label: s.label,
    note: s.note,
    route: s.route,
  })),
  tips: [
    "War Panel → Deploy Funnel is the recommended path — it checks fighter, party, stones, and skills.",
    "Resume Island keeps your round if you already sailed or fought the colossus.",
    "Boss Arena works offline on Vercel (local ritual) with full dragon / ML boss GLBs.",
    "Wheel zoom works in World, Boss, and Camp. Shift+wheel = bigger steps.",
  ],
};

export const UPGRADES_GUIDE = {
  title: "Power & progression",
  economy: [
    {
      label: "Flare Grudge Token",
      detail: `Unlock fighters (${UNLOCK_TOKEN_COST} token each). Start with ${STARTER_TOKENS}. Earn 1 per ${BOSSES_PER_TOKEN} boss kills, or buy for ${GBUX_PER_TOKEN} GBUX.`,
    },
    {
      label: "Weekly free",
      detail: `${WEEKLY_FREE_COUNT} random fighters free each ISO week for testing — levels do not permanently save unless owned.`,
    },
    {
      label: "Owned levels",
      detail: "XP / level only persists when the fighter is unlocked with a token.",
    },
  ],
  power: [
    {
      label: "Attribute stones",
      route: "/equipment" as const,
      detail: "Socket up to 8 stones — strength, vitality, and combat procs.",
    },
    {
      label: "Skills & perks",
      route: "/skills" as const,
      detail: "Class + weapon skills. Perks machines add in-run modifiers.",
    },
    {
      label: "Party allies",
      route: "/party" as const,
      detail: "Recruit with gold, rank kits, bind spellbook ally skills — up to 2 in the field.",
    },
    {
      label: "Rewards",
      route: "/rewards" as const,
      detail: "Dailies, season tracks, and achievement claims.",
    },
  ],
};

export const CONTROLS_GUIDE = {
  title: "Controls",
  sections: [
    {
      heading: "Movement & camera",
      rows: [
        { keys: "WASD / Arrows", action: "Move (isometric)" },
        { keys: "LMB click ground", action: "Move to point" },
        { keys: "LMB hold", action: "Drag-move under cursor" },
        { keys: "Mouse wheel", action: "Zoom in / out (smooth)" },
        { keys: "Shift + wheel", action: "Fast zoom" },
        { keys: "MMB", action: "Reset zoom" },
        { keys: "Ctrl + move", action: "Sprint gait (run clip)" },
      ],
    },
    {
      heading: "Combat",
      rows: [
        { keys: "LMB on enemy", action: "Select target" },
        { keys: "RMB hold", action: "Attack / chase (world)" },
        { keys: "F", action: "Basic attack (boss arena)" },
        { keys: "1–5", action: "Skills (AoE: then LMB place)" },
        { keys: "Shift", action: "Dodge 4m" },
        { keys: "Q", action: "Block" },
        { keys: "Space", action: "Jump" },
        { keys: "R", action: "Special (fighter kit)" },
        { keys: "E", action: "Interact (cove, harvest)" },
      ],
    },
    {
      heading: "Menus",
      rows: [
        { keys: "M", action: "All Systems hub" },
        { keys: "?", action: "This info panel" },
        { keys: "Esc", action: "Pause in fullscreen modes" },
      ],
    },
  ],
  combatTips: [
    "Leave red / orange / purple ground telegraphs — they detonate after the wind-up.",
    "Boss stages intensify at ~⅔ and ~⅓ HP with charges, meteors, and volleys.",
    "Dodge has i-frames — use it through bolts and slam rings.",
  ],
};

export const FLEET_GUIDE = {
  title: "Live deployment",
  deployUrl: FLEET.deployUrl,
  services: [
    { label: "Production site", url: FLEET.deployUrl, note: "Vercel static + rewrites" },
    { label: "Grudge ID", url: FLEET.id, note: "SSO login" },
    { label: "Account API", url: FLEET.railwayApi, note: "Characters · wallet · GBUX" },
    { label: "Assets CDN", url: FLEET.assets, note: "Models · textures · audio" },
    { label: "ObjectStore", url: FLEET.objectstore, note: "Asset registry & SDK" },
    { label: "Studio info", url: FLEET.info, note: "Grudge Studio main panel" },
    { label: "Dash", url: FLEET.dash, note: "Ops console" },
  ],
  notes: [
    "Same-origin /api/* is rewritten on Vercel to Railway and R2 gamedata.",
    "PvP uses Socket.IO (VITE_MP_URL or flare-mp Railway host).",
    "Leaderboards: /api/flare/leaderboards/:board → multiplayer service.",
    "Connections panel probes fleet health live from the browser.",
  ],
};

export const INFO_HOTKEY = "Slash";

/** Dispatch so Shell (or any host) opens the Field Manual to a tab. */
export function openInfoPanel(tab: InfoTabId = "game") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("flare:open-info", { detail: { tab } }));
}

export type OpenInfoDetail = { tab?: InfoTabId };
