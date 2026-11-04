'use client';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n-client';
import { type Calc, loadDesmos } from '../lib/desmos-calc';

export function TutorGraph() {
  const t = useT('tutor');
  const box = useRef<HTMLDivElement>(null);
  const calc = useRef<Calc | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry deliberately reloads the calculator after a network failure
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    setState('loading');
    loadDesmos()
      .then((api) => {
        if (cancelled || !box.current) return;
        calc.current = api.GraphingCalculator(box.current, {
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          expressionsTopbar: true,
        });
        setState('ready');
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => calc.current?.resize?.());
          observer.observe(box.current);
        }
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      calc.current?.destroy();
      calc.current = null;
    };
  }, [retry]);
  return (
    <section
      aria-label={t('workspace.graph')}
      className="flex min-h-[420px] min-w-0 flex-col overflow-hidden border-t border-line bg-paper lg:min-h-0 lg:border-l lg:border-t-0"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sage/40 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Desmos</h2>
          <p className="text-xs text-ink-3">{t('workspace.graphHint')}</p>
        </div>
        <a
          href="https://www.desmos.com/calculator"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-leaf-2 underline underline-offset-4"
        >
          {t('workspace.openGraph')} ↗
        </a>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        {['y=2x+1', 'y=x^2'].map((latex, index) => (
          <button
            key={latex}
            type="button"
            disabled={state !== 'ready'}
            onClick={() =>
              calc.current?.setExpression({
                id: `sample-${index}`,
                latex,
                color: index === 0 ? '#17745b' : '#8055c9',
              })
            }
            className="rounded-lg border border-line bg-paper-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-sage disabled:opacity-40"
          >
            {index === 0 ? 'y = 2x + 1' : 'y = x²'}
          </button>
        ))}
        <button
          type="button"
          disabled={state !== 'ready'}
          onClick={() => calc.current?.setBlank()}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs text-ink-3 hover:bg-paper-2 disabled:opacity-40"
        >
          {t('workspace.clear')}
        </button>
      </div>
      <div className="relative min-h-[350px] flex-1">
        <div ref={box} className="absolute inset-0" />
        {state !== 'ready' && (
          <div
            className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-paper p-5 text-center text-sm text-ink-2"
            role="status"
          >
            <p>{t(state === 'loading' ? 'workspace.graphLoading' : 'workspace.graphFailed')}</p>
            {state === 'failed' && (
              <button
                type="button"
                className="rounded-xl bg-sage px-4 py-2 font-bold text-leaf-2"
                onClick={() => setRetry((value) => value + 1)}
              >
                {t('workspace.retryGraph')}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
