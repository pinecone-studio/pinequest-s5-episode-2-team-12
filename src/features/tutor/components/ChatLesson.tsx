'use client';
// Pitch demo · «Desmos шийдэл» card inside Суу's chat answer: step header, live graph with the
// expression list, and the answer at the end.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { DESMOS_AI_LESSONS } from '../lib/desmos-lessons';
import { drawLesson, useDesmosCalc } from '../lib/desmos-runtime';

function GraphIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        className="fill-sage stroke-leaf"
        strokeWidth="1.5"
      />
      <path
        d="M6 16c2-6 3.5-8 5-8s2.5 5 4 5 2-2 3-4"
        className="stroke-leaf-2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The final answer as shown on SAT: a letter badge for a multiple-choice answer, otherwise the value. */
function AnswerChip({ answer }: { answer: string }) {
  const letter = /^[A-D]$/.test(answer.trim());
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-sage px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf text-[15px] font-bold text-[var(--c-on-leaf)]">
        {letter ? answer.trim() : '✓'}
      </span>
      <span className="text-[16px] font-semibold text-ink">{answer}</span>
    </div>
  );
}

export function ChatLesson({ id }: { id: string }) {
  const t = useT('tutor');
  const lesson = DESMOS_AI_LESSONS.find((l) => l.id === id);
  const box = useRef<HTMLDivElement>(null);
  const { calc, graph } = useDesmosCalc(box, { expressions: true, expressionsCollapsed: false });
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (graph === 'ready' && calc.current && lesson) drawLesson(calc.current, lesson, cur);
  }, [graph, calc, lesson, cur]);

  if (!lesson) return null;
  const step = lesson.steps[cur];
  const last = cur === lesson.steps.length - 1;
  const pill =
    'h-9 rounded-full px-3.5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed sm:h-10 sm:px-4 sm:text-[14.5px]';

  return (
    <div className="grid gap-3">
      <section
        aria-label={t('lesson.title')}
        className="overflow-hidden rounded-[22px] border border-line bg-paper"
      >
        <div className="grid gap-2 px-3 pt-4 pb-3 sm:px-4 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto flex items-center gap-2">
              <GraphIcon />
              <span className="whitespace-nowrap font-bold text-[16px] text-leaf-2">{t('lesson.title')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={cur === 0}
                onClick={() => setCur((c) => c - 1)}
                className={cn(
                  pill,
                  'border border-line bg-paper text-ink-2 hover:bg-paper-2 disabled:text-ink-3 disabled:opacity-60',
                )}
              >
                {t('desmosAi.prev')}
              </button>
              <button
                type="button"
                disabled={last}
                onClick={() => setCur((c) => c + 1)}
                className={cn(pill, 'bg-forest text-cream hover:brightness-125 disabled:opacity-35')}
              >
                {t('desmosAi.next')}
              </button>
              <Link
                href={`${routes.desmosHome}/ai?l=${encodeURIComponent(lesson.id)}`}
                aria-label={t('chat.openDesmos')}
                title={t('chat.openDesmos')}
                className="hidden size-10 place-items-center rounded-full border border-line text-ink-2 hover:bg-paper-2 sm:grid"
              >
                <ExpandIcon />
              </Link>
            </div>
          </div>
          <div className="text-[13.5px] text-ink-3">
            {t('lesson.stepOf', { n: cur + 1, total: lesson.steps.length })}
          </div>
          <div aria-live="polite" className="grid gap-1">
            <h3 className="font-display font-bold text-[19px] text-ink">{step.title}</h3>
            <p className="min-h-12 text-[15px] leading-relaxed text-ink-2">{step.text}</p>
          </div>
        </div>

        <div className="relative h-[420px] border-t border-line md:h-[440px]">
          <div ref={box} className="absolute inset-0" />
          {graph !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-[14px] text-ink-3">
              {graph === 'loading' ? t('desmosAi.loading') : t('desmosAi.failed')}
            </div>
          )}
        </div>
      </section>

      {last && (
        <div className="grid gap-2">
          <AnswerChip answer={lesson.answer} />
          <p className="px-1 text-[14px] text-ink-3">
            {t('desmosAi.check')}: {lesson.check}
          </p>
        </div>
      )}
    </div>
  );
}
