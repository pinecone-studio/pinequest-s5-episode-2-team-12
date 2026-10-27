'use client';
// Алдааны дэвтэр · «Суугийн дүгнэлт»: the patterns in the student's recent mistakes (topic, rushing, slow,
// Desmos-solvable, repeated, SAT words) and what to do next. POST /api/suu/analyze — Суу's analyze skill, or the
// rule engine while Суу is off (labelled). Demo browsers send their own localStorage data.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AnalyzeResponse } from '@/app/api/suu/analyze/route';
import { Pill } from '@/components/ui/Pill';
import { topicById } from '@/features/roadmap/topics';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { localStudentData } from '../lib/local-data';

type Pattern = NonNullable<AnalyzeResponse['analysis']>['patterns'][number];

export function SuuInsights({
  demo,
  count,
  fetchImpl,
}: {
  demo: boolean;
  count: number;
  fetchImpl?: typeof fetch;
}) {
  const t = useT('mistakes');
  const [res, setRes] = useState<AnalyzeResponse | null>(null);
  const [state, setState] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle');
  const doFetch = fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const fetchRef = useRef(doFetch);
  fetchRef.current = doFetch;

  // ask again when the number of mistakes changes (a review session can add or resolve some)
  useEffect(() => {
    if (!count) return;
    const ctrl = new AbortController();
    setState('thinking');
    const send = fetchRef.current;
    send('/api/suu/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(demo ? localStudentData() : {}),
      signal: ctrl.signal,
    })
      .then(async (r) => (r.ok ? ((await r.json()) as AnalyzeResponse) : null))
      .catch(() => null)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setRes(data);
        setState(data ? 'done' : 'error');
      });
    return () => ctrl.abort();
  }, [demo, count]);

  if (!count) return null;

  const label = (p: Pattern) =>
    p.type === 'topic'
      ? (topicById(p.topic ?? 0)?.title ?? '—')
      : p.type === 'vocab'
        ? t('insights.vocab', { word: p.word ?? '' })
        : t(`insights.type.${p.type}`);

  return (
    <section aria-label={t('insights.title')} className="soft-card grid gap-3 p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center overflow-hidden rounded-[30%] bg-sage" aria-hidden>
          {/* biome-ignore lint/performance/noImgElement: static transparent PNG */}
          <img src="/brand/suu-logo-head.png" alt="" width={32} height={32} className="w-[88%] h-auto" />
        </span>
        <h2 className="font-bold text-ink">{t('insights.title')}</h2>
        {res?.analysis && (
          <Pill tone={res.source === 'model' ? 'teal' : 'amber'}>
            {res.source === 'model' ? t('insights.model') : t('insights.rules')}
          </Pill>
        )}
      </div>

      {state === 'thinking' && (
        <p className="animate-pulse text-[14.5px] text-ink-3" role="status">
          {t('insights.thinking')}
        </p>
      )}
      {state === 'error' && <p className="text-[14.5px] text-ink-2">{t('insights.error')}</p>}
      {state === 'done' && res && !res.analysis && (
        <p className="text-[14.5px] text-ink-2">{t('insights.none')}</p>
      )}

      {state === 'done' && res?.analysis && (
        <div className="grid gap-3">
          <p className="text-[15px] leading-relaxed text-ink">{res.analysis.summary}</p>
          {res.analysis.patterns.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={t('insights.patterns')}>
              {res.analysis.patterns.map((p) => (
                <li
                  key={`${p.type}-${p.topic ?? p.word ?? ''}`}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-3 py-1 text-[13.5px] text-ink"
                >
                  {label(p)}
                  <span className="rounded-full bg-danger-soft px-1.5 text-[12px] font-bold text-danger tnum">
                    {p.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {res.analysis.next.length > 0 && (
            <div>
              <h3 className="mb-1 text-[13px] font-bold text-ink-3">{t('insights.next')}</h3>
              <ol className="grid list-inside list-decimal gap-1 text-[14.5px] text-ink">
                {res.analysis.next.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </div>
          )}
          <p className="text-[12.5px] text-ink-3">
            {t('insights.basis', { mistakes: res.mistakes, answered: res.answered })} ·{' '}
            <Link href={routes.planner} className="font-semibold text-leaf-2 underline">
              {t('insights.toPlanner')}
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
