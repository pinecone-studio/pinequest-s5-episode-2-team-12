'use client';
// Pitch demo · /desmos/ai — ask Суу a question and it teaches it on a live Desmos graph, one step at a time.
// Uses the six hand-written lessons in ../lib/desmos-lessons.ts (labelled «Жишээ хичээл») until the
// fine-tuned model writes lessons live. The official Desmos API is loaded from desmos.com.
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { DESMOS_AI_LESSONS, type DesmosAiLesson, findLesson } from '../lib/desmos-lessons';
import { drawLesson, useDesmosCalc } from '../lib/desmos-runtime';

export function DesmosAiTutor({ initial }: { initial?: string }) {
  const t = useT('tutor');
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [lesson, setLesson] = useState<DesmosAiLesson | null>(null);
  const [thinking, setThinking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [cur, setCur] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const { calc, graph } = useDesmosCalc(box, { expressionsCollapsed: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const ask = useCallback((question: string) => {
    const q = question.trim();
    if (!q) return;
    setAsked(q);
    setDraft('');
    setNotFound(false);
    setLesson(null);
    setThinking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const found = findLesson(q);
      setThinking(false);
      setCur(0);
      setLesson(found);
      setNotFound(!found);
    }, 1100);
  }, []);

  // open a lesson from the tutor chat link (/desmos/ai?l=slider)
  useEffect(() => {
    const l = DESMOS_AI_LESSONS.find((x) => x.id === initial);
    if (l) ask(l.question);
  }, [initial, ask]);

  // redraw whenever the step, lesson or calculator changes
  useEffect(() => {
    if (graph !== 'ready' || !calc.current) return;
    if (lesson) drawLesson(calc.current, lesson, cur);
    else calc.current.setBlank();
  }, [lesson, cur, graph, calc]);

  useEffect(() => {
    if (!lesson) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setCur((c) => Math.min(c + 1, lesson.steps.length - 1));
      if (e.key === 'ArrowLeft') setCur((c) => Math.max(c - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lesson]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(draft);
  }

  const last = lesson ? cur === lesson.steps.length - 1 : false;

  return (
    <section className="grid gap-5">
      <header>
        <div className="eyebrow mb-2">{t('desmosAi.eyebrow')}</div>
        <h1 className="font-display font-extrabold text-[26px] md:text-[34px] leading-tight text-ink">
          {t('desmosAi.title')}
        </h1>
        <p className="mt-1 text-[15px] text-ink-2">{t('desmosAi.subtitle')}</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-[22px] border border-line bg-paper-2 p-2 pl-4 focus-within:border-leaf"
      >
        <label htmlFor={inputId} className="sr-only">
          {t('desmosAi.inputLabel')}
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('desmosAi.placeholder')}
          maxLength={400}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15.5px] text-ink outline-none"
        />
        <Button type="submit" size="md" disabled={thinking || !draft.trim()}>
          {t('desmosAi.ask')}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('desmosAi.tryLabel')}>
        {DESMOS_AI_LESSONS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => ask(l.question)}
            disabled={thinking}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors disabled:opacity-50',
              lesson?.id === l.id
                ? 'border-leaf bg-sage text-leaf-2'
                : 'border-line bg-paper text-ink-2 hover:bg-paper-2',
            )}
          >
            {l.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="soft-card grid content-start gap-4 p-4 md:p-5 min-w-0">
          {!asked && <p className="text-[15px] text-ink-3">{t('desmosAi.empty')}</p>}

          {asked && (
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl rounded-br-md bg-forest px-4 py-2.5 text-[15px] text-cream">
                {asked}
              </div>
            </div>
          )}

          {thinking && (
            <p className="animate-pulse text-[15px] text-ink-3" role="status">
              {t('chat.thinking')}
            </p>
          )}

          {notFound && <p className="text-[15px] text-ink-2">{t('desmosAi.notFound')}</p>}

          {lesson && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="leaf">{lesson.title}</Pill>
                <Pill tone="amber">{t('desmosAi.sample')}</Pill>
              </div>
              <ol className="grid gap-1.5" aria-label={t('desmosAi.steps')}>
                {lesson.steps.map((s, i) => (
                  <li key={s.text}>
                    <button
                      type="button"
                      onClick={() => setCur(i)}
                      aria-current={i === cur ? 'step' : undefined}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-left text-[15px] leading-relaxed transition-colors',
                        i === cur && 'bg-sage font-medium text-ink',
                        i < cur && 'text-ink',
                        i > cur && 'text-ink-3',
                      )}
                    >
                      <span className="mr-1.5 font-bold text-leaf-2">{i + 1}.</span>
                      {s.text}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cur === 0}
                  onClick={() => setCur((c) => c - 1)}
                >
                  ← {t('desmosAi.prev')}
                </Button>
                <Button size="sm" disabled={last} onClick={() => setCur((c) => c + 1)}>
                  {t('desmosAi.next')} →
                </Button>
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
          )}
        </div>

        <div className="soft-card relative overflow-hidden min-h-[420px] lg:min-h-[560px]">
          <div ref={box} className="absolute inset-0" />
          {graph !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-ink-3">
              {graph === 'loading' ? t('desmosAi.loading') : t('desmosAi.failed')}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
