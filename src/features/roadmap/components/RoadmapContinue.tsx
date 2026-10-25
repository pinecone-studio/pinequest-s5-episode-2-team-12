'use client';
// Dashboard hooks: once the roadmap is open, «Үргэлжлүүлэх» points at the current stop instead of the journey.
// Client components because demo mode keeps the roadmap in localStorage.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bar } from '@/components/ui/Bar';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { isOpen } from '../lib/state';
import { activeRegion, frontier } from '../lib/unlock';
import { stopViews } from '../lib/view';
import { topicById } from '../topics';
import type { RoadmapState } from '../types';
import { useRoadmapState } from './store';
import { TopicIcon } from './TopicIcon';

type Props = { demo: boolean; server: RoadmapState | null };

function useCurrent({ demo, server }: Props) {
  const { state, ready } = useRoadmapState(demo, server);
  const open = ready && isOpen(state);
  const no = open ? frontier(state.stops) : null;
  const view = no ? stopViews(state, true).find((v) => v.stop.no === no) : undefined;
  return { state, open, view };
}

/** The hero's «Үргэлжлүүлэх» button target. */
export function ContinueLink({
  fallback,
  className,
  children,
  ...p
}: Props & { fallback: string; className: string; children: ReactNode }) {
  const { view } = useCurrent(p);
  return (
    <Link href={view ? routes.roadmapStop(view.stop.no) : fallback} className={className}>
      {children}
    </Link>
  );
}

/** Current-stop card; renders `fallback` (the journey card) until the roadmap is open. */
export function RoadmapContinueCard({ fallback, ...p }: Props & { fallback: ReactNode }) {
  const t = useT('roadmap');
  const { state, view } = useCurrent(p);
  if (!view) return <>{fallback}</>;
  const region = activeRegion(state.stops);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[20px] font-bold text-ink">{t('pages.roadmap.title')}</h2>
        <Link href={routes.roadmap} className="text-[14px] font-semibold text-leaf-2 hover:underline">
          {t('stop.toMap')}
        </Link>
      </div>
      <div className="soft-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center md:gap-6 md:p-5">
        <div className="relative grid h-28 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--c-forest-2),var(--c-leaf-2))] text-[var(--c-on-forest)] sm:w-52">
          <span
            className="absolute -right-3 -bottom-6 font-display text-[110px] font-black leading-none opacity-15"
            aria-hidden="true"
          >
            {view.stop.no}
          </span>
          <span className="grid justify-items-center gap-1 px-3 text-center">
            <TopicIcon name={view.topic.icon} size={30} />
            <span className="font-display text-[18px] font-bold leading-none">{view.stop.place}</span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] opacity-80">
              {t('stopNo', { n: view.stop.no })}
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[19px] font-bold text-ink">{view.topic.title}</div>
          {region && (
            <>
              <div className="mt-1 text-[14.5px] text-ink-2">
                {t('header.nextRegion', { region: region.title })} ·{' '}
                {t('header.regionProgress', { done: region.done, total: region.total })}
              </div>
              <Bar
                value={region.done / region.total}
                h={9}
                className="mt-3 max-w-[420px]"
                label={region.title}
              />
            </>
          )}
        </div>
        <Link
          href={routes.roadmapStop(view.stop.no)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-leaf px-7 font-bold text-[var(--c-on-leaf)] shadow-[0_12px_24px_-12px_var(--c-leaf)] hover:brightness-105"
        >
          {view.status === 'current' ? t('sheet.continue') : t('sheet.start')}
        </Link>
      </div>
    </section>
  );
}

/**
 * Weak topics from the placement test for the AI planner: `ids` (from ?weak=) when given, otherwise the
 * topics the placement marked «weak». Titles in Mongolian.
 */
export function usePlacementWeak(p: Props & { ids: number[] }): string[] {
  const { state, open } = useCurrent(p);
  const ids = p.ids.length
    ? p.ids
    : open && state.placement && !state.placement.skipped
      ? Object.entries(state.mastery)
          .filter(([, m]) => m === 'weak')
          .map(([k]) => Number(k))
          .slice(0, 3)
      : [];
  return ids.map((id) => topicById(id)?.title).filter((x): x is string => Boolean(x));
}
