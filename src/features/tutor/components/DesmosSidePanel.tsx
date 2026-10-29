'use client';
// The cat «Desmos» button next to a problem opens this panel: the screen splits in half (on a phone it
// covers the page). It asks Суу for a Desmos lesson for that exact problem (POST /api/desmos/lesson, same
// checks as Desmos Академи) and draws it on a live calculator. Until the student has answered, the last step —
// where the lesson reaches the answer — stays locked. Without a lesson it draws the problem's hand-written
// Desmos rows, or leaves the calculator free.
import { useEffect, useRef, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { type Calc, drawExtra, drawLesson, drawRows, loadDesmos } from '../lib/desmos-calc';
import type { DesmosAiLesson } from '../lib/desmos-lessons';
import { type DesmosPanelInput, panelView, visibleSteps } from '../lib/desmos-panel';

type LessonReply =
  | { lesson: DesmosAiLesson; source: 'sample' | 'model' }
  | { lesson: null; source: 'none'; reason: 'off' | 'failed' };

type Props = {
  input: DesmosPanelInput;
  /** The student has answered (or chose to see it): the last step and the answer are shown. */
  revealed: boolean;
  onClose: () => void;
  /** Lets the student unlock the last step themselves (the tutor chat). Without it, only answering does. */
  onReveal?: () => void;
  fetchImpl?: typeof fetch;
  /** Fills a column of its parent on wide screens (the tutor chat card) instead of being its own sticky card. */
  inset?: boolean;
  /** Tells the chat which steps the student sees (never the locked one), so it can talk about the same graph. */
  onView?: (view: ReturnType<typeof panelView> | null) => void;
  /** Rows the chat suggested ("Desmos-д зурах"), drawn on top in purple. */
  extra?: string[];
};

/** The cat button that opens the panel. */
export function DesmosCatButton({
  open,
  onClick,
  disabled,
  className,
}: {
  open: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT('tutor');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={open}
      aria-label={open ? t('desmosPanel.close') : t('desmosPanel.open')}
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        open
          ? 'border-leaf bg-sage text-leaf-2'
          : 'border-line bg-paper-2 text-ink hover:border-leaf hover:text-leaf-2',
        className,
      )}
    >
      <span
        className="grid size-7 place-items-center overflow-hidden rounded-[30%] bg-sage"
        aria-hidden="true"
      >
        {/* biome-ignore lint/performance/noImgElement: static transparent PNG */}
        <img src="/brand/suu-logo-head.png" alt="" width={28} height={28} className="w-[88%] h-auto" />
      </span>
      {t('desmosPanel.button')}
    </button>
  );
}

export function DesmosSidePanel({
  input,
  revealed,
  onClose,
  onReveal,
  fetchImpl,
  inset,
  onView,
  extra,
}: Props) {
  const t = useT('tutor');
  const [lesson, setLesson] = useState<DesmosAiLesson | null>(null);
  const [source, setSource] = useState<'sample' | 'model' | null>(null);
  const [thinking, setThinking] = useState(true);
  const [cur, setCur] = useState(0);
  const [graph, setGraph] = useState<'loading' | 'ready' | 'failed'>('loading');
  const box = useRef<HTMLDivElement>(null);
  const calc = useRef<Calc | null>(null);
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const fetchRef = useRef(doFetch);
  fetchRef.current = doFetch;

  useEffect(() => {
    let alive = true;
    loadDesmos()
      .then((D) => {
        if (!alive || !box.current) return;
        calc.current = D.GraphingCalculator(box.current, {
          expressionsCollapsed: false,
          settingsMenu: false,
        });
        setGraph('ready');
      })
      .catch(() => alive && setGraph('failed'));
    return () => {
      alive = false;
      calc.current?.destroy();
      calc.current = null;
    };
  }, []);

  // one lesson request per problem; a new problem cancels the old request
  useEffect(() => {
    const ctrl = new AbortController();
    setLesson(null);
    setSource(null);
    setCur(0);
    setThinking(true);
    // called as a plain function: window.fetch throws "Illegal invocation" when called as fetchRef.current(…)
    const send = fetchRef.current;
    send('/api/desmos/lesson', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        input.answer ? { question: input.question, answer: input.answer } : { question: input.question },
      ),
      signal: ctrl.signal,
    })
      .then(async (res) => (res.ok ? ((await res.json()) as LessonReply) : null))
      .catch(() => null)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        if (data?.lesson) {
          setLesson(data.lesson);
          setSource(data.source);
        }
        setThinking(false);
      });
    return () => ctrl.abort();
  }, [input.question, input.answer]);

  const shown = lesson ? visibleSteps(lesson, revealed) : 0;
  const locked = lesson ? shown < lesson.steps.length : false;
  const step = Math.min(cur, Math.max(shown - 1, 0));
  const last = lesson ? step === lesson.steps.length - 1 : false;

  // redraw on every change; before the answer, the locked step's items are never drawn
  useEffect(() => {
    if (graph !== 'ready' || !calc.current) return;
    if (lesson && shown > 0) drawLesson(calc.current, lesson, step);
    else if (!lesson && !thinking && input.rows?.length) drawRows(calc.current, input.rows);
    else calc.current.setBlank();
    if (extra?.length) drawExtra(calc.current, extra);
  }, [graph, lesson, shown, step, thinking, input.rows, extra]);

  const viewRef = useRef(onView);
  viewRef.current = onView;
  useEffect(() => {
    viewRef.current?.(lesson && shown > 0 ? panelView(lesson, shown, step) : null);
  }, [lesson, shown, step]);
  useEffect(() => () => viewRef.current?.(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={t('desmosPanel.title')}
      className={cn(
        'fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper lg:z-auto',
        inset
          ? 'lg:static lg:h-full lg:min-h-0 lg:border-l lg:border-line'
          : 'lg:sticky lg:top-4 lg:h-[calc(100dvh-120px)] lg:rounded-[2rem] lg:border lg:border-line lg:shadow-pop',
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[30%] bg-sage"
            aria-hidden
          >
            {/* biome-ignore lint/performance/noImgElement: static transparent PNG */}
            <img src="/brand/suu-logo-head.png" alt="" width={32} height={32} className="w-[88%] h-auto" />
          </span>
          <h2 className="truncate font-bold text-ink">{t('desmosPanel.title')}</h2>
          {lesson && (
            <Pill tone={source === 'model' ? 'teal' : 'amber'}>
              {source === 'model' ? t('desmosAi.live') : t('desmosAi.sample')}
            </Pill>
          )}
          {!lesson && !thinking && input.rows?.length ? (
            <Pill tone="leaf">{t('desmosPanel.own')}</Pill>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('desmosPanel.close')}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-[22px] leading-none text-ink-3 hover:bg-paper-2 hover:text-ink"
        >
          ×
        </button>
      </header>

      <div className="max-h-[42%] overflow-y-auto scroll-thin border-b border-line px-4 py-3 text-[14.5px]">
        {thinking && (
          <p className="animate-pulse text-ink-3" role="status">
            {t('desmosPanel.thinking')}
          </p>
        )}

        {lesson && (
          <div className="grid gap-2">
            {shown > 0 && (
              <ol className="grid gap-1" aria-label={t('desmosAi.steps')}>
                {lesson.steps.slice(0, shown).map((s, i) => (
                  <li key={`${i}-${s.text}`}>
                    <button
                      type="button"
                      onClick={() => setCur(i)}
                      aria-current={i === step ? 'step' : undefined}
                      className={cn(
                        'w-full rounded-xl px-3 py-2 text-left leading-relaxed transition-colors',
                        i === step && 'bg-sage font-medium text-ink',
                        i < step && 'text-ink',
                        i > step && 'text-ink-3',
                      )}
                    >
                      <span className="mr-1.5 font-bold text-leaf-2">{i + 1}.</span>
                      {s.text}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {locked && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-ink-3">
                <span>
                  <span aria-hidden>🔒 </span>
                  {t('desmosPanel.locked')}
                </span>
                {onReveal && (
                  <Button size="sm" variant="soft" onClick={onReveal}>
                    {t('desmosPanel.reveal')}
                  </Button>
                )}
              </div>
            )}
            {shown > 1 && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={step === 0} onClick={() => setCur(step - 1)}>
                  ← {t('desmosAi.prev')}
                </Button>
                <Button size="sm" disabled={step >= shown - 1} onClick={() => setCur(step + 1)}>
                  {t('desmosAi.next')} →
                </Button>
              </div>
            )}
            {revealed && last && (
              <div className="grid gap-0.5 rounded-xl bg-sage px-3 py-2 text-ink">
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

        {!lesson && !thinking && (
          <div className="grid gap-2 text-ink-2">
            <p>{input.rows?.length ? t('desmosPanel.ownNote') : t('desmosPanel.free')}</p>
            {input.rows?.length ? (
              <ol className="grid gap-1 font-mono text-[13.5px] text-ink">
                {input.rows.map((r, i) => (
                  <li key={`${i}-${r}`} className="rounded-lg border border-line bg-paper-2 px-2.5 py-1.5">
                    {r}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}

        {revealed && !lesson && !thinking && input.tip && (
          <div className="mt-2 text-ink-2">
            <strong className="text-leaf-2">{t('desmosPanel.tip')}: </strong>
            <Rich text={input.tip} />
          </div>
        )}
      </div>

      <div className="relative min-h-[300px] flex-1">
        <div ref={box} className="absolute inset-0" />
        {graph !== 'ready' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-ink-3">
            {graph === 'loading' ? t('desmosAi.loading') : t('desmosAi.failed')}
          </div>
        )}
      </div>
    </aside>
  );
}
