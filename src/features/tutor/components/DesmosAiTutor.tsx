'use client';
// /desmos/ai — ask Суу a question and it teaches it on a live Desmos graph, one step at a time.
// POST /api/desmos/lesson: the six pitch questions get their hand-written sample (labelled «Жишээ хичээл»);
// any other question is written live by the fine-tuned model (labelled «AI хичээл») after the server checks it
// (lib/desmos-lesson-parse.ts). The official Desmos API is loaded from desmos.com.
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { DESMOS_AI_LESSONS, type DesmosAiLesson } from '../lib/desmos-lessons';

// Demo API key from the Desmos docs (development only). A product release needs our own key.
const DESMOS_KEY = 'dcb31709b452b1cf9dc26972add0fda6';
const DESMOS_SRC = [
  `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_KEY}`,
  `https://www.desmos.com/api/v1.7/calculator.js?apiKey=${DESMOS_KEY}`,
];
const COLORS: Record<string, string> = {
  blue: '#2d70b3',
  red: '#c74440',
  green: '#388c46',
  purple: '#6042a6',
  orange: '#fa7e19',
  black: '#000000',
};

type Calc = {
  setBlank: () => void;
  setExpression: (e: Record<string, unknown>) => void;
  setMathBounds: (b: { left: number; right: number; bottom: number; top: number }) => void;
  destroy: () => void;
};
type DesmosGlobal = { GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => Calc };
declare global {
  interface Window {
    Desmos?: DesmosGlobal;
  }
}

/** Loads the Desmos script once (tries a second version if the first fails). */
function loadDesmos(): Promise<DesmosGlobal> {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  const tryLoad = (i: number): Promise<DesmosGlobal> =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = DESMOS_SRC[i];
      s.async = true;
      s.onload = () => (window.Desmos ? resolve(window.Desmos) : reject(new Error('no Desmos')));
      s.onerror = () => reject(new Error('load failed'));
      document.head.appendChild(s);
    }).catch((e) =>
      i + 1 < DESMOS_SRC.length ? tryLoad(i + 1) : Promise.reject(e),
    ) as Promise<DesmosGlobal>;
  return tryLoad(0);
}

/** Draws steps 0..upTo of a lesson. Re-assigning a slider (k=2 after k=1) moves the same slider. */
export function drawLesson(calc: Calc, lesson: DesmosAiLesson, upTo: number) {
  calc.setBlank();
  const vars: Record<string, string> = {};
  let n = 0;
  let bounds: DesmosAiLesson['steps'][number]['bounds'];
  for (const step of lesson.steps.slice(0, upTo + 1)) {
    if (step.bounds) bounds = step.bounds;
    for (const it of step.desmos) {
      if (it.type === 'table') {
        calc.setExpression({ id: `t${n++}`, type: 'table', columns: it.columns });
        continue;
      }
      const e: Record<string, unknown> = { latex: it.latex };
      if (it.color) e.color = COLORS[it.color] ?? it.color;
      if (it.label) {
        e.label = it.label;
        e.showLabel = it.showLabel !== false;
      }
      if (it.sliderBounds) e.sliderBounds = it.sliderBounds;
      if (it.lineStyle) e.lineStyle = it.lineStyle;
      const v = /^([a-zA-Z](?:_\{?\w+\}?)?)=-?[\d.]+$/.exec(it.latex ?? '');
      if (v && vars[v[1]]) e.id = vars[v[1]];
      else {
        e.id = `e${n++}`;
        if (v) vars[v[1]] = e.id as string;
      }
      calc.setExpression(e);
    }
  }
  if (bounds) calc.setMathBounds(bounds);
}

/** What /api/desmos/lesson returns (see src/app/api/desmos/lesson/route.ts). */
type LessonReply =
  | { lesson: DesmosAiLesson; source: 'sample' | 'model'; answerFrom?: 'student' | 'model' }
  | { lesson: null; source: 'none'; reason: 'off' | 'failed' };

/** Why there is no lesson: model off (demo), model couldn't write a checked lesson, or the request failed. */
type Miss = 'off' | 'failed' | 'error';

export function DesmosAiTutor({ initial, fetchImpl }: { initial?: string; fetchImpl?: typeof fetch }) {
  const t = useT('tutor');
  const inputId = useId();
  const answerId = useId();
  const [draft, setDraft] = useState('');
  const [answerDraft, setAnswerDraft] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [lesson, setLesson] = useState<DesmosAiLesson | null>(null);
  const [source, setSource] = useState<'sample' | 'model' | null>(null);
  const [answerByModel, setAnswerByModel] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [miss, setMiss] = useState<Miss | null>(null);
  const [cur, setCur] = useState(0);
  const [graph, setGraph] = useState<'loading' | 'ready' | 'failed'>('loading');
  const box = useRef<HTMLDivElement>(null);
  const calc = useRef<Calc | null>(null);
  const pending = useRef<AbortController | null>(null);
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
      pending.current?.abort();
    };
  }, []);

  const ask = useCallback(async (question: string, answer = '') => {
    const q = question.trim();
    if (!q) return;
    pending.current?.abort();
    const ctrl = new AbortController();
    pending.current = ctrl;
    setAsked(q);
    setDraft('');
    setAnswerDraft('');
    setMiss(null);
    setLesson(null);
    setSource(null);
    setAnswerByModel(false);
    setThinking(true);
    try {
      const res = await fetchRef.current('/api/desmos/lesson', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answer.trim() ? { question: q, answer: answer.trim() } : { question: q }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as LessonReply;
      if (ctrl.signal.aborted) return;
      setCur(0);
      if (data.lesson) {
        setLesson(data.lesson);
        setSource(data.source);
        setAnswerByModel(data.answerFrom === 'model');
      } else {
        setMiss(data.reason);
      }
    } catch {
      if (!ctrl.signal.aborted) setMiss('error');
    } finally {
      if (pending.current === ctrl) {
        pending.current = null;
        setThinking(false);
      }
    }
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
  }, [lesson, cur, graph]);

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
    ask(draft, answerDraft);
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
        <label htmlFor={answerId} className="sr-only">
          {t('desmosAi.answerLabel')}
        </label>
        <input
          id={answerId}
          value={answerDraft}
          onChange={(e) => setAnswerDraft(e.target.value)}
          placeholder={t('desmosAi.answerPlaceholder')}
          maxLength={40}
          className="w-24 sm:w-32 shrink-0 rounded-xl border border-line bg-paper px-2.5 py-2 text-[14px] text-ink outline-none focus:border-leaf"
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

          {miss && (
            <p className="text-[15px] text-ink-2" role="status">
              {miss === 'off'
                ? t('desmosAi.notFound')
                : miss === 'failed'
                  ? t('desmosAi.modelFailed')
                  : t('desmosAi.error')}
            </p>
          )}

          {lesson && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="leaf">{lesson.title}</Pill>
                {source === 'model' ? (
                  <Pill tone="teal">{t('desmosAi.live')}</Pill>
                ) : (
                  <Pill tone="amber">{t('desmosAi.sample')}</Pill>
                )}
              </div>
              {answerByModel && <p className="text-[13.5px] text-ink-3">{t('desmosAi.answerByModel')}</p>}
              <ol className="grid gap-1.5" aria-label={t('desmosAi.steps')}>
                {lesson.steps.map((s, i) => (
                  // model lessons may repeat a sentence, so the step number is part of the key
                  <li key={`${i}-${s.text}`}>
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
