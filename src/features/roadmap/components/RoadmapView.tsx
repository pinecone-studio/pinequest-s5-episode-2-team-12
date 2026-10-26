'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useMemo, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { SAMPLE_AVAILABLE, sampleState } from '../lib/sample';
import { isOpen } from '../lib/state';
import { canRetake, frontier } from '../lib/unlock';
import { stopViews } from '../lib/view';
import type { RoadmapState } from '../types';
import { RoadmapMap } from './RoadmapMap';
import { StopPanel } from './StopPanel';
import { skip, useRoadmapState } from './store';

const ctaClass =
  'btn3d inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-[14px] font-bold mb-[5px]';
const lime = {
  '--face': 'var(--c-lime)',
  '--edge': 'var(--c-lime-2)',
  color: 'var(--c-on-lime)',
} as React.CSSProperties;

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

/** The home screen: the map fills the viewport; prompts float over it. */
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
  // The first unfinished stop stays visible even before placement is completed.
  const fr = frontier(state.stops);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const sel = views.find((v) => v.stop.no === selected);
  const finished = open && fr === null;

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

  const closePanel = useCallback(() => setSelected(null), []);

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
        selectedNo={selected}
        className="h-full w-full"
        fullBleed
      />

      <div className="pointer-events-none absolute inset-x-0 top-[72px] z-10 grid justify-items-center gap-2 gutter sm:justify-items-start">
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

      <StopPanel
        v={sel}
        views={views}
        state={state}
        open={open || sample}
        demo={demo}
        history={loaded.history}
        onClose={closePanel}
        onMove={setSelected}
      />
    </div>
  );
}
