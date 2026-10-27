import { describe, expect, test } from 'bun:test';
import { EARN, ITEMS } from '../catalog';
import { balance, consume, demoEarnings, earn, emptyWallet, equip, purchase } from './wallet';

const rich = () => earn(emptyWallet(), 1000, 'test', 'seed');

describe('gem wallet', () => {
  test('earnings count once per key', () => {
    let w = earn(emptyWallet(), 5, 'stop', 'stop:1');
    w = earn(w, 5, 'stop', 'stop:1');
    w = earn(w, 0, 'none', 'zero');
    expect(balance(w)).toBe(5);
  });

  test('a purchase charges the price and adds the item', () => {
    const r = purchase(rich(), 'frame-gold', 'k1');
    if (!r.ok) throw new Error(r.reason);
    expect(balance(r.wallet)).toBe(1000 - 80);
    expect(r.wallet.owned['frame-gold']).toBe(1);
    expect(r.repeated).toBe(false);
  });

  test('purchases are idempotent: the same key never charges twice', () => {
    const first = purchase(rich(), 'streak-freeze', 'same-key');
    if (!first.ok) throw new Error(first.reason);
    const again = purchase(first.wallet, 'streak-freeze', 'same-key');
    if (!again.ok) throw new Error(again.reason);
    expect(again.repeated).toBe(true);
    expect(balance(again.wallet)).toBe(1000 - 30);
    expect(again.wallet.owned['streak-freeze']).toBe(1);
    // a new key buys another one (consumables stack)
    const second = purchase(again.wallet, 'streak-freeze', 'other-key');
    expect(second.ok && second.wallet.owned['streak-freeze']).toBe(2);
  });

  test('not enough gems, unknown items, owning a cosmetic twice', () => {
    expect(purchase(earn(emptyWallet(), 10, 't', 't'), 'frame-gold', 'k')).toEqual({
      ok: false,
      reason: 'insufficient',
    });
    expect(purchase(rich(), 'nope', 'k')).toEqual({ ok: false, reason: 'unknown_item' });
    const r = purchase(rich(), 'outfit-hat', 'a');
    if (!r.ok) throw new Error(r.reason);
    expect(purchase(r.wallet, 'outfit-hat', 'b')).toEqual({ ok: false, reason: 'owned' });
  });

  test('equip one cosmetic per slot; toggling takes it off; consumables are used one at a time', () => {
    let w = rich();
    for (const [id, k] of [
      ['frame-gold', 'a'],
      ['frame-sky', 'b'],
      ['hints-3', 'c'],
    ] as const) {
      const r = purchase(w, id, k);
      if (!r.ok) throw new Error(r.reason);
      w = r.wallet;
    }
    w = equip(w, 'frame-gold');
    expect(w.equipped.frame).toBe('frame-gold');
    w = equip(w, 'frame-sky');
    expect(w.equipped.frame).toBe('frame-sky');
    w = equip(w, 'frame-sky');
    expect(w.equipped.frame).toBeUndefined();
    expect(equip(w, 'outfit-crown')).toBe(w); // not owned
    expect(w.owned['hints-3']).toBe(3);
    const used = consume(w, 'hints-3');
    expect(used?.owned['hints-3']).toBe(2);
    expect(consume(emptyWallet(), 'hints-3')).toBeNull();
  });

  test('demo earnings follow the economy config with stable keys', () => {
    const ev = demoEarnings({
      stops: [
        { no: 1, stars: 3, completedAt: '2026-10-01', testedOut: false },
        { no: 2, stars: 0, completedAt: null, testedOut: false },
      ],
      regionsDone: ['west'],
      mockIds: ['m1'],
      dailyDays: ['2026-10-25', '2026-10-26'],
      bestStreak: 8,
    });
    const total = ev.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(
      EARN.stopPass + 3 * EARN.perStar + EARN.region + EARN.mock + 2 * EARN.daily + EARN.streak[7],
    );
    expect(new Set(ev.map((e) => e.key)).size).toBe(ev.length);
  });

  test('every catalog item has a positive price and a unique id', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(ITEMS.every((i) => i.price > 0)).toBe(true);
  });
});

test('default map clears the skin without spending gems or losing owned themes', async () => {
  const { resetMapSkin } = await import('./wallet');
  const before = {
    events: [{ amount: 100, reason: 'test', key: 'earned' }],
    owned: { 'skin-night': 1, 'skin-winter': 1 },
    equipped: { skin: 'skin-night', frame: 'frame-gold' },
  };
  const after = resetMapSkin(before);
  expect(after.equipped.skin).toBeUndefined();
  expect(after.equipped.frame).toBe('frame-gold');
  expect(after.owned).toEqual(before.owned);
  expect(after.events).toEqual(before.events);
  expect(before.equipped.skin).toBe('skin-night');
});
