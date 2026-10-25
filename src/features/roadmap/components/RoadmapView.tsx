'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { SAMPLE_AVAILABLE, sampleState } from '../lib/sample';
import { isOpen, masteryAt } from '../lib/state';
import { canRetake, frontier } from '../lib/unlock';
import { type StopView, stopViews } from '../lib/view';
import type { RoadmapState } from '../types';
import { RoadmapHeader } from './RoadmapHeader';
import { RoadmapMap } from './RoadmapMap';
import { StopCard } from './StopCard';
import { skip, useRoadmapState } from './store';

const ctaClass =
  'btn3d inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-[14px] font-bold mb-[5px]';
const lime = {
  '--face': 'var(--c-lime)',
  '--edge': 'var(--c-lime-2)',
  color: 'var(--c-on-lime)',
} as React.CSSProperties;
const soft = {
  '--face': 'var(--c-sage)',
  '--edge': 'var(--c-sage-2)',
  color: 'var(--c-leaf-ink)',
} as React.CSSProperties;

function SheetBody({ v, state, open }: { v: StopView; state: RoadmapState; open: boolean }) {
  const t = useT('roadmap');
  const mastery = masteryAt(state, v.stop.no);
  const done = v.status === 'completed' || v.status === 'tested-out';
  return (
    <div className="flex flex-col gap-4">
      <StopCard v={v} size="full" className="border-0 p-0" />
      <dl className="grid grid-cols-2 gap-2 text-[13px]">
        {[
          [t('sheet.masteryLabel'), t(`mastery.${mastery}`)],
          [t('sheet.setLabel'), t('sheet.set', { n: v.ring.total })],
          ...(v.progress.attempts > 0
            ? [
                [t('sheet.bestLabel'), `${Math.round(v.progress.best * 100)}%`],
                [t('sheet.attemptsLabel'), String(v.progress.attempts)],
              ]
            : []),
        ].map(([k, val]) => (
          <div key={k} className="rounded-2xl bg-paper-2 px-3 py-2">
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-bold text-ink tnum">{val}</dd>
          </div>
        ))}
      </dl>

      {!open ? (
        <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          {t('sheet.closedRoadmap')}
        </p>
      ) : v.status === 'locked' ? (
        <p className="rounded-2xl bg-paper-2 px-4 py-3 text-sm font-semibold text-ink-2">
          {t('sheet.locked')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Link href={routes.roadmapStop(v.stop.no)} className={ctaClass} style={done ? soft : lime}>
            {done ? t('sheet.replay') : v.status === 'current' ? t('sheet.continue') : t('sheet.start')}
          </Link>
          {!done && mastery === 'strong' && (
            <>
              <Link href={routes.roadmapStop(v.stop.no, { testOut: true })} className={ctaClass} style={soft}>
                {t('sheet.testOut')}
              </Link>
              <p className="text-[12.5px] text-ink-3">{t('sheet.testOutHint')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RoadmapView({
  name,
  xp,
  demo,
  server,
  sample = false,
}: {
  name: string;
  xp: number;
  demo: boolean;
  server: RoadmapState | null;
  sample?: boolean;
}) {
  const t = useT('roadmap');
  const router = useRouter();
  const uid = useId();
  const loaded = useRoadmapState(demo, server);
  const state = useMemo(() => (sample ? sampleState() : loaded.state), [sample, loaded.state]);
  const open = isOpen(state);
  const views = useMemo(() => {
    const vs = stopViews(state, open);
    return sample
      ? vs.map((v) => (v.stop.no === SAMPLE_AVAILABLE ? { ...v, status: 'available' as const } : v))
      : vs;
  }, [state, open, sample]);
  const fr = open ? frontier(state.stops) : null;
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = views.find((v) => v.stop.no === selected);
  const total = xp + (demo ? loaded.xp : 0);
  const finished = open && fr === null;

  const onSkip = async () => {
    setBusy(true);
    await skip(demo);
    setBusy(false);
    if (demo) loaded.reload();
    else router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <RoadmapHeader
        name={name}
        xp={total}
        level={state.level}
        stops={state.stops}
        showLevel={open && !state.placement?.skipped}
      />

      {sample && (
        <p className="rounded-2xl bg-teal-soft px-4 py-2 text-sm font-semibold text-teal">
          {t('demoStates')}
        </p>
      )}

      {loaded.ready && !sample && !open && (
        <section
          className="soft-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
          aria-labelledby={`${uid}-title`}
        >
          <div className="w-20 shrink-0 self-center sm:w-24">
            <CatHead mood="happy" />
          </div>
          <div className="flex-1">
            <h2 id={`${uid}-title`} className="font-display text-xl font-bold text-ink">
              {t('gate.title')}
            </h2>
            <p className="mt-1 text-sm text-ink-2">{t('gate.body')}</p>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <Link href={routes.placement} className={ctaClass} style={lime}>
              {t('gate.take')}
            </Link>
            <Button variant="ghost" size="sm" onClick={onSkip} disabled={busy}>
              {t('gate.skip')}
            </Button>
          </div>
        </section>
      )}

      {!sample && open && state.placement?.skipped && (
        <section className="flex flex-col gap-3 rounded-[22px] border border-amber/30 bg-amber-soft p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="font-bold text-amber">{t('gate.skippedTitle')}</h2>
            <p className="text-sm text-ink-2">{t('gate.skippedBody')}</p>
          </div>
          <Link href={routes.placement} className={ctaClass} style={lime}>
            {t('gate.take')}
          </Link>
        </section>
      )}

      {!sample && open && !state.placement?.skipped && canRetake(state.placement, state.stops) && (
        <p className="text-sm text-ink-2">
          <Link href={routes.placement} className="font-bold text-leaf-2 underline underline-offset-4">
            {t('gate.retake')}
          </Link>{' '}
          — {t('gate.retakeBody')}
        </p>
      )}

      {finished && (
        <section className="reward-card flex flex-col gap-3 rounded-[26px] p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">{t('celebrate.title')}</h2>
            <p className="text-sm text-ink-2">{t('celebrate.body')}</p>
          </div>
          <Link href={routes.mock} className={ctaClass} style={lime}>
            {t('celebrate.mock')}
          </Link>
        </section>
      )}

      <RoadmapMap
        views={views}
        frontierNo={fr ?? (sample ? 5 : null)}
        onOpen={setSelected}
        className={cn('h-[68dvh] min-h-[420px] md:h-[calc(100dvh-260px)] md:min-h-[520px]')}
      />

      <Sheet open={sel !== undefined} onClose={() => setSelected(null)} label={sel ? sel.stop.place : ''}>
        {sel && <SheetBody v={sel} state={state} open={open || sample} />}
      </Sheet>
    </div>
  );
}
