'use client';
// Results: level (never an SAT score), per-domain breakdown, the 3 weakest topics, «Аяллаа эхлэх», and a
// hand-off to the AI planner with those topics.
import Link from 'next/link';
import { useId } from 'react';
import { CatHead } from '@/components/brand';
import { Bar } from '@/components/ui/Bar';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { DOMAINS } from '@/mocks/questions';
import type { Domain, Question } from '@/types';
import { domainBreakdown, type Graded, weakestTopics } from '../lib/placement';
import { stopByNo } from '../stops';
import { topicById } from '../topics';
import type { RoadmapState } from '../types';
import { useRoadmapState } from './store';
import { TopicIcon } from './TopicIcon';

const lime = {
  '--face': 'var(--c-lime)',
  '--edge': 'var(--c-lime-2)',
  color: 'var(--c-on-lime)',
} as React.CSSProperties;

export function PlacementResults({
  items,
  demo,
  server,
}: {
  items: Question[];
  demo: boolean;
  server: RoadmapState | null;
}) {
  const t = useT('roadmap');
  const { state, ready } = useRoadmapState(demo, server);
  const uid = useId();
  const p = state.placement;

  if (!ready) return <div className="soft-card h-64 animate-pulse" aria-busy="true" />;
  if (!p || p.skipped) {
    return (
      <section className="soft-card mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('pages.results.title')}</h1>
        <p className="text-ink-2">{t('results.none')}</p>
        <Link
          href={routes.placement}
          className="btn3d mb-[5px] inline-flex h-11 items-center rounded-2xl px-5 font-bold"
          style={lime}
        >
          {t('results.take')}
        </Link>
      </section>
    );
  }

  const byId = new Map(items.map((q) => [q.id, q]));
  const graded: Graded[] = p.answers.flatMap((a) => {
    const q = byId.get(a.qid);
    return q ? [{ q, correct: a.correct }] : [];
  });
  const domains = domainBreakdown(graded);
  const weakest = weakestTopics(graded, 3);
  const correct = p.answers.filter((a) => a.correct).length;
  const plannerHref = `${routes.planner}?weak=${weakest.join(',')}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <section className="hero flex flex-col items-center gap-4 rounded-[28px] p-6 text-center sm:flex-row sm:text-left">
        <div className="w-24 shrink-0">
          <CatHead mood={p.level === 'weak' ? 'focus' : 'happy'} />
        </div>
        <div className="flex-1">
          <p className="eyebrow">{t('results.eyebrow')}</p>
          <h1 className="font-display text-3xl font-bold text-ink">
            {t('results.level')}: {t(`level.${p.level}`)}
          </h1>
          <p className="mt-1 text-sm text-ink-2 tnum">
            {t('results.correct', { c: correct, n: p.answers.length })} ·{' '}
            {t('results.score', { pct: Math.round(p.score * 100) })} ·{' '}
            {p.module2 === 'hard' ? t('placement.routeHard') : t('placement.routeEasy')}
          </p>
          <p className="mt-2 text-[13px] text-ink-3">{t('results.levelNote')}</p>
        </div>
      </section>

      <section className="soft-card p-5" aria-labelledby={`${uid}-domains`}>
        <h2 id={`${uid}-domains`} className="font-display text-lg font-bold text-ink">
          {t('results.domains')}
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {(Object.keys(domains) as Domain[]).map((d) => {
            const r = domains[d];
            return (
              <li key={d}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-ink">{DOMAINS[d].mn}</span>
                  <span className="text-ink-2 tnum">
                    {r.correct}/{r.total}
                  </span>
                </div>
                <Bar
                  value={r.total ? r.correct / r.total : 0}
                  tone="leaf"
                  h={8}
                  className="mt-1.5"
                  label={DOMAINS[d].mn}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="soft-card p-5" aria-labelledby={`${uid}-weak`}>
        <h2 id={`${uid}-weak`} className="font-display text-lg font-bold text-ink">
          {t('results.weakest')}
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {weakest.map((id) => {
            const topic = topicById(id)!;
            const stop = stopByNo(id)!;
            return (
              <li key={id} className="flex items-center gap-3 rounded-2xl bg-paper-2 px-3 py-2.5">
                <span
                  className="grid size-10 place-items-center rounded-xl bg-rose-soft text-rose"
                  aria-hidden="true"
                >
                  <TopicIcon name={topic.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{topic.title}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    {t('results.weakestStop', { n: stop.no, place: stop.place })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={routes.home}
          className="btn3d mb-[5px] inline-flex h-[52px] items-center rounded-2xl px-7 font-bold"
          style={lime}
        >
          {t('results.begin')}
        </Link>
        <Link
          href={plannerHref}
          className="inline-flex h-11 items-center rounded-2xl px-4 font-bold text-leaf-2 hover:bg-paper-2"
        >
          {t('results.planner')}
        </Link>
      </div>
    </div>
  );
}
