'use client';
import './placement.css';
// «Түвшин тогтоох тест»: intro → module 1 (13 medium) → module 2 (13 easy or hard, routed by module 1)
// → save → results. One 35-minute clock for both modules; when it runs out the test is submitted as is.
// No feedback during the test, like the real SAT.
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Question } from '@/types';
import { ROADMAP } from '../config';
import { isCorrect } from '../lib/grade';
import { module1, module2, routeModule2 } from '../lib/placement';
import type { SubmittedAnswer } from '../lib/submit';
import { PlacementCalculator } from './PlacementCalculator';
import { QuestionView } from './QuestionView';
import { savePlacement } from './store';

type Phase = 'intro' | 'm1' | 'm2' | 'saving';

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PlacementFlow({ items, demo }: { items: Question[]; demo: boolean }) {
  const t = useT('roadmap');
  const router = useRouter();
  const uid = useId();
  const m1 = useMemo(() => {
    try {
      return module1(items);
    } catch {
      return null;
    }
  }, [items]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [route, setRoute] = useState<'easy' | 'hard'>('easy');
  const m2 = useMemo(() => {
    try {
      return module2(items, route);
    } catch {
      return null;
    }
  }, [items, route]);
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorLoaded, setCalculatorLoaded] = useState(false);
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [left, setLeft] = useState(ROADMAP.placement.minutes * 60);
  const [error, setError] = useState<string | null>(null);
  const deadline = useRef(0);
  const startedAt = useRef('');
  const shownAt = useRef(Date.now());
  const finishing = useRef(false);

  const qs = phase === 'm2' ? (m2 ?? []) : (m1 ?? []);
  const q = qs[i];

  const track = () => {
    if (!q) return;
    const now = Date.now();
    setSpent((s) => ({ ...s, [q.id]: (s[q.id] ?? 0) + now - shownAt.current }));
    shownAt.current = now;
  };

  const submit = async (route2: 'easy' | 'hard', vals: Record<string, string>) => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase('saving');
    const second = module2(items, route2);
    const answers: SubmittedAnswer[] = [...(m1 ?? []), ...second].map((x) => ({
      qid: x.id,
      answer: (vals[x.id] ?? '').trim(),
      timeMs: spent[x.id] ?? 0,
    }));
    const r = await savePlacement(demo, items, answers, startedAt.current);
    if (!r.ok) {
      setError(r.reason);
      finishing.current = false;
      return;
    }
    router.push(routes.placementResults);
  };

  const finishModule = () => {
    track();
    setConfirm(false);
    if (phase === 'm1') {
      const correct = (m1 ?? []).filter((x) => isCorrect(x, (values[x.id] ?? '').trim())).length;
      setRoute(routeModule2(correct));
      setPhase('m2');
      setI(0);
      return;
    }
    void submit(route, values);
  };

  // one clock for the whole test
  // biome-ignore lint/correctness/useExhaustiveDependencies: restarted when phase/answers change so each tick sees the latest values
  useEffect(() => {
    if (phase !== 'm1' && phase !== 'm2') return;
    const id = setInterval(() => {
      const sec = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(sec);
      if (sec === 0) {
        clearInterval(id);
        // time is up: route on what module 1 has, then submit
        const r =
          phase === 'm1'
            ? routeModule2((m1 ?? []).filter((x) => isCorrect(x, (values[x.id] ?? '').trim())).length)
            : route;
        void submit(r, values);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, values, route]);

  if (!m1) {
    return (
      <section className="soft-card mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('placement.intro.title')}</h1>
        <p className="mt-3 text-ink-2">{t('stop.noQuestions')}</p>
        <a href={routes.home} className="mt-4 inline-block font-bold text-leaf-2 underline">
          {t('placement.intro.back')}
        </a>
      </section>
    );
  }

  if (phase === 'intro') {
    return (
      <section
        className="soft-card mx-auto flex max-w-2xl flex-col gap-5 p-6 sm:p-8"
        aria-labelledby={`${uid}-title`}
      >
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 id={`${uid}-title`} className="font-display text-3xl font-bold text-ink">
          {t('placement.intro.title')}
        </h1>
        <p className="text-[16px] leading-relaxed text-ink-2">{t('placement.intro.body')}</p>
        <ul className="grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
          {[
            t('placement.intro.time', { min: ROADMAP.placement.minutes }),
            t('placement.intro.calc'),
            t('placement.intro.noScore'),
          ].map((x) => (
            <li key={x} className="rounded-2xl bg-paper-2 px-3 py-2.5 font-semibold">
              {x}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={routes.home} className="inline-flex h-11 items-center px-2 font-bold text-ink-2">
            {t('placement.intro.back')}
          </a>
          <Button
            variant="lime"
            size="lg"
            onClick={() => {
              deadline.current = Date.now() + ROADMAP.placement.minutes * 60_000;
              startedAt.current = new Date().toISOString();
              shownAt.current = Date.now();
              setPhase('m1');
            }}
          >
            {t('placement.intro.start')}
          </Button>
        </div>
      </section>
    );
  }

  if (phase === 'saving') {
    return (
      <section className="soft-card mx-auto max-w-xl p-8 text-center" aria-live="polite">
        {error ? (
          <>
            <p className="text-danger">{error}</p>
            <Button className="mt-4" onClick={() => void submit(route, values)}>
              {t('placement.finishTest')}
            </Button>
          </>
        ) : (
          <p className="text-ink-2" aria-busy="true">
            {t('placement.timeUp')}…
          </p>
        )}
      </section>
    );
  }

  const unanswered = qs.filter((x) => !(values[x.id] ?? '').trim()).length;
  const go = (j: number) => {
    track();
    setI(j);
  };

  return (
    <div className="sat-placement mx-auto flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="eyebrow">{t('placement.intro.title')}</p>
          <h1 className="font-display text-lg font-bold text-ink">
            {t('placement.module', { n: phase === 'm1' ? 1 : 2 })}
            {phase === 'm2' && (
              <span className="ml-2 text-sm font-semibold text-ink-3">
                {route === 'hard' ? t('placement.routeHard') : t('placement.routeEasy')}
              </span>
            )}
          </h1>
        </div>
        <div className="sat-header-brand">
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={calculatorOpen}
            aria-controls={`${uid}-calculator`}
            onClick={() => {
              setCalculatorLoaded(true);
              setCalculatorOpen((open) => !open);
            }}
            className="inline-flex h-11 items-center rounded-2xl border border-line px-3 text-sm font-bold text-ink-2"
          >
            {t('placement.desmos')}
          </button>
          <p
            className={cn(
              'rounded-2xl px-3 py-2 font-mono text-lg font-bold tnum',
              left < 300 ? 'bg-amber-soft text-amber' : 'bg-paper-2 text-ink',
            )}
            aria-live={left < 60 ? 'polite' : 'off'}
          >
            <span className="sr-only">{t('placement.timeLeft')}: </span>
            {clock(left)}
          </p>
        </div>
      </header>

      <div className="sat-test-layout" data-calculator={calculatorOpen ? 'open' : 'closed'}>
        {calculatorLoaded && (
          <section
            id={`${uid}-calculator`}
            aria-label="Desmos"
            hidden={!calculatorOpen}
            className="sat-calculator"
          >
            <div className="sat-calculator-bar">
              <span>Calculator</span>
              <button
                type="button"
                aria-label={t('placement.closeCalculator')}
                onClick={() => setCalculatorOpen(false)}
                className="rounded-xl px-3 py-2"
              >
                ✕
              </button>
            </div>
            <PlacementCalculator />
          </section>
        )}

        <div className="sat-question-column">
          <nav
            aria-label={t('placement.module', { n: phase === 'm1' ? 1 : 2 })}
            className="sat-question-nav flex flex-wrap gap-1.5"
          >
            {qs.map((x, j) => (
              <button
                key={x.id}
                type="button"
                onClick={() => go(j)}
                aria-current={j === i ? 'step' : undefined}
                aria-label={`${t('placement.question', { i: j + 1, n: qs.length })}${values[x.id] ? ' ✓' : ''}`}
                className={cn(
                  'grid size-11 place-items-center rounded-xl border-[1.5px] text-sm font-bold tnum',
                  j === i ? 'border-leaf text-ink' : 'border-line text-ink-2',
                  values[x.id] && 'bg-sage',
                )}
              >
                {j + 1}
              </button>
            ))}
          </nav>

          <section
            className="sat-question flex flex-col gap-5"
            aria-label={t('placement.question', { i: i + 1, n: qs.length })}
          >
            <div className="sat-question-bar">
              <span className="sat-question-number">{i + 1}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!marked[q.id]}
                  onChange={(e) => setMarked((m) => ({ ...m, [q.id]: e.target.checked }))}
                />
                {t('placement.markReview')}
              </label>
            </div>
            <QuestionView
              key={q.id}
              q={q}
              value={values[q.id] ?? ''}
              onChange={(v) => setValues((s) => ({ ...s, [q.id]: v }))}
              placeholder={t('placement.answerPlaceholder')}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => go(Math.max(0, i - 1))} disabled={i === 0}>
                {t('placement.prev')}
              </Button>
              {i < qs.length - 1 ? (
                <Button variant="lime" onClick={() => go(i + 1)}>
                  {t('placement.next')}
                </Button>
              ) : (
                <Button variant="lime" onClick={() => (unanswered ? setConfirm(true) : finishModule())}>
                  {phase === 'm1' ? t('placement.finishModule') : t('placement.finishTest')}
                </Button>
              )}
            </div>
            {confirm && (
              <div
                role="alertdialog"
                aria-labelledby={`${uid}-confirm`}
                className="rounded-2xl bg-amber-soft p-4"
              >
                <p id={`${uid}-confirm`} className="font-semibold text-amber">
                  {t('placement.unanswered', { n: unanswered })}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" size="sm" onClick={finishModule}>
                    {t('placement.confirm')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                    {t('placement.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
