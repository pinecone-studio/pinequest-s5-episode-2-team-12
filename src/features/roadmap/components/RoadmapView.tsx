'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { itemById } from '@/features/shop/catalog';
import { useWallet } from '@/features/shop/lib/use-wallet';
import type { ServerWallet } from '@/features/shop/queries';
import { SAMPLE_AVAILABLE, sampleState } from '../lib/sample';
import { isOpen } from '../lib/state';
import { frontier } from '../lib/unlock';
import { stopViews } from '../lib/view';
import type { RoadmapState } from '../types';
import { RoadmapMap } from './RoadmapMap';

import { StopPanel, startHref } from './StopPanel';

import { useRoadmapState } from './store';

/** The home screen: the map fills the viewport; prompts float over it. */
export function RoadmapView({
  demo,
  server,
  sample = false,
  wallet = null,
}: {
  demo: boolean;
  server: RoadmapState | null;
  sample?: boolean;
  /** For the equipped map skin (shop). */
  wallet?: ServerWallet | null;
}) {
  const loaded = useRoadmapState(demo, server);
  const { equipped } = useWallet(demo, wallet);
  const skin = equipped.skin ? itemById(equipped.skin)?.look : undefined;
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
  const sel = views.find((v) => v.stop.no === (selected ?? fr ?? (sample ? 5 : 26)));

  const closePanel = useCallback(() => setSelected(null), []);
  const router = useRouter();
  const currentNo = fr ?? (sample ? 5 : null);
  // Other pins open their card. The current stop's pin first brings its own card back if another stop's
  // card is showing; when its card is already showing, it does what that card's «Эхлэх» does.
  const openStop = useCallback(
    (no: number) => {
      const showingCurrent = selected === null || selected === currentNo;
      const v = no === currentNo && showingCurrent ? views.find((x) => x.stop.no === no) : undefined;
      const href = v ? startHref(v, open || sample) : null;
      if (href) router.push(href);
      else setSelected(no);
    },
    [selected, currentNo, views, open, sample, router],
  );

  return (
    <div className="roadmap-home absolute inset-0" data-map-skin={skin}>
      <RoadmapMap
        views={views}
        frontierNo={fr ?? (sample ? 5 : null)}
        onOpen={openStop}
        selectedNo={selected}
        skin={skin}
        outfit={equipped.outfit}
        showTopicHeading={false}
        className="h-full w-full"
        fullBleed
      />

      {sel && (
        <StopPanel
          inline
          night={skin === 'night'}
          v={sel}
          views={views}
          state={state}
          open={open || sample}
          demo={demo}
          history={loaded.history}
          onClose={closePanel}
          onMove={setSelected}
        />
      )}
    </div>
  );
}
