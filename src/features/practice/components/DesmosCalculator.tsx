'use client';

import { useEffect, useRef, useState } from 'react';
import { loadDesmos } from '@/features/tutor/lib/desmos-calc';

/** A blank Desmos graphing calculator that fills its parent and follows its size. */
export function DesmosCalculator() {
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
    <div className="relative min-h-0 flex-1">
      <div ref={host} className="absolute inset-0" />
      {status !== 'ready' && (
        <div
          role="status"
          className="absolute inset-0 grid place-content-center gap-3 bg-paper p-4 text-center text-sm text-ink"
        >
          {status === 'loading'
            ? 'Тооцоолуур ачаалж байна…'
            : 'Тооцоолуур ачаалсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.'}
          {status === 'failed' && (
            <button
              type="button"
              className="rounded-xl border border-line px-4 py-2"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Дахин оролдох
            </button>
          )}
        </div>
      )}
    </div>
  );
}
