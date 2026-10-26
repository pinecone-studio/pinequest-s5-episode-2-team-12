import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ITEMS } from './catalog';

test('the shop migration seeds match catalog.ts (the database decides prices)', () => {
  const sql = ['0011_economy.sql', '0013_suu_outfits.sql']
    .map((file) => readFileSync(new URL(`../../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    .join('\n');
  const rows = [...sql.matchAll(/\('([a-z0-9-]+)', '([a-z]+)', (\d+), (\d+)\)/g)].map((m) => ({
    id: m[1],
    kind: m[2],
    price: Number(m[3]),
    qty: Number(m[4]),
  }));
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  expect(rows.sort(byId)).toEqual(
    ITEMS.map((i) => ({ id: i.id, kind: i.kind, price: i.price, qty: i.qty ?? 1 })).sort(byId),
  );
});
