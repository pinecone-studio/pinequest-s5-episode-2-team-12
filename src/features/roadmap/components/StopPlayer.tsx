'use client';
// A stop: optional intro → problem set (instant right/wrong + Mongolian explanation, «Суугаас асуух» on a miss)
// → result (pass/fail, stars, XP, badges, next stop). Failing never locks anything: «Дахин оролдох» draws a
// fresh set where missed questions weigh more.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Rich } from '@/components/math';
import { Bar } from '@/components/ui/Bar';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { BADGES } from '@/mocks/meta';
import type { Question } from '@/types';
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
  /** Start with the intro screens whatever the mastery (from «Товч хичээл үзэх»). */
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
  const stop = stopByNo(no)!;
  const topic = topicById(no)!;
  const state = loaded.state;
  const mastery = masteryAt(state, no);
  const done = isDone(state.stops.find((p) => p.no === no));
  const testOut = wantTestOut && mastery === 'strong' && !done;
  const allowed = isOpen(state) && canOpenStop(state.stops, no);

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('play');
  const [ids, setIds] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [outcome, setOutcome] = useState<StopOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());

  useEffect(() => {
    if (!loaded.ready || !allowed) return;
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
    setPhase(
      round === 0 && !testOut && intro.length && (forceIntro || ROADMAP.autoIntro.includes(mastery))
        ? 'intro'
        : 'play',
    );
    setI(0);
    setValue('');
    setRevealed(false);
    setHint(false);
    setAnswers([]);
    setOutcome(null);
    started.current = Date.now();
  }, [loaded.ready, allowed, round]);

  const byId = useMemo(() => new Map(pool.map((q) => [q.id, q])), [pool]);
  const qs = (ids ?? []).map((id) => byId.get(id)!).filter(Boolean);
  const q = qs[i];
  const total = qs.length;
  const right = answers.filter((a, j) => isCorrect(qs[j], a.answer)).length;

  if (!loaded.ready) return <div className="h-64 w-full animate-pulse rounded-3xl bg-sage/20" aria-busy="true" />;

  if (!allowed) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-8 p-10 text-center">
        <div className="w-32">
          <CatHead mood="sleep" />
        </div>
        <h1 className="font-display text-4xl font-extrabold text-ink">{t('stop.lockedTitle')}</h1>
        <p className="text-2xl text-ink-2">{isOpen(state) ? t('sheet.locked') : t('sheet.closedRoadmap')}</p>
        <Link
          href={isOpen(state) ? routes.home : routes.placement}
          className="text-2xl font-bold text-leaf-2 underline underline-offset-4"
        >
          {isOpen(state) ? t('stop.toMap') : t('gate.take')}
        </Link>
      </section>
    );
  }

  // Асар том, тод харагдах Header
  const header = (
    <header className="flex items-center gap-5 px-1 py-3">
      <span
        className="grid size-16 shrink-0 place-items-center rounded-2xl bg-sage/80 text-leaf-2 transition-transform hover:scale-105"
        aria-hidden="true"
      >
        <TopicIcon name={topic.icon} size={38} />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black leading-tight text-ink">
          {testOut ? `${t('stop.testOutTitle')}: ` : ''}
          {topic.title}
        </h1>
      </div>
    </header>
  );

  if (!total) {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
        {header}
        <p className="p-10 text-center text-3xl text-ink-2">{t('stop.noQuestions')}</p>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
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
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
        {header}
        <section
          className="relative flex flex-col items-center gap-8 p-8 text-center sm:p-14"
          aria-live="polite"
        >
          {o?.passed && <Confetti />}
          {phase === 'saving' || !o ? (
            error ? (
              <p className="text-3xl text-danger font-bold">{error}</p>
            ) : (
              <p className="text-4xl text-ink-2" aria-busy="true">
                …
              </p>
            )
          ) : (
            <>
              <div className="w-44 transition-transform hover:scale-110">
                <CatHead mood={o.passed ? 'happy' : 'think'} />
              </div>
              <h2 className="font-display text-5xl sm:text-6xl font-black text-ink">
                {o.finishedAll ? t('celebrate.title') : o.passed ? t('stop.passed') : t('stop.failed')}
              </h2>
              <p className="text-3xl font-bold text-ink-2 tnum">{t('stop.scoreLine', { c: o.correct, n: o.total, pct })}</p>
              {o.passed && !o.testOut && <StarRow stars={o.stars} size={54} />}
              {o.passed && o.testOut && (
                <span className="rounded-full bg-sage px-8 py-3 text-2xl font-bold text-leaf-2">
                  {t('testedOutChip')}
                </span>
              )}
              {!o.passed && (
                <p className="max-w-2xl text-xl sm:text-2xl text-ink-2 leading-relaxed">
                  {t('stop.failedBody', { need: neededToPass(o.total), n: o.total })}
                </p>
              )}
              {o.xp > 0 && <p className="text-3xl font-black text-leaf-2">{t('stop.xp', { n: o.xp })}</p>}
              {o.badges.map((b) => (
                <p key={b} className="rounded-3xl bg-sage px-8 py-4 text-2xl font-bold text-leaf-2">
                  {t('stop.region', { name: BADGES.find((x) => x.id === b)?.mn ?? b })}
                </p>
              ))}
              {o.finishedAll && <p className="max-w-2xl text-2xl text-ink-2 leading-relaxed">{t('celebrate.body')}</p>}
              <div className="mt-8 flex flex-wrap justify-center gap-5">
                {o.passed && nextStop && (
                  <Link
                    href={routes.roadmapStop(nextStop.no)}
                    className="btn3d mb-[5px] inline-flex h-16 items-center rounded-2xl px-10 text-xl font-bold shadow-lg"
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
                {o.finishedAll && (
                  <Link
                    href={routes.mock}
                    className="inline-flex h-16 items-center rounded-2xl px-8 text-xl font-bold text-leaf-2 hover:bg-sage/40 transition-colors"
                  >
                    {t('celebrate.mock')}
                  </Link>
                )}
                {!o.passed && (
                  <Button variant="lime" size="xl" className="text-xl h-16 px-10 rounded-2xl" onClick={() => setRound((r) => r + 1)}>
                    {t('stop.retry')}
                  </Button>
                )}
                <Link
                  href={routes.home}
                  className="inline-flex h-16 items-center rounded-2xl px-8 text-xl font-bold text-ink-2 hover:bg-paper-2 transition-colors"
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
  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
      {header}

      {/* Явцын прогресс бар (Улам өндөр, том заалттай) */}
      <div className="flex items-center gap-5 px-1">
        <Bar
          value={(i + (revealed ? 1 : 0)) / total}
          tone="lime"
          h={16}
          className="flex-1"
          label={t('stop.problem', { i: i + 1, n: total })}
        />
        <span className="shrink-0 text-xl font-black text-ink-2 tnum">
          {i + 1} / {total}
        </span>
      </div>

      {intro.length > 0 && i === 0 && !revealed && !testOut && (
        <button
          type="button"
          onClick={() => setPhase('intro')}
          className="self-start text-lg font-bold text-leaf-2 underline underline-offset-4 transition-colors hover:text-leaf"
        >
          {t('stop.introOpen')}
        </button>
      )}

      {/* 🚀 Асар том тексттэй, хайрцаггүй интерактив талбар */}
      <section
        className="relative flex flex-col gap-10 py-2 transition-all text-foreground"
        aria-label={t('stop.problem', { i: i + 1, n: total })}
      >
        {!q.reviewed && (
          <p className="self-start rounded-full bg-amber-soft px-5 py-1.5 text-sm font-bold text-amber">
            {t('stop.unreviewed')}
          </p>
        )}

        {/* Асуултын бичвэр: Асар том (text-2xl sm:text-3xl md:text-4xl) */}
        <div className="relative z-10 text-2xl sm:text-3xl md:text-4xl leading-relaxed text-ink font-semibold tracking-normal">
          <QuestionView
            key={`${round}-${i}`}
            q={q}
            value={value}
            onChange={setValue}
            revealed={revealed}
            onSubmit={check}
          />
        </div>

        {/* Санамж / Hint */}
        {hint && !revealed && (
          <div className="relative z-10 animate-fade-in rounded-3xl bg-teal-soft/90 p-8 text-xl sm:text-2xl font-medium text-teal border border-teal/20">
            <Rich text={q.hint} />
          </div>
        )}

        {/* Шалгасны дараах хариу/тайлбар (Том, тод) */}
        {revealed && (
          <div
            role="status"
            className={cn(
              'relative z-10 flex flex-col gap-6 rounded-3xl p-8 sm:p-10 transition-all duration-300 shadow-sm',
              correct ? 'bg-sage/90 border border-leaf-2/30' : 'bg-danger-soft/90 border border-danger/30'
            )}
          >
            <p className={cn('text-2xl sm:text-3xl font-black', correct ? 'text-leaf-2' : 'text-danger')}>
              {correct ? t('stop.correct') : t('stop.wrong')}
              {!correct && (
                <span className="ml-3 font-bold text-ink-2">
                  <Rich text={t('stop.answerWas', { a: correctAnswerText(q) })} />
                </span>
              )}
            </p>
            {!correct && q.why?.[Number(value)] && (
              <p className="text-xl sm:text-2xl font-medium text-ink-2">
                <Rich text={q.why[Number(value)]} />
              </p>
            )}
            <p className="text-xl sm:text-2xl leading-relaxed text-ink">
              <Rich text={q.explain} />
            </p>
            {q.desmos?.tip && (
              <details className="text-lg sm:text-xl text-ink-2">
                <summary className="cursor-pointer font-bold text-teal hover:underline">
                  {t('stop.desmosTip')}
                </summary>
                <p className="mt-3">
                  <Rich text={q.desmos.tip} />
                </p>
              </details>
            )}
            {!correct && (
              <Link
                href={routes.tutor({ kind: 'question', id: q.id, chosen: value.trim() })}
                className="inline-flex min-h-14 items-center gap-3 self-start rounded-2xl border border-line bg-paper px-6 text-lg font-bold text-ink transition-transform hover:scale-102 shadow-sm"
              >
                {t('stop.askSuu')}
              </Link>
            )}
          </div>
        )}

        {/* Доод навигаци ба Товчлуур (Илүү том, дарахад хялбар) */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6 pt-8 border-t border-border/20">
          {!revealed ? (
            <Button variant="ghost" size="lg" className="text-lg font-bold px-6 py-3" onClick={() => setHint(true)} disabled={hint}>
              {t('stop.hint')}
            </Button>
          ) : (
            <span className="text-lg font-black text-ink-3 tnum">
              Зөв: {right}/{answers.length}
            </span>
          )}
          {!revealed ? (
            <Button variant="lime" size="xl" className="text-xl sm:text-2xl px-10 py-4 rounded-2xl font-bold" onClick={check} disabled={!value.trim()}>
              {t('stop.check')}
            </Button>
          ) : (
            <Button variant="lime" size="xl" className="text-xl sm:text-2xl px-10 py-4 rounded-2xl font-bold" onClick={next}>
              {i < total - 1 ? t('stop.next') : t('stop.finish')}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}