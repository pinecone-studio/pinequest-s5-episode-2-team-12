import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ITEMS } from './catalog';

test('the shop_items seed in migration 0011 matches catalog.ts (the database decides prices)', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/0011_economy.sql', import.meta.url), 'utf8');
  const rows = [...sql.matchAll(/\('([a-z0-9-]+)', '([a-z]+)', (\d+), (\d+)\)/g)].map((m) => ({
    id: m[1],
    kind: m[2],
    price: Number(m[3]),
    qty: Number(m[4]),
  }));
  expect(rows).toEqual(ITEMS.map((i) => ({ id: i.id, kind: i.kind, price: i.price, qty: i.qty ?? 1 })));
});
