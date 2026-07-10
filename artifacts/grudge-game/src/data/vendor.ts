/**
 * Pirate Cove vendor — buy/sell using gold + harvested resources.
 */

import { VENDOR_GOODS, type VendorGood, spendResources, addResource, getResources } from "./resources";
import { getWallet, saveWallet } from "./wallet";

const GOODS_BY_ID = new Map(VENDOR_GOODS.map((g) => [g.id, g]));

export function tryVendorGood(goodId: string): { ok: boolean; message: string } {
  const good = GOODS_BY_ID.get(goodId);
  if (!good) return { ok: false, message: "Unknown trade." };

  if (good.kind === "sell") {
    return executeSell(good);
  }
  return executeBuy(good);
}

/** Quick interact at Anne — best available trade for the player. */
export function vendorQuickTrade(): { ok: boolean; message: string } {
  const bag = getResources();
  if (bag.wood >= 12) {
    const r = tryVendorGood("craft_potion_wood");
    if (r.ok) return r;
  }
  if (bag.wood >= 5) {
    const r = tryVendorGood("sell_wood");
    if (r.ok) return r;
  }
  if (bag.stone >= 5) {
    const r = tryVendorGood("sell_stone");
    if (r.ok) return r;
  }
  return {
    ok: false,
    message: "Anne Bonny: chop trees (F) or mine rocks, then press E to trade wood/stone.",
  };
}

function executeSell(good: VendorGood): { ok: boolean; message: string } {
  const res = good.resource;
  if (!res) return { ok: false, message: "Invalid listing." };
  const bag = getResources();
  if ((bag[res] ?? 0) < good.amount) {
    return { ok: false, message: `Need ${good.amount} ${res} to sell.` };
  }
  if (!spendResources({ [res]: good.amount })) {
    return { ok: false, message: "Could not spend resources." };
  }
  const w = getWallet();
  w.gold += good.gold;
  saveWallet(w);
  return { ok: true, message: `Sold ${good.amount} ${res} for ${good.gold} gold.` };
}

function executeBuy(good: VendorGood): { ok: boolean; message: string } {
  const w = getWallet();
  if (w.gold < good.gold) {
    return { ok: false, message: `Need ${good.gold} gold.` };
  }
  const cost: { wood?: number; stone?: number } = {};
  if (good.costWood) cost.wood = good.costWood;
  if (good.costStone) cost.stone = good.costStone;
  if ((cost.wood ?? 0) > 0 || (cost.stone ?? 0) > 0) {
    if (!spendResources(cost)) {
      return { ok: false, message: "Not enough wood/stone for that trade." };
    }
  }
  w.gold -= good.gold;
  saveWallet(w);

  if (good.grant === "wood") addResource("wood", good.amount);
  else if (good.grant === "stone") addResource("stone", good.amount);
  else if (good.grant === "gold_bag") {
    w.gold += 25;
    saveWallet(w);
  }

  return { ok: true, message: `Purchased ${good.name}.` };
}