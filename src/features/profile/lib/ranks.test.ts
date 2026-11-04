import { expect, test } from 'bun:test';
import { tuyaSeed } from '@/features/demo/seed';
import { demoRows } from '@/features/social/lib/demo-ranking';
import { getT } from '@/lib/i18n';
import { rankSummary } from './ranks';

test('all profile scopes show the same Tuya rank as their leaderboard', () => {
  const keys = ['suprep:roadmap:v1', 'suprep:mocks:v1', 'suprep:social:v1'];
  const before = keys.map((key) => localStorage.getItem(key));
  try {
    const seed = tuyaSeed(Date.parse('2026-10-30T00:00:00Z'));
    localStorage.setItem(keys[0], JSON.stringify(seed.roadmap));
    localStorage.setItem(keys[1], JSON.stringify(seed.mocks));
    localStorage.removeItem(keys[2]);
    const national = rankSummary(demoRows('national', 'xp_week', seed.profile));
    const aimag = rankSummary(demoRows('aimag', 'xp_week', seed.profile));
    const friends = rankSummary(demoRows('friends', 'xp_week', seed.profile));
    expect(national).toEqual({ rank: 10, of: 50 });
    expect(aimag?.rank).toBeGreaterThan(0);
    expect(aimag!.of).toBeLessThan(50);
    expect(friends).toEqual({ rank: 1, of: 3 });
  } finally {
    keys.forEach((key, index) => {
      if (before[index] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, before[index]!);
    });
  }
});

test('profile labels resolve in both languages', () => {
  for (const locale of ['mn', 'en'] as const) {
    const t = getT('profile', locale);
    for (const key of ['rank.pool', 'radar.answerCount', 'radar.change', 'radar.percentagePoints']) {
      expect(t(key, { n: 50 })).not.toStartWith('profile.');
    }
  }
});
