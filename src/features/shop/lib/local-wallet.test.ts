import { expect, test } from 'bun:test';
import { loadLocalWallet, saveLocalWallet } from './local-wallet';
import { balance, earn } from './wallet';

test('a local gift survives wallet saves without being counted twice', () => {
  localStorage.clear();
  const gifted = earn(loadLocalWallet(), 1000, 'local-gift', 'gift:test');
  saveLocalWallet(gifted);
  expect(balance(loadLocalWallet())).toBe(1000);
  saveLocalWallet(earn(loadLocalWallet(), 1000, 'local-gift', 'gift:test'));
  expect(balance(loadLocalWallet())).toBe(1000);
  saveLocalWallet({
    ...loadLocalWallet(),
    events: [...loadLocalWallet().events, { amount: -50, reason: 'buy:test', key: 'buy:test' }],
  });
  expect(balance(loadLocalWallet())).toBe(950);
  localStorage.clear();
});
