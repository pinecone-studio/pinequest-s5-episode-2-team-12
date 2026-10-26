'use client';
// /leaderboard: scope (friends / aimag / Mongolia) × metric (weekly XP, all-time XP, today's daily challenge,
// best full test). Signed in: rows from the leaderboard RPC; demo: demo friends + the student, ranked here.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { Pill } from '@/components/ui/Pill';
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { calculateLevel } from '@/lib/level';
import { routes } from '@/lib/routes';
import { blockUser, reportUser } from '../actions';
import { BOTS, isBot } from '../lib/bots';
import { loadSocial, saveSocial } from '../lib/local-social';
import { type Candidate, leaderboard, type Metric, type Row, type Scope } from '../lib/ranking';
import { UserMenu } from './UserMenu';

const SCOPES: Scope[] = ['friends', 'aimag', 'national'];
const METRICS: Metric[] = ['xp_week', 'xp_all', 'daily', 'mock'];

function demoRows(scope: Scope, metric: Metric, me: { name: string; aimag?: string }): Row[] {
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

export function LeaderboardView({
  demo,
  scope,
  metric,
  rows: serverRows,
  me,
}: {
  demo: boolean;
  scope: Scope;
  metric: Metric;
  rows: Row[];
  me: { name: string; aimag?: string };
}) {
  const t = useT('social');
  const [rows, setRows] = useState<Row[]>(serverRows);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!demo) return setRows(serverRows);
    setRows(demoRows(scope, metric, me));
  }, [demo, scope, metric, me, serverRows]);

  const block = async (id: string) => {
    if (demo) {
      const s = loadSocial();
      saveSocial({
        ...s,
        friends: s.friends.filter((x) => x !== id),
        blocked: [...new Set([...s.blocked, id])],
      });
      setRows(demoRows(scope, metric, me));
      return bump((n) => n + 1);
    }
    await blockUser(id);
    setRows((r) => r.filter((x) => x.userId !== id));
  };

  const tab = (active: boolean) =>
    cn(
      'h-10 rounded-2xl border px-3.5 text-[13.5px] font-bold inline-flex items-center',
      active ? 'border-leaf bg-sage text-leaf-2' : 'border-line text-ink-2 hover:border-leaf',
    );
  const href = (s: Scope, m: Metric) => `${routes.leaderboard}?scope=${s}&metric=${m}`;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <header className="grid gap-1">
        <h1 className="font-display text-3xl font-bold text-ink">{t('board.title')}</h1>
        {demo && (
          <p className="rounded-2xl bg-teal-soft px-4 py-2 text-sm font-semibold text-teal">
            {t('board.demo')}
          </p>
        )}
      </header>
      <nav aria-label={t('board.title')} className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <Link
              key={s}
              href={href(s, metric)}
              aria-current={s === scope ? 'page' : undefined}
              className={tab(s === scope)}
            >
              {t(`board.scope.${s}`)}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <Link
              key={m}
              href={href(scope, m)}
              aria-current={m === metric ? 'page' : undefined}
              className={tab(m === metric)}
            >
              {t(`board.metric.${m}`)}
            </Link>
          ))}
        </div>
      </nav>
      {scope === 'aimag' && !me.aimag && (
        <p className="rounded-2xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">
          <Link href={routes.profile} className="underline">
            {t('board.noAimag')}
          </Link>
        </p>
      )}
      {rows.length === 0 ? (
        <p className="soft-card p-6 text-[14px] text-ink-2">{t('board.empty')}</p>
      ) : (
        <ol
          className="grid gap-1.5"
          aria-label={`${t(`board.scope.${scope}`)} · ${t(`board.metric.${metric}`)}`}
        >
          {rows.map((r) => (
            <li
              key={r.userId}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2',
                r.me ? 'bg-sage ring-1 ring-leaf' : 'soft-card',
              )}
              aria-current={r.me ? 'true' : undefined}
            >
              <span className="w-8 text-center font-display text-lg font-bold text-ink tnum">{r.rank}</span>
              <Avatar name={r.name} avatarId={r.avatarId} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">
                  {r.me ? `${r.name} (${t('board.you')})` : r.name}{' '}
                  {isBot(r.userId) && <Pill tone="teal">{t('friends.demoFriend')}</Pill>}
                </span>
                <span className="block text-[12px] text-ink-3">{t('friends.level', { n: r.level })}</span>
              </span>
              <span className="font-display text-lg font-bold text-ink tnum">
                {r.value.toLocaleString('en-US')}
              </span>
              {!r.me && (
                <UserMenu
                  name={r.name}
                  context="leaderboard"
                  onBlock={() => block(r.userId)}
                  onReport={(reason) => void reportUser({ target: r.userId, context: 'leaderboard', reason })}
                />
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[12.5px] text-ink-3">
        {t('board.privacyNote')}{' '}
        <Link href={routes.settings} className="font-bold text-leaf-2 underline">
          {t('board.privacy')}
        </Link>
      </p>
    </div>
  );
}
