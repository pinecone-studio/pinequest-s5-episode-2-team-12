// Gems as a ledger (earned +, spent −, each with a unique key), the inventory, and an idempotent purchase.
// The same rules run in Postgres (purchase_item, migration 0011) for signed-in students; this pure copy runs
// the demo and is what the tests pin down (wallet.test.ts).
import { EARN, type EquipmentSlot, equipmentSlot, itemById, outfitHasAccessory } from '../catalog';

export type GemEvent = { amount: number; reason: string; key: string };
export type Wallet = {
  events: GemEvent[];
  /** item id → quantity owned (cosmetics: 1). */
  owned: Record<string, number>;
  equipped: Partial<Record<EquipmentSlot, string>>;
};

export const emptyWallet = (): Wallet => ({ events: [], owned: {}, equipped: {} });

export const balance = (w: Wallet) => w.events.reduce((s, e) => s + e.amount, 0);

/** Adds an earning once per key (retries and double submits count once). */
export function earn(w: Wallet, amount: number, reason: string, key: string): Wallet {
  if (amount <= 0 || w.events.some((e) => e.key === key)) return w;
  return { ...w, events: [...w.events, { amount, reason, key }] };
}

export type PurchaseResult =
  | { ok: true; wallet: Wallet; repeated: boolean }
  | { ok: false; reason: 'unknown_item' | 'insufficient' | 'owned' };

/**
 * Buys `itemId` under an idempotency key: the same key never charges twice (a repeated request returns the
 * first result). Cosmetics can be owned once; consumables stack.
 */
export function purchase(w: Wallet, itemId: string, key: string): PurchaseResult {
  const item = itemById(itemId);
  if (!item) return { ok: false, reason: 'unknown_item' };
  if (w.events.some((e) => e.key === `buy:${key}`)) return { ok: true, wallet: w, repeated: true };
  if (item.kind !== 'consumable' && (w.owned[itemId] ?? 0) > 0) return { ok: false, reason: 'owned' };
  if (balance(w) < item.price) return { ok: false, reason: 'insufficient' };
  return {
    ok: true,
    repeated: false,
    wallet: {
      ...w,
      events: [...w.events, { amount: -item.price, reason: `buy:${itemId}`, key: `buy:${key}` }],
      owned: { ...w.owned, [itemId]: (w.owned[itemId] ?? 0) + (item.qty ?? 1) },
    },
  };
}

/** Equips an owned cosmetic in its slot (or takes it off when it is already on). */
export function equip(w: Wallet, itemId: string): Wallet {
  const item = itemById(itemId);
  if (!item || item.kind === 'consumable' || !(w.owned[itemId] > 0)) return w;
  if (item.accessorySlot && outfitHasAccessory(w.equipped.outfit, item.accessorySlot)) return w;
  const slot = equipmentSlot(item);
  const equipped = { ...w.equipped };
  if (equipped[slot] === itemId) delete equipped[slot];
  else {
    if (item.kind === 'outfit') {
      if (outfitHasAccessory(item.id, 'head')) delete equipped.head;
      if (outfitHasAccessory(item.id, 'eyes')) delete equipped.eyes;
      if (outfitHasAccessory(item.id, 'neck')) delete equipped.neck;
    }
    equipped[slot] = itemId;
  }
  return { ...w, equipped };
}

/** Return to the free original map without changing purchases or other cosmetics. */
export function resetMapSkin(w: Wallet): Wallet {
  const equipped = { ...w.equipped };
  delete equipped.skin;
  return { ...w, equipped };
}

/** Uses one consumable (a hint token); false when none are left. */
export function consume(w: Wallet, itemId: string): Wallet | null {
  if (!(w.owned[itemId] > 0)) return null;
  return { ...w, owned: { ...w.owned, [itemId]: w.owned[itemId] - 1 } };
}

/**
 * Demo mode has no ledger on a server, so earnings are recomputed from the local progress, each with a
 * stable key — the same achievement always produces the same event.
 */
export function demoEarnings(input: {
  stops: { no: number; stars: number; completedAt: string | null; testedOut: boolean }[];
  regionsDone: string[];
  mockIds: string[];
  dailyDays: string[];
  bestStreak: number;
}): GemEvent[] {
  const out: GemEvent[] = [];
  for (const s of input.stops)
    if (s.completedAt)
      out.push({ amount: EARN.stopPass + EARN.perStar * s.stars, reason: 'stop', key: `stop:${s.no}` });
  for (const r of input.regionsDone) out.push({ amount: EARN.region, reason: 'region', key: `region:${r}` });
  for (const id of input.mockIds) out.push({ amount: EARN.mock, reason: 'mock', key: `mock:${id}` });
  for (const d of input.dailyDays) out.push({ amount: EARN.daily, reason: 'daily', key: `daily:${d}` });
  for (const [days, gems] of Object.entries(EARN.streak))
    if (input.bestStreak >= Number(days)) out.push({ amount: gems, reason: 'streak', key: `streak:${days}` });
  return out;
}
