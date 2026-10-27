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
import { SuuSidePanel, SuuTutorButton, splitLayout } from '@/features/tutor/components/SuuSidePanel';
import { chosenText, questionProblem } from '@/features/tutor/lib/suu-panel';
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
  const [showSuu, setShowSuu] = useState(false);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [outcome, setOutcome] = useState<StopOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());

  // draw the set once the state is known; a new round (retry) draws a fresh one
  // biome-ignore lint/correctness/useExhaustiveDependencies: draw only when readiness or the round changes, not on every state update
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

  if (!loaded.ready) return <div className="soft-card h-64 animate-pulse" aria-busy="true" />;

  if (!allowed) {
    return (
      <section className="soft-card mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
        <div className="w-24">
          <CatHead mood="sleep" />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">{t('stop.lockedTitle')}</h1>
        <p className="text-ink-2">{isOpen(state) ? t('sheet.locked') : t('sheet.closedRoadmap')}</p>
        <Link
          href={isOpen(state) ? routes.home : routes.placement}
          className="font-bold text-leaf-2 underline"
        >
          {isOpen(state) ? t('stop.toMap') : t('gate.take')}
        </Link>
      </section>
    );
  }

  const header = (
    <header className="flex items-center gap-3">
      <span
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sage text-leaf-2"
        aria-hidden="true"
      >
        <TopicIcon name={topic.icon} size={26} />
      </span>
      <div className="min-w-0">
        <p className="eyebrow">
          {t('stopNo', { n: no })} · {stop.place}
        </p>
        <h1 className="font-display text-lg font-bold leading-tight text-ink sm:text-xl">
          {testOut ? `${t('stop.testOutTitle')}: ` : ''}
          {topic.title}
        </h1>
      </div>
    </header>
  );

  if (!total) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {header}
        <p className="soft-card p-6 text-ink-2">{t('stop.noQuestions')}</p>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
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
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {header}
        <section
          className={cn(
            'soft-card relative flex flex-col items-center gap-4 overflow-hidden p-6 text-center sm:p-8',
          )}
          aria-live="polite"
        >
          {o?.passed && <Confetti />}
          {phase === 'saving' || !o ? (
            error ? (
              <p className="text-danger">{error}</p>
            ) : (
              <p className="text-ink-2" aria-busy="true">
                …
              </p>
            )
          ) : (
            <>
              <div className="w-24">
                <CatHead mood={o.passed ? 'happy' : 'think'} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink">
                {o.finishedAll ? t('celebrate.title') : o.passed ? t('stop.passed') : t('stop.failed')}
              </h2>
              <p className="text-ink-2 tnum">{t('stop.scoreLine', { c: o.correct, n: o.total, pct })}</p>
              {o.passed && !o.testOut && <StarRow stars={o.stars} size={30} />}
              {o.passed && o.testOut && (
                <span className="rounded-full border border-sage-2 bg-sage px-3 py-1 text-sm font-bold text-leaf-2">
                  {t('testedOutChip')}
                </span>
              )}
              {!o.passed && (
                <p className="max-w-md text-sm text-ink-2">
                  {t('stop.failedBody', { need: neededToPass(o.total), n: o.total })}
                </p>
              )}
              {o.xp > 0 && <p className="font-bold text-leaf-2">{t('stop.xp', { n: o.xp })}</p>}
              {o.badges.map((b) => (
                <p key={b} className="rounded-2xl bg-sage px-4 py-2 font-bold text-leaf-2">
                  {t('stop.region', { name: BADGES.find((x) => x.id === b)?.mn ?? b })}
                </p>
              ))}
              {o.finishedAll && <p className="max-w-md text-ink-2">{t('celebrate.body')}</p>}
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {o.passed && nextStop && (
                  <Link
                    href={routes.roadmapStop(nextStop.no)}
                    className="btn3d mb-[5px] inline-flex h-11 items-center rounded-2xl px-5 text-[14px] font-bold"
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
                    className="inline-flex h-11 items-center rounded-2xl px-4 font-bold text-leaf-2"
                  >
                    {t('celebrate.mock')}
                  </Link>
                )}
                {!o.passed && (
                  <Button variant="lime" onClick={() => setRound((r) => r + 1)}>
                    {t('stop.retry')}
                  </Button>
                )}
                <Link
                  href={routes.home}
                  className="inline-flex h-11 items-center rounded-2xl px-4 font-bold text-ink-2 hover:bg-paper-2"
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
    <div className={cn('mx-auto w-full', splitLayout(showSuu, 'max-w-2xl'))}>
      <div className="flex min-w-0 flex-col gap-5">
        {header}
        <div className="flex items-center gap-3">
          <Bar
            value={(i + (revealed ? 1 : 0)) / total}
            tone="lime"
            h={10}
            className="flex-1"
            label={t('stop.problem', { i: i + 1, n: total })}
          />
          <span className="shrink-0 text-[13px] font-semibold text-ink-2 tnum">
            {t('stop.problem', { i: i + 1, n: total })}
          </span>
        </div>
        {intro.length > 0 && i === 0 && !revealed && !testOut && (
          <button
            type="button"
            onClick={() => setPhase('intro')}
            className="self-start text-sm font-bold text-leaf-2 underline underline-offset-4"
          >
            {t('stop.introOpen')}
          </button>
        )}

        <section
          className="soft-card flex flex-col gap-5 p-5 sm:p-7"
          aria-label={t('stop.problem', { i: i + 1, n: total })}
        >
          {!q.reviewed && (
            <p className="self-start rounded-full bg-amber-soft px-2.5 py-0.5 text-[11px] font-bold text-amber">
              {t('stop.unreviewed')}
            </p>
          )}
          <QuestionView
            key={`${round}-${i}`}
            q={q}
            value={value}
            onChange={setValue}
            revealed={revealed}
            onSubmit={check}
          />

          {hint && !revealed && (
            <p className="rounded-2xl bg-teal-soft px-4 py-3 text-sm text-teal">
              <Rich text={q.hint} />
            </p>
          )}

          {revealed && (
            <div
              role="status"
              className={cn('flex flex-col gap-3 rounded-2xl p-4', correct ? 'bg-sage' : 'bg-danger-soft')}
            >
              <p className={cn('font-bold', correct ? 'text-leaf-2' : 'text-danger')}>
                {correct ? t('stop.correct') : t('stop.wrong')}
                {!correct && (
                  <span className="ml-2 font-semibold text-ink-2">
                    <Rich text={t('stop.answerWas', { a: correctAnswerText(q) })} />
                  </span>
                )}
              </p>
              {!correct && q.why?.[Number(value)] && (
                <p className="text-sm text-ink-2">
                  <Rich text={q.why[Number(value)]} />
                </p>
              )}
              <p className="text-[15px] leading-relaxed text-ink">
                <Rich text={q.explain} />
              </p>
              {q.desmos?.tip && (
                <details className="text-sm text-ink-2">
                  <summary className="cursor-pointer font-bold text-teal">{t('stop.desmosTip')}</summary>
                  <p className="mt-2">
                    <Rich text={q.desmos.tip} />
                  </p>
                </details>
              )}
              {!correct && (
                <Link
                  href={routes.tutor({ kind: 'question', id: q.id, chosen: value.trim() })}
                  className="inline-flex min-h-11 items-center gap-2 self-start rounded-2xl border border-line bg-paper px-4 text-sm font-bold text-ink hover:bg-paper-2"
                >
                  {t('stop.askSuu')}
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {!revealed ? (
                <Button variant="ghost" size="sm" onClick={() => setHint(true)} disabled={hint}>
                  {t('stop.hint')}
                </Button>
              ) : (
                <span className="text-sm text-ink-3 tnum">
                  {right}/{answers.length}
                </span>
              )}
              <SuuTutorButton open={showSuu} onClick={() => setShowSuu((v) => !v)} />
            </div>
            {!revealed ? (
              <Button variant="lime" onClick={check} disabled={!value.trim()}>
                {t('stop.check')}
              </Button>
            ) : (
              <Button variant="lime" onClick={next}>
                {i < total - 1 ? t('stop.next') : t('stop.finish')}
              </Button>
            )}
          </div>
        </section>
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
    </div>
  );
}
