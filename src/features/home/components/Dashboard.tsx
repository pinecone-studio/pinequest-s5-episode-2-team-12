// Section I · I3 — home dashboard: greeting + plan CTA, exam countdown, scores, next lesson, study plan,
// AI tutor, skills, analytics, domains, streak, league and the next badge.
import Link from 'next/link';
import { Flame, Icon } from '@/components/shell/icons';
import { Bar } from '@/components/ui/Bar';
import { Ring } from '@/components/ui/Ring';
import { ContinueLink, RoadmapContinueCard } from '@/features/roadmap/components/RoadmapContinue';
import type { RoadmapState } from '@/features/roadmap/types';
import type { T } from '@/lib/i18n';
import { calculateLevel } from '@/lib/level';
import { routes } from '@/lib/routes';
import { getUlaanbaatarDate } from '@/lib/streak';
import { BADGES } from '@/mocks/meta';
import { DOMAINS } from '@/mocks/questions';
import type { Domain, LeagueRow, Lesson, Stage, Stats } from '@/types';
import { ExamCountdown } from './ExamCountdown';
import { ScoreCard } from './ScoreCard';

export type DashboardData = {
  name: string;
  target: number;
  examDate: string;
  stats: Stats;
  stages: Stage[];
  done: Set<string>;
  league: LeagueRow[];
  counts: { lessons: number; desmos: number; decks: number; questions: number };
  /** «Монголын аялал»: server state when signed in; demo mode reads localStorage on the client. */
  roadmap: { demo: boolean; server: RoadmapState | null };
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function ubHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ulaanbaatar', hour: 'numeric', hour12: false }).format(
      new Date(),
    ),
  );
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mon..Sun of the current Ulaanbaatar week, with studied flags. */
function week(stats: Stats) {
  const today = getUlaanbaatarDate();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const studied = new Set(
    stats.days.length ? stats.days : Array.from({ length: stats.streak }, (_, i) => addDays(today, -i)),
  );
  return DAY_KEYS.map((k, i) => {
    const key = addDays(today, i - dow);
    return { k, on: studied.has(key), today: key === today };
  });
}

function nextLesson(stages: Stage[], done: Set<string>) {
  for (const stage of stages) {
    const lesson = stage.nodes.find((n) => !done.has(n.id));
    if (lesson) {
      const pct = stage.nodes.filter((n) => done.has(n.id)).length / Math.max(1, stage.nodes.length);
      return { stage, lesson, pct };
    }
  }
  return null;
}

function nextBadge(stages: Stage[], done: Set<string>) {
  for (const stage of stages) {
    if (!stage.badge) continue;
    const left = stage.nodes.filter((n) => !done.has(n.id)).length;
    if (left > 0) {
      const badge = BADGES.find((b) => b.id === stage.badge);
      return { left, total: stage.nodes.length, name: badge?.mn ?? stage.title };
    }
  }
  return null;
}

/* ———————————————————— pieces ———————————————————— */

function SectionHead({ title, href, more }: { title: string; href?: string; more?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-bold text-[19px] text-ink">{title}</h2>
      {href && more && (
        <Link href={href} className="text-[14px] font-semibold text-leaf-2 hover:underline">
          {more}
        </Link>
      )}
    </div>
  );
}

function Hero({
  t,
  name,
  next,
  roadmap,
}: {
  t: T;
  name: string;
  next: string;
  roadmap: DashboardData['roadmap'];
}) {
  const h = ubHour();
  const greet = h < 12 ? 'morning' : h < 18 ? 'day' : 'evening';
  return (
    <section className="hero relative overflow-hidden rounded-[32px] min-h-[300px] md:min-h-[340px] p-6 md:p-10 flex flex-col justify-center">
      <HeroScenery />
      {/* the Suprep cat, peeking in from the right edge */}
      {/* biome-ignore lint/performance/noImgElement: static transparent PNG; next/image adds nothing here */}
      <img
        src="/brand/cat-peek.png"
        alt=""
        width={716}
        height={890}
        className="hero-cat absolute right-0 bottom-0 h-[44%] sm:h-[70%] md:h-[84%] w-auto pointer-events-none select-none"
      />

      <div className="relative z-10">
        <h1 className="max-w-[60%] sm:max-w-none font-display font-bold text-[30px] md:text-[44px] leading-[1.08] tracking-tight text-ink">
          {t(`dashboard.greet.${greet}`)}
          <br />
          <span className="text-leaf-2">{name}!</span> <span className="inline-block anim-tilt">👋</span>
        </h1>
        <p className="mt-3 text-[16px] md:text-[18px] leading-snug text-ink-2 max-w-[26ch]">
          {t('dashboard.hero')}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={routes.planner}
            className="inline-flex items-center gap-3 h-[54px] px-7 rounded-2xl bg-leaf text-[var(--c-on-leaf)] font-bold text-[16px] shadow-[0_14px_28px_-12px_var(--c-leaf)] hover:brightness-105 active:translate-y-px transition"
          >
            {t('dashboard.cta')}
            <Icon name="arrow" size={20} />
          </Link>
          <ContinueLink
            {...roadmap}
            fallback={next}
            className="inline-flex items-center h-[54px] px-5 rounded-2xl bg-paper/70 backdrop-blur text-ink font-bold text-[15px] hover:bg-paper"
          >
            {t('dashboard.continueCta')}
          </ContinueLink>
        </div>
      </div>
    </section>
  );
}

/** Soft green hills and floating math glyphs behind the hero text. */
function HeroScenery() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1000 340"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path d="M0 270 C160 220 300 250 430 236 S720 190 1000 230 V340 H0Z" fill="var(--hero-hill-1)" />
      <path d="M0 300 C200 270 360 300 560 280 S860 250 1000 276 V340 H0Z" fill="var(--hero-hill-2)" />
      <g
        fill="none"
        stroke="var(--hero-glyph)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fontFamily="var(--font-sans)"
      >
        <circle cx="560" cy="70" r="26" />
        <path d="M548 214 l14 -26 l14 26 z" />
        <path d="M470 180 h26 M483 167 v26" />
      </g>
      <g fill="var(--hero-glyph)" fontFamily="var(--font-display)" fontWeight="700">
        <text x="604" y="236" fontSize="34">
          π
        </text>
        <text x="590" y="160" fontSize="28">
          √x
        </text>
        <text x="520" y="138" fontSize="22">
          x²
        </text>
      </g>
    </svg>
  );
}

function ContinueCard({ t, item }: { t: T; item: { stage: Stage; lesson: Lesson; pct: number } }) {
  const { stage, lesson, pct } = item;
  return (
    <section>
      <SectionHead
        title={t('dashboard.continue.title')}
        href={routes.journey}
        more={t('dashboard.continue.all')}
      />
      <div className="soft-card p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
        <div className="relative shrink-0 h-28 sm:w-52 rounded-2xl overflow-hidden grid place-items-center bg-[linear-gradient(135deg,var(--c-forest-2),var(--c-leaf-2))] text-[var(--c-on-forest)]">
          <span className="absolute -right-3 -bottom-6 font-display font-black text-[110px] leading-none opacity-15">
            {stage.no}
          </span>
          <span className="grid justify-items-center gap-1 text-center px-3">
            <span className="font-display font-bold text-[30px] leading-none">{stage.no}</span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] opacity-80">
              {stage.en}
            </span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[19px] text-ink truncate">{lesson.title}</div>
          <div className="mt-1 text-[14.5px] text-ink-2">
            {stage.title} ·{' '}
            {t('dashboard.continue.meta', {
              stage: stage.no,
              minutes: lesson.minutes ?? 5,
              xp: lesson.xp ?? 10,
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 max-w-[420px]">
            <Bar value={pct} h={9} className="flex-1" />
            <span className="text-[14px] font-semibold text-ink-2 tnum">{Math.round(pct * 100)}%</span>
          </div>
        </div>
        <Link
          href={routes.lesson(lesson.id)}
          className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-2xl bg-leaf text-[var(--c-on-leaf)] font-bold shadow-[0_12px_24px_-12px_var(--c-leaf)] hover:brightness-105"
        >
          <Icon name="play" size={16} />
          {t('dashboard.continue.start')}
        </Link>
      </div>
    </section>
  );
}

const SKILL_TONES = {
  journey: { bg: 'var(--c-sage)', fg: 'var(--c-leaf)' },
  desmos: { bg: 'var(--c-teal-soft)', fg: 'var(--c-teal)' },
  cards: { bg: 'var(--c-amber-soft)', fg: 'var(--c-amber)' },
  bank: { bg: 'var(--c-rose-soft)', fg: 'var(--c-rose)' },
} as const;

function Skills({ t, counts }: { t: T; counts: DashboardData['counts'] }) {
  const items = [
    {
      key: 'journey',
      icon: 'journey',
      href: routes.journey,
      sub: t('dashboard.skills.lessons', { n: counts.lessons }),
    },
    {
      key: 'desmos',
      icon: 'desmos',
      href: routes.desmosHome,
      sub: t('dashboard.skills.lessons', { n: counts.desmos }),
    },
    {
      key: 'cards',
      icon: 'cards',
      href: routes.cards,
      sub: t('dashboard.skills.decks', { n: counts.decks }),
    },
    {
      key: 'bank',
      icon: 'bank',
      href: routes.bank(),
      sub: t('dashboard.skills.questions', { n: counts.questions }),
    },
  ] as const;
  return (
    <section>
      <SectionHead title={t('dashboard.skills.title')} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((s) => {
          const tone = SKILL_TONES[s.key];
          return (
            <Link
              key={s.key}
              href={s.href}
              className="group rounded-3xl p-3.5 flex items-center gap-3 lift"
              style={{ background: `color-mix(in srgb, ${tone.bg} 75%, var(--c-paper))` }}
            >
              <span
                className="grid place-items-center size-11 rounded-full text-white shrink-0 shadow-[0_8px_16px_-8px_currentColor]"
                style={{ background: tone.fg, color: tone.fg }}
              >
                <Icon name={s.icon} size={22} className="text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink leading-tight">
                  {t(`dashboard.skills.${s.key}`)}
                </span>
                <span className="block mt-0.5 text-[13px] text-ink-2 whitespace-nowrap">{s.sub}</span>
              </span>
              <Icon
                name="arrow"
                size={17}
                className="hidden 2xl:block text-ink-3 self-end group-hover:translate-x-0.5 transition shrink-0"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Domains({ t }: { t: T }) {
  const ids = Object.keys(DOMAINS) as Domain[];
  return (
    <section>
      <SectionHead
        title={t('dashboard.domains.title')}
        href={routes.bank()}
        more={t('dashboard.domains.all')}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ids.map((id, i) => (
          <Link
            key={id}
            href={routes.bank({ domain: id })}
            className="soft-card px-4 py-3 flex items-center gap-3 lift"
          >
            <span
              className="grid place-items-center size-10 rounded-full font-display font-bold text-[15px] shrink-0"
              style={{
                background: [
                  'var(--c-sage)',
                  'var(--c-teal-soft)',
                  'var(--c-amber-soft)',
                  'var(--c-rose-soft)',
                ][i],
                color: ['var(--c-leaf-ink)', 'var(--c-teal)', 'var(--c-amber)', 'var(--c-rose)'][i],
              }}
            >
              {['x', 'ƒ', '%', '△'][i]}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-ink text-[14px] leading-tight line-clamp-2">
                {DOMAINS[id].mn}
              </span>
              <span className="block text-[13px] text-ink-3">
                {t('dashboard.domains.share', { share: DOMAINS[id].share })}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function GoalCard({ t, stats }: { t: T; stats: Stats }) {
  const lv = calculateLevel(stats.xp);
  return (
    <section className="soft-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[18px] text-ink">{t('dashboard.goal.title')}</h2>
        <Link
          href={routes.progress}
          className="flex items-center gap-1 text-[14px] font-semibold text-leaf-2"
        >
          {t('dashboard.goal.edit')}
          <Icon name="chevron" size={15} />
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="shrink-0">
          <Ring
            value={lv.progressPercent / 100}
            size={128}
            stroke={11}
            label={t('dashboard.goal.level', { n: lv.level, next: lv.level + 1 })}
          >
            <div className="grid justify-items-center leading-none">
              <span className={stats.streak > 0 ? '' : 'grayscale opacity-40'}>
                <Flame size={22} />
              </span>
              <span className="mt-1 font-bold text-[20px] text-ink tnum">
                {stats.xp}
                <span className="text-[13px] text-ink-2 font-semibold"> / {lv.nextLevelXp}</span>
              </span>
              <span className="mt-1 text-[12px] text-ink-3">XP</span>
            </div>
          </Ring>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink">
            {t(stats.streak > 0 ? 'dashboard.goal.great' : 'dashboard.goal.start')}
          </div>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">
            {stats.streak > 0
              ? `${t('dashboard.goal.streak', { n: stats.streak })} 🔥`
              : t('dashboard.goal.startBody')}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-leaf-2">
            {t('dashboard.goal.level', { n: lv.level, next: lv.level + 1 })}
          </p>
        </div>
      </div>
      <ol className="mt-5 grid grid-cols-7 gap-1 text-center">
        {week(stats).map((d) => (
          <li key={d.k} className="grid justify-items-center gap-1.5">
            <span
              className={
                d.on
                  ? 'grid place-items-center size-8 rounded-full bg-leaf text-[var(--c-on-leaf)]'
                  : `size-8 rounded-full border-2 ${d.today ? 'border-leaf' : 'border-line-2'}`
              }
            >
              {d.on && <Icon name="check" size={16} strokeWidth={2.6} />}
            </span>
            <span className={`text-[12px] ${d.today ? 'font-bold text-ink' : 'text-ink-3'}`}>
              {t(`dashboard.days.${d.k}`)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LeagueCard({ t, rows }: { t: T; rows: LeagueRow[] }) {
  const top = rows.slice(0, 5);
  const me = rows.findIndex((r) => r.me);
  if (me >= 5) top[4] = rows[me];
  const medal = ['#f2c94c', '#c0c7c2', '#e0904b'];
  return (
    <section className="soft-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-[18px] text-ink">{t('dashboard.league.title')}</h2>
        <Link
          href={routes.league}
          className="text-[13px] font-semibold text-ink-2 px-3 h-8 grid place-items-center rounded-full bg-paper-2"
        >
          {t('dashboard.league.week')}
        </Link>
      </div>
      {rows.length === 0 && (
        <div className="grid justify-items-center text-center gap-2 py-5">
          <span className="grid place-items-center size-14 rounded-full bg-paper-2 text-ink-3">
            <Icon name="league" size={26} />
          </span>
          <p className="font-bold text-ink">{t('dashboard.league.emptyTitle')}</p>
          <p className="text-[13.5px] text-ink-2 max-w-[26ch]">{t('dashboard.league.emptyBody')}</p>
          <Link href={routes.journey} className="mt-1 text-[14px] font-bold text-leaf-2 hover:underline">
            {t('dashboard.league.emptyCta')}
          </Link>
        </div>
      )}
      <ol className="grid gap-1">
        {top.map((r) => {
          const rank = rows.indexOf(r) + 1;
          return (
            <li
              key={r.userId}
              className={`flex items-center gap-3 h-[52px] px-2 rounded-2xl ${r.me ? 'bg-sage' : ''}`}
            >
              <span
                className="grid place-items-center size-7 rounded-full text-[13px] font-bold tnum shrink-0"
                style={
                  rank <= 3 ? { background: medal[rank - 1], color: '#3a2a00' } : { color: 'var(--c-ink-2)' }
                }
              >
                {rank}
              </span>
              <span
                className="grid place-items-center size-9 rounded-full font-bold text-[14px] shrink-0"
                style={{
                  background: r.me ? 'var(--c-leaf)' : 'var(--c-paper-2)',
                  color: r.me ? 'var(--c-on-leaf)' : 'var(--c-ink-2)',
                }}
              >
                {r.name[0]}
              </span>
              <span className={`flex-1 truncate font-semibold ${r.me ? 'text-leaf-2' : 'text-ink'}`}>
                {r.name}
                {rank === 1 && ' 👑'}
              </span>
              <span className={`text-[13px] font-semibold tnum ${r.me ? 'text-leaf-2' : 'text-ink-2'}`}>
                {r.xp.toLocaleString('en-US')} XP
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RewardCard({ t, reward }: { t: T; reward: { left: number; total: number; name: string } }) {
  return (
    <Link href={routes.achievements} className="block rounded-[28px] p-5 reward-card lift">
      <div className="flex items-center gap-4">
        <span className="text-[56px] leading-none anim-floaty" aria-hidden="true">
          🎁
        </span>
        <div className="min-w-0">
          <p className="text-[14px] text-ink-2">{t('dashboard.reward.body', { n: reward.left })}</p>
          <p className="font-bold text-[17px] leading-snug text-ink">
            {t('dashboard.reward.badge', { badge: reward.name })}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Bar value={(reward.total - reward.left) / reward.total} h={8} className="flex-1" />
        <span className="text-[13px] font-semibold text-ink-2 tnum">
          {reward.total - reward.left} / {reward.total}
        </span>
        <span className="grid place-items-center size-8 rounded-full bg-paper text-leaf-2">
          <Icon name="chevron" size={16} />
        </span>
      </div>
    </Link>
  );
}

function ScoreBanner({ t }: { t: T }) {
  return (
    <section className="soft-card px-4 py-3.5 md:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
      {/* biome-ignore lint/performance/noImgElement: tiny static brand mark */}
      <img
        src="/brand/logo-cat.png"
        alt=""
        width={26}
        height={33}
        className="logo-cat shrink-0 hidden sm:block"
      />
      <p className="flex-1 text-[15px] text-ink-2">
        <span className="font-bold text-ink">{t('dashboard.banner.title')}</span> {t('dashboard.banner.body')}
      </p>
      <a
        href="#scores"
        className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-sage text-leaf-2 font-bold text-[14px] hover:brightness-95"
      >
        {t('dashboard.banner.cta')}
      </a>
    </section>
  );
}

function StudyPlanCard({ t }: { t: T }) {
  return (
    <section className="soft-card p-6 grid justify-items-center content-center text-center gap-3">
      <div className="flex items-end gap-1" aria-hidden="true">
        {/* biome-ignore lint/performance/noImgElement: tiny static brand mark */}
        <img src="/brand/logo-cat.png" alt="" width={44} height={56} className="logo-cat" />
        <span className="grid place-items-center size-12 rounded-2xl bg-sage text-leaf-2 -rotate-6">
          <Icon name="planner" size={24} />
        </span>
      </div>
      <h3 className="font-bold text-[18px] text-ink">{t('dashboard.plan.emptyTitle')}</h3>
      <p className="text-[14px] text-ink-2 max-w-[34ch]">{t('dashboard.plan.emptyBody')}</p>
      <Link
        href={routes.planner}
        className="mt-1 inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-leaf text-[var(--c-on-leaf)] font-bold text-[14.5px] hover:brightness-105"
      >
        {t('dashboard.plan.cta')}
        <Icon name="arrow" size={17} />
      </Link>
    </section>
  );
}

function TutorCard({ t }: { t: T }) {
  return (
    <section className="tutor-card relative overflow-hidden rounded-[26px] p-6 grid content-between gap-4">
      <div>
        <h3 className="font-bold text-[19px] leading-snug text-ink max-w-[22ch]">
          {t('dashboard.tutor.title')}
        </h3>
        <ul className="mt-3 grid gap-2">
          {(['p1', 'p2', 'p3'] as const).map((k) => (
            <li key={k} className="flex items-start gap-2 text-[14px] text-ink-2">
              <Icon name="check" size={17} strokeWidth={2.4} className="text-leaf mt-0.5 shrink-0" />
              {t(`dashboard.tutor.${k}`)}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={routes.tutor()}
        className="justify-self-start inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-forest text-cream font-bold text-[14.5px] hover:brightness-110"
      >
        <Icon name="tutor" size={18} />
        {t('dashboard.tutor.cta')}
      </Link>
      {/* biome-ignore lint/performance/noImgElement: static transparent PNG */}
      <img
        src="/brand/cat-peek.png"
        alt=""
        width={716}
        height={890}
        className="hero-cat absolute -right-3 -bottom-4 h-[46%] w-auto pointer-events-none select-none opacity-95"
      />
    </section>
  );
}

function Analytics({ t, data }: { t: T; data: DashboardData }) {
  const m = Object.values(data.stats.mastery);
  const avg = m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : null;
  const tiles = [
    { k: 'lessons', v: `${data.done.size}`, sub: `/ ${data.counts.lessons}` },
    { k: 'xp', v: data.stats.xp.toLocaleString('en-US'), sub: '' },
    { k: 'days', v: `${data.stats.days.length}`, sub: '' },
    { k: 'mastery', v: avg === null ? '—' : `${avg}%`, sub: '' },
  ];
  const empty = data.done.size === 0 && data.stats.xp === 0;
  return (
    <section>
      <SectionHead
        title={t('dashboard.analytics.title')}
        href={routes.progress}
        more={t('dashboard.analytics.all')}
      />
      <div className="soft-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
        {tiles.map((x, i) => (
          <div
            key={x.k}
            className={`p-5 ${i % 2 ? 'border-l border-line' : ''} ${i > 1 ? 'border-t lg:border-t-0 border-line' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <div className="font-display font-bold text-[26px] leading-none text-ink tnum">
              {x.v}
              {x.sub && <span className="text-[14px] font-semibold text-ink-3"> {x.sub}</span>}
            </div>
            <div className="mt-2 text-[13.5px] text-ink-2">{t(`dashboard.analytics.${x.k}`)}</div>
          </div>
        ))}
      </div>
      {empty && <p className="mt-2.5 text-[13.5px] text-ink-3">{t('dashboard.analytics.empty')}</p>}
    </section>
  );
}

/* ———————————————————— page ———————————————————— */

export function Dashboard({ t, data }: { t: T; data: DashboardData }) {
  const next = nextLesson(data.stages, data.done);
  const reward = nextBadge(data.stages, data.done);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="grid gap-7 min-w-0 stagger">
        <Hero
          t={t}
          name={data.name}
          next={next ? routes.lesson(next.lesson.id) : routes.journey}
          roadmap={data.roadmap}
        />
        <ScoreBanner t={t} />
        <RoadmapContinueCard {...data.roadmap} fallback={next && <ContinueCard t={t} item={next} />} />
        <section>
          <SectionHead
            title={t('dashboard.plan.title')}
            href={routes.planner}
            more={t('dashboard.continue.all')}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <StudyPlanCard t={t} />
            <TutorCard t={t} />
          </div>
        </section>
        <Skills t={t} counts={data.counts} />
        <Analytics t={t} data={data} />
        <Domains t={t} />
      </div>
      <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 stagger">
        <ExamCountdown examDate={data.examDate} />
        <ScoreCard target={data.target} />
        <GoalCard t={t} stats={data.stats} />
        <LeagueCard t={t} rows={data.league} />
        {reward && <RewardCard t={t} reward={reward} />}
      </aside>
    </div>
  );
}
