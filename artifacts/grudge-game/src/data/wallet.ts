/** Account wallet — local persistence until API billing ships. */

export type CurrencyId = "gold" | "embers" | "souls" | "perk_tokens";

export interface CurrencyDef {
  id: CurrencyId;
  label: string;
  icon: string;
  description: string;
}

export const CURRENCIES: CurrencyDef[] = [
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
}

const WALLET_KEY = "grudge:wallet";

const DEFAULT_WALLET: WalletBalances = {
  gold: 1250,
  embers: 42,
  souls: 8,
  perk_tokens: 3,
};

export function getWallet(): WalletBalances {
  if (typeof localStorage === "undefined") return { ...DEFAULT_WALLET };
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (!raw) return { ...DEFAULT_WALLET };
    return { ...DEFAULT_WALLET, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WALLET };
  }
}

export function saveWallet(balances: WalletBalances) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WALLET_KEY, JSON.stringify(balances));
}