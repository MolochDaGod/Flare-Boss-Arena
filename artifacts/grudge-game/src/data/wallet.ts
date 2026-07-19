/** Account wallet — local + production scheme (GBUX + Flare Grudge Token via flareEconomy). */

import { getEconomy, getFlareTokens, getGbux } from "./flareEconomy";

export type CurrencyId =
  | "gold"
  | "embers"
  | "souls"
  | "perk_tokens"
  | "gbux"
  | "flare_grudge_token";

export interface CurrencyDef {
  id: CurrencyId;
  label: string;
  icon: string;
  description: string;
}

export const CURRENCIES: CurrencyDef[] = [
  {
    id: "flare_grudge_token",
    label: "Flare Grudge Token",
    icon: "🜂",
    description: "Unlock fighters permanently. 1000 GBUX each, or earn 1 per 5 boss kills. Starter grant: 2.",
  },
  {
    id: "gbux",
    label: "GBUX",
    icon: "💎",
    description: "Grudge Studio account currency — buy Flare Grudge Tokens (1000 GBUX = 1 token).",
  },
  { id: "gold", label: "Gold", icon: "🪙", description: "Standard loot currency from dungeons and bosses." },
  { id: "embers", label: "Embers", icon: "🔥", description: "Premium forge currency for crafting rerolls." },
  { id: "souls", label: "Souls", icon: "💀", description: "Boss souls — spent at the Soul Altar for attributes." },
  { id: "perk_tokens", label: "Perk Tokens", icon: "🎰", description: "Gumball & perk machine rolls." },
];

export interface WalletBalances {
  gold: number;
  embers: number;
  souls: number;
  perk_tokens: number;
  gbux: number;
  flare_grudge_token: number;
}

const WALLET_KEY = "grudge:wallet";

const DEFAULT_WALLET: WalletBalances = {
  gold: 1250,
  embers: 42,
  souls: 8,
  perk_tokens: 3,
  gbux: 0,
  flare_grudge_token: 0,
};

export function getWallet(): WalletBalances {
  // Production currencies live in flareEconomy; session loot stays in wallet key.
  const eco = getEconomy();
  let base = { ...DEFAULT_WALLET };
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(WALLET_KEY);
      if (raw) base = { ...DEFAULT_WALLET, ...JSON.parse(raw) };
    } catch {
      /* keep default */
    }
  }
  return {
    ...base,
    gbux: getGbux() || eco.gbux || base.gbux || 0,
    flare_grudge_token: getFlareTokens(),
  };
}

export function saveWallet(balances: WalletBalances) {
  if (typeof localStorage === "undefined") return;
  // Persist session currencies only; tokens/GBUX owned by flareEconomy.
  const { gold, embers, souls, perk_tokens } = balances;
  localStorage.setItem(
    WALLET_KEY,
    JSON.stringify({ gold, embers, souls, perk_tokens }),
  );
}