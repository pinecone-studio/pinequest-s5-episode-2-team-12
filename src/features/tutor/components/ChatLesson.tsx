'use client';
// Pitch demo · a Desmos lesson inside Суу's chat answer: live graph + one step at a time.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { DESMOS_AI_LESSONS } from '../lib/desmos-lessons';
import { drawLesson, useDesmosCalc } from '../lib/desmos-runtime';

export function ChatLesson({ id }: { id: string }) {
  const t = useT('tutor');
  const lesson = DESMOS_AI_LESSONS.find((l) => l.id === id);
  const box = useRef<HTMLDivElement>(null);
  const { calc, graph } = useDesmosCalc(box, {
    expressions: true,
    expressionsCollapsed: false,
    zoomButtons: false,
  });
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (graph === 'ready' && calc.current && lesson) drawLesson(calc.current, lesson, cur);
  }, [graph, calc, lesson, cur]);

  if (!lesson) return null;
  const step = lesson.steps[cur];
  const last = cur === lesson.steps.length - 1;

  return (
    <div className="grid gap-3 rounded-2xl border border-line bg-paper p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf text-[13px] font-bold text-[var(--c-on-leaf)]">
          {cur + 1}
        </span>
        <p className="min-h-14 text-[15px] leading-relaxed text-ink" aria-live="polite">
          {step.text}
        </p>
      </div>

      <div className="relative h-[300px] overflow-hidden rounded-xl border border-line bg-paper md:h-[340px]">
        <div ref={box} className="absolute inset-0" />
        {graph !== 'ready' && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-[14px] text-ink-3">
            {graph === 'loading' ? t('desmosAi.loading') : t('desmosAi.failed')}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={cur === 0} onClick={() => setCur((c) => c - 1)}>
          ← {t('desmosAi.prev')}
        </Button>
        <Button size="sm" disabled={last} onClick={() => setCur((c) => c + 1)}>
          {t('desmosAi.next')} →
        </Button>
        <span className="flex gap-1" aria-hidden="true">
          {lesson.steps.map((s, i) => (
            <span key={s.text} className={cn('size-2 rounded-full', i <= cur ? 'bg-leaf' : 'bg-line-2')} />
          ))}
        </span>
        <Link
          href={`${routes.desmosHome}/ai?l=${encodeURIComponent(lesson.id)}`}
          className="ml-auto text-[13.5px] font-bold text-leaf-2 underline"
        >
          {t('chat.openDesmos')}
        </Link>
      </div>

      {last && (
        <div className="grid gap-1 rounded-xl bg-sage px-4 py-3 text-[15px] text-ink">
          <span>
            {t('desmosAi.check')}: {lesson.check}
          </span>
          <strong>
            {t('desmosAi.answer')}: {lesson.answer}
          </strong>
        </div>
      )}
    </div>
  );
}
