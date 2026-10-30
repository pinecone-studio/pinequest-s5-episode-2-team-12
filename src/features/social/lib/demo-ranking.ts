// Shared demo leaderboard calculation for the board and profile summary.
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import { calculateLevel } from '@/lib/level';
import { BOTS } from './bots';
import { loadSocial } from './local-social';
import { type Candidate, leaderboard, type Metric, type Row, type Scope } from './ranking';

export function demoRows(scope: Scope, metric: Metric, me: { name: string; aimag?: string }): Row[] {
  const social = loadSocial();
  const road = loadLocalRoadmap();
  let daily: number | null = null;
  try {
    const d = JSON.parse(localStorage.getItem('suprep:daily:v1') ?? 'null') as {
      finishedAt?: string;
      score?: number;
      flagged?: boolean;
    } | null;
    if (d?.finishedAt && !d.flagged) daily = d.score ?? null;
  } catch {
    // ignore
  }
  const mocks = loadLocalMocks().filter((m) => !m.flagged);
  const myValue = {
    xp_week: road.xp,
    xp_all: road.xp,
    daily,
    mock: mocks.length ? Math.max(...mocks.map((m) => m.score ?? 0)) : null,
  }[metric];
  const pub = { hidePublic: false, friendsOnly: false };
  const candidates: Candidate[] = [
    {
      userId: 'me',
      name: me.name || 'Та',
      level: calculateLevel(road.xp).level,
      aimag: me.aimag,
      privacy: pub,
      value: myValue,
    },
    ...BOTS.map((b) => ({
      userId: b.id,
      name: b.name,
      avatarId: b.avatarId,
      level: b.level,
      aimag: b.aimag,
      privacy: pub,
      value: { xp_week: b.weekXp, xp_all: b.allXp, daily: b.daily, mock: b.bestMock }[metric],
    })),
  ];
  return leaderboard(candidates, { userId: 'me', aimag: me.aimag }, scope, (id) => ({
    friends: social.friends.includes(id),
    blocked: social.blocked.includes(id),
  }));
}
