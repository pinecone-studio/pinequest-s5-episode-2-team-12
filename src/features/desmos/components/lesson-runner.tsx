'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Rich } from '@/components/math';
import { Bar, Button, Pill } from '@/components/ui';
import type { T } from '@/lib/i18n';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { DesmosLesson, DesmosStep } from '@/types';
import { POI_LABEL_KEY, type Poi } from '../lib/graph';
import { useAcademyProgress } from '../lib/progress';
import { type LessonEvent, validateStep } from '../lib/step-validator';
import GraphCalc, { type GraphApi, type GraphState, type ViewEvent } from './graph-calc';

export function LessonRunner({ lesson, next }: { lesson: DesmosLesson; next?: DesmosLesson }) {
  const t = useT('desmos');
  const answerId = useId();
  const [step, setStep] = useState(-1);
  const stepRef = useRef(-1);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<{ x: number; y: number } | null>(null);
  const api = useRef<GraphApi | null>(null);
  const mounted = useRef(true);
  const { complete } = useAcademyProgress();
  const completeRef = useRef(complete);
  completeRef.current = complete;
  const finished = step >= lesson.steps.length;
  const current = lesson.steps[step];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Each event can advance once. Update the ref synchronously so rapid duplicate
  // events never validate against a stale step captured by an earlier render.
  const receive = useCallback(
    (event: LessonEvent) => {
      const index = stepRef.current;
      const active = lesson.steps[index];
      if (!active) return;
      if (!validateStep(active, event)) {
        if (
          event.type === 'answer' ||
          event.type === 'choice' ||
          (event.type === 'poi' && active.type === 'select')
        ) {
          setFeedback(
            'hint' in active
              ? t('ui.try_again_value', { v0: active.hint })
              : t('ui.that_option_is_incorrect_try_again'),
          );
        }
        return;
      }
      const nextIndex = index + 1;
      stepRef.current = nextIndex;
      setStep(nextIndex);
      setAnswer('');
      setHint('');
      setHighlight(null);
      setFeedback('explain' in active ? active.explain : t('ui.correct_let_s_move_on'));
      if (nextIndex === lesson.steps.length) completeRef.current(lesson.id);
    },
    [lesson, t],
  );

  const onState = useCallback((state: GraphState) => receive({ type: 'state', state }), [receive]);
  const onPoi = useCallback((poi: Poi) => receive({ type: 'poi', poi }), [receive]);
  const onView = useCallback((view: ViewEvent) => receive({ type: 'view', view }), [receive]);

  const showHint = () => {
    if (!current) return;
    setHint('hint' in current ? current.hint : current.say);
    if (current.type === 'select' && current.at) {
      setHighlight({ x: current.at[0], y: current.at[1] });
      api.current?.focusPoint(current.at[0], current.at[1]);
    }
  };
  const demo = async () => {
    if (!current || busy) return;
    if (current.type === 'enter') {
      setBusy(true);
      try {
        await api.current?.typeRow(current.demo || current.target);
      } finally {
        if (mounted.current) setBusy(false);
      }
    } else showHint();
  };
  const restart = () => {
    stepRef.current = -1;
    setStep(-1);
    setAttempt((v) => v + 1);
    setAnswer('');
    setFeedback('');
    setHint('');
    setHighlight(null);
    setBusy(false);
  };

  return (
    <div className="gutter py-5 max-w-[1440px] mx-auto">
      <nav className="flex items-center gap-3 mb-5 text-sm" aria-label={t('ui.lesson_breadcrumb')}>
        <Link href={routes.desmosHome} className="font-semibold text-ink-2">
          {t('ui.academy_34')}
        </Link>
        <span className="text-ink-3">/</span>
        <span className="truncate">{lesson.title}</span>
        <span className="ml-auto">
          <Pill tone="teal">{lesson.skill}</Pill>
        </span>
      </nav>
      <div className="grid xl:grid-cols-[400px_1fr] gap-5 items-start">
        <div className="grid gap-4">
          <section className="card p-5">
            <p className="eyebrow text-teal">
              {t('ui.desmos_academy')}
              {lesson.en}
            </p>
            <h1 className="font-display font-extrabold text-2xl mt-2">{lesson.title}</h1>
            {lesson.question && (
              <div className="rounded-2xl bg-paper-2 border border-line p-4 mt-4">
                <p className="eyebrow mb-2">{t('ui.sat_problem')}</p>
                <Rich text={lesson.question} />
              </div>
            )}
            <div className="flex items-center gap-3 mt-5">
              <Bar
                value={Math.max(0, step) / lesson.steps.length}
                tone="teal"
                label={t('ui.lesson_progress')}
              />
              <span className="text-xs shrink-0 tnum" data-testid="lesson-progress">
                {Math.max(0, step)}/{lesson.steps.length}
              </span>
            </div>
          </section>
          <section className="card p-5" aria-label={t('ui.suu_s_instructions')}>
            <div className="flex gap-3 items-start">
              <CatHead size={62} mood={finished ? 'happy' : hint ? 'think' : 'idle'} />
              <div className="flex-1 min-w-0">
                <p className="font-bold">
                  {t('ui.suu')}
                  <span className="text-xs text-ink-3 font-normal">{t('ui.your_guide')}</span>
                </p>
                <div
                  className="mt-2 text-sm leading-relaxed"
                  aria-live="polite"
                  data-testid="step-instruction"
                >
                  <Rich text={finished ? lesson.outro : current?.say || lesson.intro} />
                </div>
              </div>
            </div>
            {feedback && (
              <div role="status" className="mt-4 bg-sage rounded-xl p-3 text-sm">
                <Rich text={feedback} />
              </div>
            )}
            {hint && (
              <div className="mt-3 bg-teal-soft rounded-xl p-3 text-sm">
                <Rich text={hint} />
              </div>
            )}
            {step < 0 && (
              <Button
                className="w-full mt-5"
                data-testid="start-lesson"
                onClick={() => {
                  stepRef.current = 0;
                  setStep(0);
                }}
              >
                {t('ui.start')}
              </Button>
            )}
            {current?.type === 'read' && (
              <Button
                className="w-full mt-4"
                data-testid="read-next"
                onClick={() => receive({ type: 'read' })}
              >
                {current.cta || t('ui.continue')}
              </Button>
            )}
            {current?.type === 'answer' && (
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  receive({ type: 'answer', value: answer });
                }}
              >
                <label htmlFor={answerId} className="text-sm">
                  <Rich text={current.prompt} />
                </label>
                <div className="flex gap-2 mt-2">
                  <input
                    id={answerId}
                    autoComplete="off"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={current.placeholder || t('ui.answer')}
                    className="min-w-0 w-full rounded-xl border-2 border-line-2 bg-paper px-3 text-lg focus:border-leaf outline-none"
                  />
                  <Button type="submit" disabled={!answer.trim()} data-testid="check-answer">
                    {t('ui.check')}
                  </Button>
                </div>
              </form>
            )}
            {current?.type === 'choice' && (
              <div className="mt-4">
                <Rich text={current.prompt} />
                <div className="grid gap-2 mt-3">
                  {current.options.map((option, index) => (
                    <Button
                      key={option}
                      variant="secondary"
                      className="h-auto min-h-12 text-left justify-start py-3"
                      onClick={() => receive({ type: 'choice', index })}
                    >
                      <Rich text={option} />
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {current && (
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-line">
                <Button size="sm" variant="ghost" onClick={showHint} data-testid="d-hint">
                  {t('ui.give_me_a_hint')}
                </Button>
                <Button size="sm" variant="soft" onClick={demo} disabled={busy}>
                  {t('ui.show_me_in_desmos')}
                </Button>
              </div>
            )}
            {finished && (
              <div className="mt-5 grid gap-3" data-testid="lesson-complete">
                <h2 className="font-display text-xl font-bold">{t('ui.lesson_complete')}</h2>
                <p className="text-sm text-ink-2">{t('ui.completion_saved_on_this_device')}</p>
                {lesson.manual && (
                  <div className="rounded-xl bg-paper-2 p-3">
                    <Rich text={t('ui.by_hand_value', { v0: lesson.manual })} />
                  </div>
                )}
                {next && (
                  <Link className="font-bold text-leaf" href={routes.desmos(next.id)}>
                    {t('ui.next')}
                    {next.title} →
                  </Link>
                )}
                <Button variant="secondary" onClick={restart}>
                  {t('ui.try_again')}
                </Button>
                <Link href={routes.desmosHome} className="text-sm text-center">
                  {t('ui.back_to_academy')}
                </Link>
              </div>
            )}
          </section>
          <section className="card p-5">
            <h2 className="eyebrow mb-3">{t('ui.steps_53')}</h2>
            <ol className="grid gap-3">
              {lesson.steps.map((item, index) => (
                <li
                  key={`${item.type}-${index}`}
                  className={`flex gap-3 text-sm ${index > step ? 'text-ink-3' : ''}`}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span
                    className={`rounded-full h-6 w-6 shrink-0 text-xs grid place-items-center ${index < step ? 'bg-teal text-white' : 'border border-line-2'}`}
                  >
                    {index < step ? '✓' : index + 1}
                  </span>
                  <span>{stepLabel(item, t)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="relative h-[650px] xl:h-[calc(100vh-140px)] xl:min-h-[600px]">
          <GraphCalc
            key={attempt}
            initialRows={lesson.initial}
            height="100%"
            apiRef={api}
            onState={onState}
            onPoi={onPoi}
            onView={onView}
            highlight={highlight}
            initialView={{
              cx: lesson.id === 'd6' ? 4 : lesson.id === 'd3' ? 2 : 0,
              cy: lesson.id === 'd6' ? 8 : lesson.id === 'd3' ? 3 : 0,
              scale: lesson.id === 'd6' ? 22 : 32,
            }}
          />
          {step < 0 && (
            <div className="absolute inset-0 rounded-2xl bg-paper/80 backdrop-blur-sm grid place-items-center p-8 text-center">
              <div>
                <CatHead size={80} mood="focus" className="mx-auto" />
                <p className="mt-4 text-sm">{t('ui.press_start_to_begin_the_lesson')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function stepLabel(step: DesmosStep, t: T) {
  switch (step.type) {
    case 'read':
      return t('ui.observe');
    case 'pan':
      return t('ui.pan_the_graph');
    case 'zoom':
      return t('ui.zoom_in');
    case 'enter':
      return t('ui.enter_value', { v0: step.target });
    case 'select':
      return t(POI_LABEL_KEY[step.kind]);
    case 'slider':
      return t('ui.slider_value', { v0: step.name });
    case 'regression':
      return t('ui.enable_regression');
    case 'answer':
      return t('ui.enter_your_answer');
    case 'choice':
      return step.say;
  }
}
