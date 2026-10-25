'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { SAMPLE_AVAILABLE, sampleState } from '../lib/sample';
import { isOpen, masteryAt } from '../lib/state';
import { canRetake, frontier } from '../lib/unlock';
import { type StopView, stopViews } from '../lib/view';
import type { RoadmapState } from '../types';
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

/** One compact card floating over the map: the most important message for this student, or nothing. */
function MapPrompt({
  kind,
  busy,
  onSkip,
}: {
  kind: 'gate' | 'skipped' | 'finished' | 'retake';
  busy: boolean;
  onSkip: () => void;
}) {
  const t = useT('roadmap');
  const uid = useId();
  const body =
    kind === 'gate'
      ? t('gate.body')
      : kind === 'skipped'
        ? t('gate.skippedShort')
        : kind === 'finished'
          ? t('celebrate.body')
          : t('gate.retakeBody');
  const title =
    kind === 'gate'
      ? t('gate.title')
      : kind === 'skipped'
        ? t('gate.skippedTitle')
        : kind === 'finished'
          ? t('celebrate.title')
          : t('gate.retake');
  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="card shadow-pop pointer-events-auto flex w-[min(360px,calc(100vw-32px))] gap-3 p-4 sheet-in"
    >
      <div className="w-12 shrink-0 self-start">
        <CatHead size={48} mood={kind === 'finished' ? 'wow' : 'happy'} />
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <h2 id={`${uid}-title`} className="font-bold leading-snug text-ink">
          {title}
        </h2>
        <p className="text-[13px] leading-snug text-ink-2">{body}</p>
        <div className="flex flex-wrap items-center gap-1">
          {kind === 'finished' ? (
            <Link href={routes.mock} className={ctaClass} style={lime}>
              {t('celebrate.mock')}
            </Link>
          ) : (
            <Link href={routes.placement} className={ctaClass} style={lime}>
              {kind === 'retake' ? t('gate.retake') : t('gate.prompt')}
            </Link>
          )}
          {kind === 'gate' && (
            <Button variant="ghost" size="sm" onClick={onSkip} disabled={busy}>
              {t('gate.skipShort')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The home screen: the map fills the viewport; prompts and the trip chip float over it. */
export function RoadmapView({
  demo,
  server,
  sample = false,
}: {
  demo: boolean;
  server: RoadmapState | null;
  sample?: boolean;
}) {
  const t = useT('roadmap');
  const router = useRouter();
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
  const [dismissed, setDismissed] = useState(false);
  const sel = views.find((v) => v.stop.no === selected);
  const finished = open && fr === null;
  const done = views.filter((v) => v.status === 'completed' || v.status === 'tested-out').length;

  const prompt =
    sample || !loaded.ready
      ? null
      : !open
        ? 'gate'
        : finished
          ? 'finished'
          : state.placement?.skipped
            ? 'skipped'
            : canRetake(state.placement, state.stops)
              ? 'retake'
              : null;

  const onSkip = async () => {
    setBusy(true);
    await skip(demo);
    setBusy(false);
    if (demo) loaded.reload();
    else router.refresh();
  };

  return (
    <div className="absolute inset-0">
      <RoadmapMap
        views={views}
        frontierNo={fr ?? (sample ? 5 : null)}
        onOpen={setSelected}
        className="h-full w-full"
        fullBleed
      />

      <div className="pointer-events-none absolute inset-x-0 top-[72px] grid justify-items-center gap-2 gutter sm:justify-items-start">
        {sample && (
          <p className="pointer-events-auto rounded-2xl bg-teal-soft px-4 py-2 text-sm font-semibold text-teal">
            {t('demoStates')}
          </p>
        )}
        {prompt && !(dismissed && prompt !== 'gate') && (
          <div className="relative">
            <MapPrompt kind={prompt} busy={busy} onSkip={onSkip} />
            {prompt !== 'gate' && (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label={t('sheet.close')}
                className="pointer-events-auto absolute right-2 top-2 grid size-8 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <p
        role="status"
        aria-label={t('trip.label', { done, total: views.length })}
        className="pointer-events-none absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full border border-line bg-paper/90 px-4 py-2 text-[13px] font-bold text-ink shadow-[var(--shadow-card)] backdrop-blur tnum max-sm:left-4 max-sm:translate-x-0"
      >
        {t('trip.chip', { done, total: views.length })}
      </p>

      <Sheet open={sel !== undefined} onClose={() => setSelected(null)} label={sel ? sel.stop.place : ''}>
        {sel && <SheetBody v={sel} state={state} open={open || sample} />}
      </Sheet>
    </div>
  );
}
