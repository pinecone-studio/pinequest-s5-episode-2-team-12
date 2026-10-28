'use client';

import { useEffect, useRef, useState } from 'react';
import { loadDesmos } from '@/features/tutor/components/DesmosAiTutor';
import { useT } from '@/lib/i18n-client';

/** Keep the same calculator mounted while its panel is closed. */
export function PlacementCalculator() {
  const t = useT('roadmap');
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries loading after a network failure.
  useEffect(() => {
    let alive = true;
    let destroy: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    setStatus('loading');
    loadDesmos()
      .then((D) => {
        if (!alive || !host.current) return;
        const calculator = D.GraphingCalculator(host.current, {
          expressionsCollapsed: false,
          settingsMenu: true,
        });
        destroy = () => calculator.destroy();
        observer = new ResizeObserver(() => calculator.resize?.());
        observer.observe(host.current);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('failed'));
    return () => {
      alive = false;
      observer?.disconnect();
      destroy?.();
    };
  }, [attempt]);

  return (
    <div style={{ position: 'relative', height: 'min(65dvh, 560px)', minHeight: 320 }}>
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      {status !== 'ready' && (
        <div
          role="status"
          className="absolute inset-0 grid place-content-center gap-3 bg-paper p-4 text-center text-ink"
        >
          {t(status === 'loading' ? 'placement.calculatorLoading' : 'placement.calculatorFailed')}
          {status === 'failed' && (
            <button
              type="button"
              className="rounded-xl border border-line px-4 py-2"
              onClick={() => setAttempt((n) => n + 1)}
            >
              {t('placement.calculatorRetry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
