'use client';
// /profile: who I am (editable), my ranking, the skill radar, full-test history. Signed-in data
// comes from the page; demo mode reads the roadmap and mocks from localStorage after mount.
import Link from 'next/link';
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
import { itemById } from '@/features/shop/catalog';
import { useWallet } from '@/features/shop/lib/use-wallet';
import type { ServerWallet } from '@/features/shop/queries';
import { AIMAGS } from '@/lib/aimags';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { DOMAIN_AXES, domainRadar, type QuestionMeta, resolve } from '../lib/radar';
import type { RawAnswer } from '../queries';
import { AboutCard, type AboutMe } from './AboutCard';

export type ProfileUser = {
  name: string;
  avatarId?: string;
  aimag?: string;
  school?: string;
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
  look: { frame?: string; outfit?: string; banner?: string };
}) {
  const t = useT('profile');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: user.name,
    avatarId: user.avatarId ?? '',
    aimag: user.aimag ?? '',
    school: user.school ?? '',
  });
  useEffect(
    () =>
      setDraft({
        name: user.name,
        avatarId: user.avatarId ?? '',
        aimag: user.aimag ?? '',
        school: user.school ?? '',
      }),
    [user.name, user.avatarId, user.aimag, user.school],
  );

  const save = async () => {
    const patch: SettingsPatch = {
      ...(draft.name.trim() && { name: draft.name.trim() }),
      ...(draft.avatarId && { avatarId: draft.avatarId }),
      aimag: (draft.aimag || null) as SettingsPatch['aimag'],
      school: draft.school.trim() || null,
    };
    const r = await saveSettings(patch);
    if (!r.ok && r.reason !== 'demo_mode') return toast(t('header.failed'));
    if (!r.ok) writeLocalSettings(patch);
    onSaved({
      name: patch.name ?? user.name,
      avatarId: patch.avatarId ?? user.avatarId,
      aimag: draft.aimag || undefined,
      school: draft.school || undefined,
    });
    setEditing(false);
    toast(t('header.saved'));
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
          avatarId={user.avatarId}
          size={76}
          frame={look.frame}
          outfit={look.outfit}
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{user.name || '—'}</h1>
          <p className="text-[13.5px] text-ink-3">
            {[t('header.level', { n: user.level }), user.aimag, user.school].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t('header.edit')}
          </Button>
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
          <fieldset className="grid gap-2">
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
                    'rounded-full p-0.5',
                    draft.avatarId === a.id ? 'ring-3 ring-leaf' : 'ring-1 ring-line',
                  )}
                >
                  <Avatar name={draft.name} avatarId={a.id} size={48} />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
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
          </div>
          {demo && <p className="text-[12.5px] text-ink-3">{t('header.demo')}</p>}
          <div className="flex gap-2">
            <Button type="submit">{t('header.save')}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t('header.cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function RankCard({ rank, demo }: { rank: { rank: number; of: number } | null; demo: boolean }) {
  const t = useT('profile');
  const cells: [string, string][] = [
    [t('rank.national'), rank ? t('rank.position', { n: rank.rank }) : t('rank.none')],
    [t('rank.aimag'), t('rank.none')],
    [t('rank.friends'), t('rank.none')],
  ];
  return (
    <Card
      title={t('rank.title')}
      action={
        <Link href={routes.leaderboard} className="text-[13px] font-bold text-leaf-2 hover:underline">
          {t('rank.more')}
        </Link>
      }
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">{t('rank.week')}</p>
      <dl className="grid grid-cols-3 gap-2">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-paper-2 px-3 py-2.5 text-center">
            <dt className="text-[12px] text-ink-3">{k}</dt>
            <dd className="font-display text-xl font-bold text-ink tnum">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12.5px] text-ink-3">{demo ? t('rank.demo') : t('rank.soon')}</p>
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
  const [overlay, setOverlay] = useState(false);
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
  const axes = DOMAIN_AXES.map((id) => t(`radar.axes.${id}`));
  const hasData = now.some((a) => a.value !== null);
  const series = [
    { id: 'now', label: t('radar.current'), values: now.map((a) => a.value), color: 'var(--chart-1)' },
  ];
  if (overlay && lastMock) {
    // the last test on its own, compared at its own date (no decay)
    const prev = domainRadar(fromMock, Date.parse(lastMock.finishedAt ?? lastMock.startedAt));
    series.push({
      id: 'prev',
      label: t('radar.previous'),
      values: prev.map((a) => a.value),
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
  wallet = null,
}: {
  wallet?: ServerWallet | null;
  demo: boolean;
  user: ProfileUser;
  about: AboutMe;
  server: ProfileServer | null;
  meta: QuestionMeta;
  rank: { rank: number; of: number } | null;
}) {
  const common = useT('common');
  const [user, setUser] = useState(initialUser);
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
    }));
    setAbout((a) => readLocalAbout(a));
    setAboutKey((k) => k + 1);
  }, [demo]);

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
        look={{ frame: w.equipped.frame, outfit: w.equipped.outfit, banner: w.equipped.banner }}
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
          lastMock={data.mocks[0] ?? null}
          meta={meta}
        />
        <RankCard rank={rank} demo={demo} />
      </div>
      <MockHistory mocks={data.mocks} />
    </div>
  );
}
