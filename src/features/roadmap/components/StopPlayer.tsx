'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Rich } from '@/components/math';
import { Bar } from '@/components/ui/Bar';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/toast';
import { SuuSidePanel, SuuTutorButton } from '@/features/tutor/components/SuuSidePanel';
import { chosenText, questionProblem } from '@/features/tutor/lib/suu-panel';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Question } from '@/types';
import { type Calc, drawRows, loadDesmos } from '../../tutor/lib/desmos-calc';
import type { StopOutcome } from '../actions';
import { ROADMAP } from '../config';
import type { IntroScreen } from '../content/schema';
import { correctAnswerText, isCorrect } from '../lib/grade';
import { neededToPass } from '../lib/scoring';
import { seeded, selectProblems } from '../lib/select-problems';
import { isOpen, masteryAt } from '../lib/state';
import type { SubmittedAnswer } from '../lib/submit';
import { canOpenStop, isDone } from '../lib/unlock';
import { stopByNo } from '../stops';
import { topicById } from '../topics';
import type { ProblemAttempt, RoadmapState } from '../types';
import { QuestionView } from './QuestionView';
import { StopIntro } from './StopIntro';
import { saveStop, useRoadmapState } from './store';
import { StarRow, TopicIcon } from './TopicIcon';

type Phase = 'intro' | 'play' | 'saving' | 'result';

export function StopPlayer({
  no,
  testOut: wantTestOut,
  pool,
  intro,
  demo,
  server,
  serverHistory,
  forceIntro = false,
}: {
  no: number;
  testOut: boolean;
  forceIntro?: boolean;
  pool: Question[];
  intro: IntroScreen[];
  demo: boolean;
  server: RoadmapState | null;
  serverHistory: ProblemAttempt[];
}) {
  const t = useT('roadmap');
  const router = useRouter();
  const loaded = useRoadmapState(demo, server);
  const topic = topicById(no)!;
  const state = loaded.state;
  const mastery = masteryAt(state, no);
  const stopProgress = state.stops.find((p) => p.no === no);
  const done = isDone(stopProgress);
  const testOut = wantTestOut && mastery === 'strong' && !done;
  const allowed = isOpen(state) && canOpenStop(state.stops, no);
  const isFirstAttempt = stopProgress?.attempts === 0;

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('play');
  const [ids, setIds] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [showSuu, setShowSuu] = useState(false);
  const [showDesmos, setShowDesmos] = useState(false);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [outcome, setOutcome] = useState<StopOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const started = useRef(Date.now());

  const desmosContainerRef = useRef<HTMLDivElement>(null);
  const calcInstanceRef = useRef<Calc | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: draw once per stop or retry, without resetting an active round
  useEffect(() => {
    if (!loaded.ready || !allowed || phase === 'saving' || phase === 'result') return;
    const history = demo ? loaded.history : serverHistory;
    setIds(
      selectProblems({
        topicId: no,
        level: state.level,
        mastery,
        pool: pool.map((q) => ({ id: q.id, topicId: q.topicId ?? no, difficulty: q.difficulty })),
        history,
        rng: seeded(Date.now() + round),
        testOut,
      }),
    );

    const shouldShowIntro =
      round === 0 &&
      !testOut &&
      intro.length > 0 &&
      (forceIntro || ROADMAP.autoIntro.includes(mastery) || isFirstAttempt);

    setPhase(shouldShowIntro ? 'intro' : 'play');
    setI(0);
    setValue('');
    setRevealed(false);
    setHint(false);
    setAnswers([]);
    setOutcome(null);
    started.current = Date.now();
  }, [loaded.ready, allowed, round, no, forceIntro, testOut, mastery, intro.length, isFirstAttempt]);

  const byId = useMemo(() => new Map(pool.map((q) => [q.id, q])), [pool]);
  const qs = (ids ?? []).map((id) => byId.get(id)!).filter(Boolean);
  const q = qs[i];
  const total = qs.length;

  useEffect(() => {
    if (!showDesmos || !desmosContainerRef.current) return;

    let isMounted = true;
    loadDesmos()
      .then((Desmos) => {
        if (!isMounted || !desmosContainerRef.current) return;

        if (calcInstanceRef.current) {
          calcInstanceRef.current.destroy();
        }

        const calculator = Desmos.GraphingCalculator(desmosContainerRef.current, {
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          keypad: true,
        });

        calcInstanceRef.current = calculator;

        if (q?.desmos?.rows) {
          drawRows(calculator, q.desmos.rows);
        } else {
          calculator.setBlank();
        }

        setTimeout(() => {
          if (isMounted && calcInstanceRef.current?.resize) {
            calcInstanceRef.current.resize();
          }
        }, 100);
      })
      .catch((err) => {
        console.error('Failed to load Desmos:', err);
      });

    return () => {
      isMounted = false;
      if (calcInstanceRef.current) {
        calcInstanceRef.current.destroy();
        calcInstanceRef.current = null;
      }
    };
  }, [showDesmos, q]);

  if (!loaded.ready)
    return <div className="h-48 w-full animate-pulse rounded-2xl bg-sage/20" aria-busy="true" />;

  if (!allowed) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center">
        <div className="w-24">
          <CatHead mood="sleep" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{t('stop.lockedTitle')}</h1>
        <p className="text-base text-ink-2">{isOpen(state) ? t('sheet.locked') : t('sheet.closedRoadmap')}</p>
        <Link
          href={isOpen(state) ? routes.home : routes.placement}
          className="text-base font-bold text-leaf-2 underline"
        >
          {isOpen(state) ? t('stop.toMap') : t('gate.take')}
        </Link>
      </section>
    );
  }

  const header = (
    <header className="flex items-center gap-4 px-1 py-1 shrink-0">
      <span
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sage/80 text-leaf-2"
        aria-hidden="true"
      >
        <TopicIcon name={topic.icon} size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl sm:text-2xl font-extrabold leading-tight text-ink truncate">
          {testOut ? `${t('stop.testOutTitle')}: ` : ''}
          {topic.title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {phase !== 'intro' && (
          <Button
            variant="secondary"
            size="md"
            className={cn(
              'font-medium gap-1.5 transition-colors',
              showDesmos
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
            )}
            onClick={() => setShowDesmos((prev) => !prev)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {showDesmos ? 'Desmos хаах' : 'Desmos'}
          </Button>
        )}

        {intro.length > 0 && phase !== 'intro' && (
          <Button
            variant="secondary"
            size="md"
            className="font-medium gap-2"
            onClick={() => setShowSummary(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Товч тайлбар
          </Button>
        )}
      </div>
    </header>
  );

  if (!total) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 h-full justify-center">
        {header}
        <p className="p-6 text-center text-xl text-ink-2">{t('stop.noQuestions')}</p>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 h-full">
        {header}
        <StopIntro screens={intro} onDone={() => setPhase('play')} />
      </div>
    );
  }

  const check = () => {
    if (!value.trim() || revealed) return;
    setRevealed(true);
    setAnswers((a) => [
      ...a,
      { qid: q.id, answer: value.trim(), timeMs: Date.now() - started.current, hintUsed: hint },
    ]);
  };

  const next = async () => {
    if (i < total - 1) {
      setI(i + 1);
      setValue('');
      setRevealed(false);
      setHint(false);
      started.current = Date.now();
      return;
    }
    setPhase('saving');
    const r = await saveStop(demo, no, testOut, pool, answers);
    if (!r.ok) {
      setError(r.reason);
      setPhase('result');
      return;
    }
    setOutcome(r.outcome);
    setPhase('result');
    if (r.outcome.xp) toast(t('stop.xp', { n: r.outcome.xp }), { tone: 'success' });
    if (demo) loaded.reload();
    else router.refresh();
  };

  if (phase === 'result' || phase === 'saving') {
    const o = outcome;
    const nextStop = stopByNo(no + 1);
    const pct = o ? Math.round((o.correct / o.total) * 100) : 0;
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 h-full justify-between py-1 overflow-hidden">
        {header}
        <section
          className="relative flex flex-col items-center justify-center gap-4 p-4 text-center flex-1 my-auto overflow-hidden"
          aria-live="polite"
        >
          {o?.passed && <Confetti />}
          {phase === 'saving' || !o ? (
            error ? (
              <p className="text-2xl text-danger font-bold">{error}</p>
            ) : (
              <p className="text-3xl text-ink-2" aria-busy="true">
                …
              </p>
            )
          ) : (
            <>
              <div className="w-28">
                <CatHead mood={o.passed ? 'happy' : 'think'} />
              </div>
              <h2 className="font-display text-4xl font-black text-ink">
                {o.finishedAll ? t('celebrate.title') : o.passed ? t('stop.passed') : t('stop.failed')}
              </h2>
              <p className="text-xl font-bold text-ink-2 tnum">
                {t('stop.scoreLine', { c: o.correct, n: o.total, pct })}
              </p>
              {o.passed && !o.testOut && <StarRow stars={o.stars} size={36} />}
              {!o.passed && (
                <p className="max-w-md text-base text-ink-2">
                  {t('stop.failedBody', { need: neededToPass(o.total), n: o.total })}
                </p>
              )}
              {o.xp > 0 && <p className="text-xl font-bold text-leaf-2">{t('stop.xp', { n: o.xp })}</p>}
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                {o.passed && nextStop && (
                  <Link
                    href={routes.roadmapStop(nextStop.no)}
                    className="btn3d inline-flex h-14 items-center rounded-2xl px-8 text-base font-bold shadow-lg"
                    style={
                      {
                        '--face': 'var(--c-lime)',
                        '--edge': 'var(--c-lime-2)',
                        color: 'var(--c-on-lime)',
                      } as React.CSSProperties
                    }
                  >
                    {t('stop.nextStop', { place: nextStop.place })}
                  </Link>
                )}
                {!o.passed && (
                  <Button
                    variant="lime"
                    size="xl"
                    className="text-base h-14 px-8 rounded-2xl"
                    onClick={() => setRound((r) => r + 1)}
                  >
                    {t('stop.retry')}
                  </Button>
                )}
                <Link
                  href={routes.home}
                  className="inline-flex h-14 items-center rounded-2xl px-6 text-base font-bold text-ink-2 hover:bg-paper-2 transition-colors"
                >
                  {t('stop.toMap')}
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  const correct = revealed && isCorrect(q, value.trim());
  const right = answers.filter((a, j) => isCorrect(qs[j], a.answer)).length;

  return (
    <>
      <div
        className={cn(
          'w-full mx-auto flex flex-col justify-between h-full py-1 overflow-hidden transition-all duration-300',
          showDesmos ? 'max-w-7xl' : 'max-w-4xl',
        )}
      >
        <div className="flex flex-col gap-2 shrink-0">
          {header}
          <div className="flex items-center gap-3 px-1">
            <Bar
              value={(i + (revealed ? 1 : 0)) / total}
              tone="lime"
              h={10}
              className="flex-1"
              label={t('stop.problem', { i: i + 1, n: total })}
            />
            <span className="shrink-0 text-sm font-extrabold text-ink-2 tnum">
              {i + 1} / {total}
            </span>
          </div>
        </div>

        {/* Side-by-Side Grid Layout */}
        <div
          className={cn(
            'grid gap-6 flex-1 my-auto items-start overflow-hidden transition-all duration-300 py-2',
            showDesmos ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1',
          )}
        >
          <section
            className={cn(
              'relative flex flex-col justify-center gap-3 py-1 transition-all text-foreground overflow-hidden',
              showDesmos ? 'lg:col-span-5' : 'w-full',
            )}
            aria-label={t('stop.problem', { i: i + 1, n: total })}
          >
            <div className="relative z-10 text-xl sm:text-2xl md:text-3xl leading-snug text-ink font-bold overflow-y-auto max-h-[45vh] pr-2 custom-scrollbar">
              <QuestionView
                key={`${round}-${i}`}
                q={q}
                value={value}
                onChange={setValue}
                revealed={revealed}
                onSubmit={check}
              />
            </div>

            {hint && !revealed && (
              <div className="relative z-10 animate-fade-in rounded-2xl bg-teal-soft/90 p-3 text-base sm:text-lg font-bold text-teal border border-teal/20 max-h-24 overflow-y-auto">
                <Rich text={q.hint} />
              </div>
            )}

            {revealed && (
              <div
                role="status"
                className={cn(
                  'relative z-10 flex flex-col gap-2 rounded-2xl p-4 max-h-[26vh] overflow-y-auto transition-all duration-300 shadow-sm',
                  correct
                    ? 'bg-sage/90 border border-leaf-2/30'
                    : 'bg-danger-soft/90 border border-danger/30',
                )}
              >
                <p className={cn('text-lg sm:text-xl font-black', correct ? 'text-leaf-2' : 'text-danger')}>
                  {correct ? t('stop.correct') : t('stop.wrong')}
                  {!correct && (
                    <span className="ml-2 font-bold text-ink-2 text-sm sm:text-base">
                      <Rich text={t('stop.answerWas', { a: correctAnswerText(q) })} />
                    </span>
                  )}
                </p>
                <p className="text-base sm:text-lg leading-snug text-ink font-medium">
                  <Rich text={q.explain} />
                </p>
              </div>
            )}
          </section>

          {/* Desmos Panel */}
          {showDesmos && (
            <div className="lg:col-span-7 flex flex-col w-full rounded-2xl border border-line bg-paper p-3 overflow-hidden shadow-md animate-fade-in">
              <div className="flex items-center justify-between pb-2 mb-2 px-1 border-b border-line shrink-0">
                <span className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Desmos Graphing Calculator
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  onClick={() => setShowDesmos(false)}
                >
                  Хаах
                </Button>
              </div>
              <div className="w-full h-[520px] rounded-xl overflow-hidden relative">
                <div ref={desmosContainerRef} className="absolute inset-0 w-full h-full" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="relative z-10 flex items-center justify-between gap-4 pt-2 border-t border-border/20 shrink-0">
          {!revealed ? (
            <Button
              variant="ghost"
              size="lg"
              className="text-base font-bold px-5 py-2"
              onClick={() => setHint(true)}
              disabled={hint}
            >
              {t('stop.hint')}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-extrabold text-ink-3 tnum">
                Зөв: {right}/{answers.length}
              </span>
              {!correct && (
                <Link
                  href={routes.tutor({ kind: 'question', id: q.id, chosen: value.trim() })}
                  className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-paper px-4 text-sm font-bold text-ink hover:bg-paper-2"
                >
                  {t('stop.askSuu')}
                </Link>
              )}
            </div>
          )}
          <SuuTutorButton open={showSuu} onClick={() => setShowSuu((v) => !v)} />

          {!revealed ? (
            <Button
              variant="lime"
              size="xl"
              className="text-lg px-8 py-3 rounded-2xl font-black shadow-md"
              onClick={check}
              disabled={!value.trim()}
            >
              {t('stop.check')}
            </Button>
          ) : (
            <Button
              variant="lime"
              size="xl"
              className="text-lg px-8 py-3 rounded-2xl font-black shadow-md"
              onClick={next}
            >
              {i < total - 1 ? t('stop.next') : t('stop.finish')}
            </Button>
          )}
        </div>
      </div>

      {showSuu && (
        <SuuSidePanel
          context={{
            kind: 'question',
            id: q.id,
            title: q.skill,
            problem: questionProblem(q),
            chosen: revealed ? chosenText(q, value) : undefined,
          }}
          revealed={revealed}
          onClose={() => setShowSuu(false)}
        />
      )}

      <Modal
        open={showSummary}
        onClose={() => setShowSummary(false)}
        label="Товч тайлбар"
        className="max-w-6xl"
      >
        <StopIntro screens={intro} onDone={() => setShowSummary(false)} />
      </Modal>
    </>
  );
}
