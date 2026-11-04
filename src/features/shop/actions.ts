'use server';
// Shop writes. The purchase runs in Postgres (purchase_item: balance check + ledger + inventory, idempotent
// by key); equipping is a service-role update after checking ownership. Demo mode: { reason: 'demo_mode' }.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { equipmentSlot, ITEMS, itemById, outfitHasAccessory } from './catalog';

export type ShopResult = { ok: true; repeated?: boolean } | { ok: false; reason: string };

const Buy = z.object({
  itemId: z.enum(ITEMS.map((i) => i.id) as [string, ...string[]]),
  key: z.string().min(8).max(80),
});

async function user() {
  const db = await getDb();
  const u = db ? (await db.auth.getUser()).data.user : null;
  return db && u ? { db, id: u.id } : null;
}

export async function buyItem(input: { itemId: string; key: string }): Promise<ShopResult> {
  const parsed = Buy.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const u = await user();
  if (!u) return { ok: false, reason: 'demo_mode' };
  const { data, error } = await u.db.rpc('purchase_item', {
    p_item: parsed.data.itemId,
    p_key: parsed.data.key,
  });
  if (error) return { ok: false, reason: 'database_error' };
  const r = data as { ok: boolean; reason?: string; repeated?: boolean };
  revalidatePath('/', 'layout');
  return r.ok ? { ok: true, repeated: r.repeated } : { ok: false, reason: r.reason ?? 'failed' };
}

export async function equipItem(itemId: string): Promise<ShopResult> {
  const item = itemById(itemId);
  if (!item || item.kind === 'consumable') return { ok: false, reason: 'invalid_input' };
  const u = await user();
  if (!u) return { ok: false, reason: 'demo_mode' };
  const admin = getAdminDb();
  if (!admin) return { ok: false, reason: 'database_error' };
  const { data: own } = await admin
    .from('inventory')
    .select('qty, equipped')
    .eq('user_id', u.id)
    .eq('item_id', itemId)
    .maybeSingle();
  if (!own || own.qty < 1) return { ok: false, reason: 'not_owned' };
  const { data: equippedRows, error: equippedError } = await admin
    .from('inventory')
    .select('item_id')
    .eq('user_id', u.id)
    .eq('equipped', true);
  if (equippedError) return { ok: false, reason: 'database_error' };
  const currentOutfit = equippedRows
    ?.map((row) => itemById(row.item_id))
    .find((equippedItem) => equippedItem?.kind === 'outfit' && !equippedItem.accessorySlot);
  if (item.accessorySlot && outfitHasAccessory(currentOutfit?.id, item.accessorySlot)) {
    return { ok: false, reason: 'incompatible' };
  }
  const slot = equipmentSlot(item);
  const sameSlot = ITEMS.filter((i) => i.kind !== 'consumable' && equipmentSlot(i) === slot).map((i) => i.id);
  await admin.from('inventory').update({ equipped: false }).eq('user_id', u.id).in('item_id', sameSlot);
  if (item.kind === 'outfit' && !item.accessorySlot) {
    const conflictingAccessories = ITEMS.filter(
      (i) => i.accessorySlot && outfitHasAccessory(item.id, i.accessorySlot),
    ).map((i) => i.id);
    if (conflictingAccessories.length) {
      await admin
        .from('inventory')
        .update({ equipped: false })
        .eq('user_id', u.id)
        .in('item_id', conflictingAccessories);
    }
  }
  if (!own.equipped)
    await admin.from('inventory').update({ equipped: true }).eq('user_id', u.id).eq('item_id', itemId);
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** The default map is free: clear just the signed-in user's equipped skin. */
export async function resetMapSkin(): Promise<ShopResult> {
  const u = await user();
  if (!u) return { ok: false, reason: 'demo_mode' };
  const admin = getAdminDb();
  if (!admin) return { ok: false, reason: 'database_error' };
  const skins = ITEMS.filter((i) => i.kind === 'skin').map((i) => i.id);
  const { error } = await admin
    .from('inventory')
    .update({ equipped: false })
    .eq('user_id', u.id)
    .in('item_id', skins);
  if (error) return { ok: false, reason: 'database_error' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
