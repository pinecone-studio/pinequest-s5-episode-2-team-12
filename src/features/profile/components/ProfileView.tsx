'use client';
// /profile: who I am (editable), my ranking, the skill radar, full-test history. Signed-in data
// comes from the page; demo mode reads the roadmap and mocks from localStorage after mount.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { AVATARS } from '@/components/brand/avatars';
import { LineChart } from '@/components/charts/LineChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { Flame } from '@/components/shell/icons';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import type { MockAttempt } from '@/features/exam/lib/mock';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import { type SettingsPatch, saveSettings } from '@/features/settings/actions';
import { readLocalSettings, writeLocalSettings } from '@/features/settings/local';
import type { AccessorySlot } from '@/features/shop/catalog';
import { itemById } from '@/features/shop/catalog';
import { useWallet } from '@/features/shop/lib/use-wallet';
import type { ServerWallet } from '@/features/shop/queries';
import { demoRows } from '@/features/social/lib/demo-ranking';
import type { Scope } from '@/features/social/lib/ranking';
import { AIMAGS } from '@/lib/aimags';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { DOMAIN_AXES, domainRadar, type QuestionMeta, resolve } from '../lib/radar';
import { EMPTY_BOARDS, EMPTY_RANKS, type ProfileBoards, type ProfileRanks, rankSummary } from '../lib/ranks';
import type { RawAnswer } from '../queries';
import { AboutCard, type AboutMe } from './AboutCard';

export type ProfileUser = {
  name: string;
  avatarId?: string;
  aimag?: string;
  school?: string;
  age?: number;
  level: number;
  levelPct: number;
  xp: number;
  streak: number;
};
export type ProfileServer = { mocks: MockAttempt[]; answers: RawAnswer[] };

function Card({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('soft-card grid content-start gap-4 p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-[17px] text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const field = 'h-11 w-full rounded-2xl border border-line bg-paper-2 px-3 text-[14px] text-ink';

function Header({
  user,
  demo,
  onSaved,
  gems,
  look,
}: {
  user: ProfileUser;
  demo: boolean;
  onSaved: (p: Partial<ProfileUser>) => void;
  gems: number;
  look: {
    frame?: string;
    outfit?: string;
    banner?: string;
    accessories?: Partial<Record<AccessorySlot, string>>;
  };
}) {
  const t = useT('profile');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [avatarOnly, setAvatarOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: user.name,
    avatarId: user.avatarId ?? '',
    aimag: user.aimag ?? '',
    school: user.school ?? '',
    age: user.age?.toString() ?? '',
  });
  useEffect(
    () =>
      setDraft({
        name: user.name,
        avatarId: user.avatarId ?? '',
        aimag: user.aimag ?? '',
        school: user.school ?? '',
        age: user.age?.toString() ?? '',
      }),
    [user.name, user.avatarId, user.aimag, user.school, user.age],
  );

  const save = async () => {
    setSaving(true);
    try {
      const patch: SettingsPatch = avatarOnly
        ? { avatarId: draft.avatarId }
        : {
            ...(draft.name.trim() && { name: draft.name.trim() }),
            ...(draft.avatarId && { avatarId: draft.avatarId }),
            aimag: (draft.aimag || null) as SettingsPatch['aimag'],
            school: draft.school.trim() || null,
            age: draft.age ? Number(draft.age) : null,
          };
      const r = await saveSettings(patch);
      if (!r.ok && r.reason !== 'demo_mode') return toast(t('header.failed'));
      if (!r.ok) writeLocalSettings(patch);
      onSaved({
        name: patch.name ?? user.name,
        avatarId: patch.avatarId ?? user.avatarId,
        ...(!avatarOnly && {
          aimag: draft.aimag || undefined,
          school: draft.school || undefined,
          age: patch.age ?? undefined,
        }),
      });
      window.dispatchEvent(new CustomEvent('suprep-settings', { detail: patch }));
      setEditing(false);
      router.refresh();
      toast(t('header.saved'));
    } catch {
      toast(t('header.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile-identity soft-card relative grid gap-5 overflow-hidden p-5 md:p-6">
      {look.banner && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-16"
          style={{ background: itemById(look.banner)?.look }}
        />
      )}
      <div className={cn('relative flex flex-wrap items-center gap-4', look.banner && 'pt-6')}>
        <Avatar
          name={user.name || '?'}
          avatarId={editing ? draft.avatarId : user.avatarId}
          size={76}
          frame={look.frame}
          outfit={look.outfit}
          accessories={look.accessories}
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{user.name || '—'}</h1>
          <p className="text-[13.5px] text-ink-3">
            {[t('header.level', { n: user.level }), user.aimag, user.school].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft((d) => ({ ...d, avatarId: user.avatarId ?? AVATARS[0].id }));
                setAvatarOnly(true);
                setEditing(true);
              }}
            >
              {t('header.changeAvatar')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAvatarOnly(false);
                setEditing(true);
              }}
            >
              {t('header.edit')}
            </Button>
          </div>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-paper-2 px-4 py-3">
          <dt className="text-[12px] text-ink-3">{t('header.xp')}</dt>
          <dd className="font-display text-2xl font-bold text-ink tnum">{user.xp.toLocaleString('en-US')}</dd>
          <dd className="mt-1.5 h-1.5 rounded-full bg-line" aria-hidden="true">
            <span className="block h-full rounded-full bg-leaf" style={{ width: `${user.levelPct}%` }} />
          </dd>
        </div>
        <div className="rounded-2xl bg-paper-2 px-4 py-3">
          <dt className="text-[12px] text-ink-3">{t('header.gems')}</dt>
          <dd className="font-display text-2xl font-bold text-ink tnum">💎 {gems}</dd>
        </div>
        <div className="rounded-2xl bg-paper-2 px-4 py-3">
          <dt className="text-[12px] text-ink-3">{t('header.streak')}</dt>
          <dd className="flex items-center gap-1.5 font-display text-2xl font-bold text-ink tnum">
            <Flame size={22} /> {user.streak}
          </dd>
        </div>
      </dl>

      {editing && (
        <form
          className="grid gap-4 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className="grid gap-2" disabled={saving}>
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">{t('header.avatar')}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('header.avatar')}>
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.avatarId === a.id}
                  aria-label={a.id}
                  onClick={() => setDraft((d) => ({ ...d, avatarId: a.id }))}
                  className={cn(
                    'inline-flex size-[52px] shrink-0 items-center justify-center rounded-full p-0.5 leading-none',
                    draft.avatarId === a.id ? 'ring-3 ring-leaf' : 'ring-1 ring-line',
                  )}
                >
                  <Avatar name={draft.name} avatarId={a.id} size={48} />
                </button>
              ))}
            </div>
          </fieldset>
          {!avatarOnly && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
                {t('header.name')}
                <input
                  value={draft.name}
                  maxLength={40}
                  required
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
                {t('header.aimag')}
                <select
                  value={draft.aimag}
                  onChange={(e) => setDraft((d) => ({ ...d, aimag: e.target.value }))}
                  className={field}
                >
                  <option value="">{t('header.aimagNone')}</option>
                  {AIMAGS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
                {t('header.school')}
                <input
                  value={draft.school}
                  maxLength={60}
                  onChange={(e) => setDraft((d) => ({ ...d, school: e.target.value }))}
                  className={field}
                />
              </label>
              <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
                {t('header.age')}
                <input
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  value={draft.age}
                  onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))}
                  className={field}
                />
              </label>
            </div>
          )}
          {demo && <p className="text-[12.5px] text-ink-3">{t('header.demo')}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {t('header.save')}
            </Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
              {t('header.cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function RankCard({ rank, boards, demo }: { rank: ProfileRanks; boards: ProfileBoards; demo: boolean }) {
  const [selectedScope, setSelectedScope] = useState<Scope>('national');
  const t = useT('profile');
  return (
    <Card
      title={t('rank.title')}
      action={
        <Link
          href={`${routes.leaderboard}?scope=national`}
          className="text-[13px] font-bold text-leaf-2 hover:underline"
        >
          {t('rank.more')}
        </Link>
      }
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">{t('rank.week')}</p>
      <div className="grid grid-cols-3 gap-2">
        {(['national', 'aimag', 'friends'] as const).map((scope) => (
          <button
            type="button"
            key={scope}
            aria-pressed={selectedScope === scope}
            onClick={() => setSelectedScope(scope)}
            className={cn(
              'grid justify-items-center gap-1 rounded-2xl border px-2 py-4 text-center transition-colors hover:border-leaf hover:bg-sage',
              selectedScope === scope ? 'border-leaf bg-sage' : 'border-line bg-paper-2',
            )}
          >
            <span className="text-xs text-ink-3">{t(`rank.${scope}`)}</span>
            <span className="font-display text-3xl font-bold text-leaf-2 tnum">
              {rank[scope] ? t('rank.position', { n: rank[scope].rank }) : t('rank.none')}
            </span>
            {demo && rank[scope] && (
              <span className="text-xs text-ink-3">{t('rank.pool', { n: rank[scope].of })}</span>
            )}
          </button>
        ))}
      </div>
      <div className="max-h-[600px] overflow-y-auto overscroll-contain rounded-2xl border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {t('rank.title')} · {t(`rank.${selectedScope}`)}
          </caption>
          <thead className="sticky top-0 z-10 bg-paper-2 text-xs text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-3 text-left">
                #
              </th>
              <th scope="col" className="px-2 py-3 text-left">
                {t('rank.student')}
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                XP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {boards[selectedScope].map((row) => (
              <tr
                key={row.userId}
                className={cn(row.me && 'bg-sage font-bold')}
                aria-current={row.me ? 'true' : undefined}
              >
                <td className="px-3 py-2.5 font-bold text-ink-3 tnum">{row.rank}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} avatarId={row.avatarId} size={32} />
                    <div>
                      <span className="text-ink">{row.name}</span>
                      {row.me && <span className="ml-2 text-xs text-leaf-2">{t('rank.you')}</span>}
                      <p className="text-[11px] font-normal text-ink-3">
                        {t('header.level', { n: row.level })}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-leaf-2 tnum">
                  {row.value.toLocaleString('en-US')}
                </td>
              </tr>
            ))}
            {!boards[selectedScope].length && (
              <tr>
                <td colSpan={3} className="p-5 text-center text-ink-3">
                  {t('rank.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-ink-3">{demo ? t('rank.demo') : t('rank.note')}</p>
    </Card>
  );
}

function SkillRadar({
  answers,
  lastMock,
  meta,
}: {
  answers: RawAnswer[];
  lastMock: MockAttempt | null;
  meta: QuestionMeta;
}) {
  const t = useT('profile');
  const [overlay, setOverlay] = useState(true);
  const resolved = useMemo(() => resolve(answers, meta), [answers, meta]);
  const fromMock = useMemo(
    () =>
      lastMock
        ? resolve(
            lastMock.modules.flatMap((m) =>
              m.answers.map((a) => ({ ...a, at: Date.parse(lastMock.finishedAt ?? lastMock.startedAt) })),
            ),
            meta,
          )
        : [],
    [lastMock, meta],
  );
  const now = domainRadar(resolved);
  const previous = lastMock
    ? domainRadar(fromMock, Date.parse(lastMock.finishedAt ?? lastMock.startedAt))
    : null;
  const axes = DOMAIN_AXES.map((id) => t(`radar.axes.${id}`));
  const hasData = now.some((a) => a.value !== null);
  const series = [
    { id: 'now', label: t('radar.current'), values: now.map((a) => a.value), color: 'var(--chart-1)' },
  ];
  if (overlay && lastMock) {
    // the last test on its own, compared at its own date (no decay)
    series.push({
      id: 'prev',
      label: t('radar.previous'),
      values: previous!.map((a) => a.value),
      color: 'var(--chart-2)',
    });
  }
  return (
    <Card title={t('radar.title')}>
      <p className="text-[13px] font-semibold text-ink-2">{t('radar.domains')}</p>
      {hasData ? (
        <RadarChart axes={axes} series={series} caption={t('radar.caption')} emptyLabel={t('radar.empty')} />
      ) : (
        <div className="grid justify-items-center gap-3 rounded-2xl bg-paper-2 px-4 py-8 text-center">
          <p className="text-[14px] text-ink-2">{t('radar.noData')}</p>
          <Link href={routes.home} className="font-bold text-leaf-2 underline underline-offset-4">
            {t('radar.start')}
          </Link>
        </div>
      )}
      {hasData && overlay && previous ? (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full table-fixed text-xs sm:text-sm">
            <thead className="bg-paper-2 text-ink-2">
              <tr>
                <th scope="col" className="w-[37%] px-3 py-3 text-left">
                  {t('radar.skill')}
                </th>
                <th scope="col" className="px-1 py-3 text-center text-[var(--chart-2)]">
                  {t('radar.previous')}
                </th>
                <th scope="col" className="px-1 py-3 text-center text-[var(--chart-1)]">
                  {t('radar.current')}
                </th>
                <th scope="col" className="px-1 py-3 text-center">
                  {t('radar.change')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {now.map((axis, index) => {
                const before = previous[index].value;
                const delta =
                  axis.value !== null && before !== null
                    ? Math.round(axis.value * 100) - Math.round(before * 100)
                    : null;
                return (
                  <tr key={axis.id}>
                    <th scope="row" className="px-3 py-3 text-left font-semibold text-ink">
                      {axes[index]}
                    </th>
                    <td className="px-1 py-3 text-center font-bold text-[var(--chart-2)] tnum">
                      {before === null ? '—' : `${Math.round(before * 100)}%`}
                    </td>
                    <td className="px-1 py-3 text-center font-bold text-[var(--chart-1)] tnum">
                      {axis.value === null ? '—' : `${Math.round(axis.value * 100)}%`}
                    </td>
                    <td
                      className={cn(
                        'px-1 py-3 text-center font-bold tnum',
                        delta === null || delta === 0
                          ? 'text-ink-3'
                          : delta > 0
                            ? 'text-leaf-2'
                            : 'text-danger',
                      )}
                    >
                      {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                      <span className="block text-[10px] font-normal text-ink-3">
                        {t('radar.percentagePoints')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        hasData && (
          <div className="grid grid-cols-2 gap-2">
            {now.map((axis, index) => (
              <div key={axis.id} className="rounded-xl bg-paper-2 p-3">
                <div className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-ink-2">{axes[index]}</span>
                  <strong className="text-base text-leaf-2 tnum">
                    {axis.value === null ? '—' : `${Math.round(axis.value * 100)}%`}
                  </strong>
                </div>
                <p className="mt-1 text-[11px] text-ink-3">{t('radar.answerCount', { n: axis.n })}</p>
              </div>
            ))}
          </div>
        )
      )}
      {hasData && <p className="text-xs text-ink-3">{t('radar.caption')}</p>}
      {lastMock && hasData && (
        <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
          <input
            type="checkbox"
            checked={overlay}
            onChange={(e) => setOverlay(e.target.checked)}
            className="size-4 accent-[var(--c-leaf)]"
          />
          {t('radar.overlay')}
        </label>
      )}
    </Card>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

function MockHistory({ mocks }: { mocks: MockAttempt[] }) {
  const t = useT('profile');
  const te = useT('exam');
  const chrono = [...mocks].reverse();
  return (
    <Card
      title={t('mocks.title')}
      action={
        <Link href={routes.mock} className="text-[13px] font-bold text-leaf-2 hover:underline">
          {t('mocks.take')}
        </Link>
      }
    >
      {mocks.length === 0 ? (
        <p className="text-[14px] text-ink-2">{t('mocks.none')}</p>
      ) : (
        <>
          {mocks.length > 1 && (
            <LineChart
              caption={t('mocks.chart')}
              points={chrono.map((m) => ({
                x: Date.parse(m.finishedAt!),
                y: m.score ?? 200,
                label: fmtDate(m.finishedAt!),
              }))}
              yMin={200}
              yMax={800}
              yStep={200}
              formatX={(x) => fmtDate(new Date(x).toISOString())}
            />
          )}
          <ul className="grid gap-2">
            {mocks.map((m) => (
              <li key={m.id}>
                <Link
                  href={routes.mockResult(m.id)}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 hover:border-leaf"
                >
                  <span className="font-display text-xl font-bold text-ink tnum">{m.score}</span>
                  <span className="text-[12px] text-ink-3">{t('mocks.score')}</span>
                  <span className="ml-auto text-right text-[12.5px] text-ink-2 tnum">
                    {fmtDate(m.finishedAt!)} · {t('mocks.time', { m: Math.round(m.timeUsedSec / 60) })}
                    <span className="block text-ink-3">
                      {DOMAIN_AXES.map(
                        (d) => `${te(`domains.${d}`)} ${m.domains[d].correct}/${m.domains[d].total}`,
                      ).join(' · ')}
                    </span>
                  </span>
                  {m.flagged && <Pill tone="amber">{t('mocks.flagged')}</Pill>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Demo mode: the onboarding answers (OnboardingForm) plus later edits (settings/local.ts). */
function readLocalAbout(fallback: AboutMe): AboutMe {
  let saved: Partial<AboutMe> = {};
  try {
    saved = JSON.parse(localStorage.getItem('suprep:onboarding:v1') ?? '{}') as Partial<AboutMe>;
  } catch {
    // storage blocked or broken: keep the defaults
  }
  const s = readLocalSettings();
  const pick = <K extends keyof AboutMe>(k: K): AboutMe[K] =>
    (s[k as keyof typeof s] as AboutMe[K] | undefined) ?? saved[k] ?? fallback[k];
  return {
    satExp: pick('satExp'),
    lastMathScore: pick('lastMathScore'),
    target: pick('target'),
    examDate: pick('examDate'),
    confidence: pick('confidence'),
    desmos: pick('desmos'),
    studyMinutes: pick('studyMinutes'),
    start: pick('start'),
  };
}

export function ProfileView({
  demo,
  user: initialUser,
  about: initialAbout,
  server,
  meta,
  rank,
  boards = EMPTY_BOARDS,
  wallet = null,
}: {
  wallet?: ServerWallet | null;
  demo: boolean;
  user: ProfileUser;
  about: AboutMe;
  server: ProfileServer | null;
  meta: QuestionMeta;
  rank: ProfileRanks;
  boards?: ProfileBoards;
}) {
  const common = useT('common');
  const [user, setUser] = useState(initialUser);
  const [demoRank, setDemoRank] = useState<ProfileRanks>(EMPTY_RANKS);
  const [demoBoards, setDemoBoards] = useState<ProfileBoards>(EMPTY_BOARDS);
  const [about, setAbout] = useState(initialAbout);
  // remount the card after the demo values load, so its edit form starts from them
  const [aboutKey, setAboutKey] = useState(0);
  const w = useWallet(demo, wallet);
  const [data, setData] = useState<ProfileServer>(server ?? { mocks: [], answers: [] });
  useEffect(() => {
    if (!demo) return;
    const local = loadLocalRoadmap();
    setData({ mocks: loadLocalMocks(), answers: local.history });
    const s = readLocalSettings();
    setUser((u) => ({
      ...u,
      name: s.name ?? u.name,
      avatarId: s.avatarId ?? u.avatarId,
      aimag: s.aimag ?? u.aimag,
      school: s.school ?? u.school,
      age: s.age ?? undefined,
    }));
    setAbout((a) => readLocalAbout(a));
    setAboutKey((k) => k + 1);
  }, [demo]);

  useEffect(() => {
    if (!demo) return;
    const next = {
      national: demoRows('national', 'xp_week', user),
      aimag: demoRows('aimag', 'xp_week', user),
      friends: demoRows('friends', 'xp_week', user),
    };
    setDemoBoards(next);
    setDemoRank({
      national: rankSummary(next.national),
      aimag: rankSummary(next.aimag),
      friends: rankSummary(next.friends),
    });
  }, [demo, user]);

  const mockAnswers = useMemo(
    () =>
      data.mocks.flatMap((m) =>
        m.modules.flatMap((mod) =>
          mod.answers.map((a) => ({ ...a, at: Date.parse(m.finishedAt ?? m.startedAt) })),
        ),
      ),
    [data.mocks],
  );

  return (
    <div className="workspace-page max-w-6xl">
      <Header
        user={user}
        demo={demo}
        onSaved={(p) => setUser((u) => ({ ...u, ...p }))}
        gems={w.balance}
        look={{
          frame: w.equipped.frame,
          outfit: w.equipped.outfit,
          banner: w.equipped.banner,
          accessories: { head: w.equipped.head, eyes: w.equipped.eyes, neck: w.equipped.neck },
        }}
      />
      <AboutCard key={aboutKey} about={about} demo={demo} onSaved={setAbout} />
      <nav aria-label={common('shell.profile')} className="grid gap-3">
        {[{ href: routes.planner, label: common('nav.planner') }].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="soft-card flex items-center justify-between gap-3 p-5 font-bold text-leaf-2 transition-colors hover:bg-sage"
          >
            <span>{item.label}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 md:grid-cols-2">
        <SkillRadar
          answers={[...data.answers, ...mockAnswers]}
          lastMock={
            [...data.mocks].sort((a, b) => Date.parse(a.finishedAt!) - Date.parse(b.finishedAt!))[0] ?? null
          }
          meta={meta}
        />
        <RankCard rank={demo ? demoRank : rank} boards={demo ? demoBoards : boards} demo={demo} />
      </div>
      <MockHistory mocks={data.mocks} />
    </div>
  );
}
