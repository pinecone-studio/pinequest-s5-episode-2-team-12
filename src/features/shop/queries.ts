// Signed-in wallet: gem balance (sum of the ledger), owned items, what is equipped.
import { getDb } from '@/lib/supabase/server';
import { type EquipmentSlot, equipmentSlot, itemById, outfitHasAccessory } from './catalog';

export type ServerWallet = {
  balance: number;
  owned: Record<string, number>;
  equipped: Partial<Record<EquipmentSlot, string>>;
};

export async function getWallet(userId: string): Promise<ServerWallet | null> {
  const db = await getDb();
  if (!db) return null;
  const [gems, inv] = await Promise.all([
    db.from('gem_events').select('amount').eq('user_id', userId).limit(10000),
    db.from('inventory').select('item_id, qty, equipped').eq('user_id', userId),
  ]);
  if (gems.error || inv.error) return null;
  const owned: Record<string, number> = {};
  const equipped: Partial<Record<EquipmentSlot, string>> = {};
  for (const r of inv.data ?? []) {
    owned[r.item_id] = r.qty;
    const item = itemById(r.item_id);
    if (r.equipped && item && item.kind !== 'consumable') equipped[equipmentSlot(item)] = item.id;
  }
  if (outfitHasAccessory(equipped.outfit, 'head')) delete equipped.head;
  if (outfitHasAccessory(equipped.outfit, 'eyes')) delete equipped.eyes;
  if (outfitHasAccessory(equipped.outfit, 'neck')) delete equipped.neck;
  return { balance: (gems.data ?? []).reduce((s, r) => s + r.amount, 0), owned, equipped };
}
