import { expect, test } from 'bun:test';
import { BADGES } from '@/mocks/meta';
import { getLeague, getStats, listBadges } from './queries';

test('demo: Tuya stats, every badge, empty legacy league', async () => {
  expect((await getStats('u-demo')).xp).toBe(1560);
  expect((await getStats('u-demo')).streak).toBe(7);
  expect(await listBadges('u-demo')).toHaveLength(BADGES.length);
  expect(BADGES.filter((b) => b.id.startsWith('roadmap-'))).toHaveLength(7);
  expect(await getLeague('2026-W43')).toEqual([]);
});
