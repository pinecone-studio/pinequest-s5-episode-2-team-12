'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Rich } from '@/components/math';
import { toast } from '@/components/ui/toast';
import { SaveStatus } from '@/features/mistakes/components/SaveStatus';
import { useAnswerSubmission } from '@/features/mistakes/useAnswerSubmission';
import {
  createTimedSession,
  finishTimedSession,
  formatTime,
  tickTimedSession,
} from '@/features/practice/lib/timed-session';
import { correctAnswerText, isCorrect } from '@/features/roadmap/lib/grade';
import { DesmosCatButton, DesmosSidePanel } from '@/features/tutor/components/DesmosSidePanel';
import { SuuSidePanel, SuuTutorButton, splitLayout } from '@/features/tutor/components/SuuSidePanel';
import { panelInput } from '@/features/tutor/lib/desmos-panel';
import { chosenText, questionProblem } from '@/features/tutor/lib/suu-panel';
import type { Question } from '@/types';

type Props = {
  questions: Question[];
  onNext?: () => void;
  onComplete?: () => void;
  lastInTopic?: boolean;
  onResolved?: () => void;
};

/* ───────── Shared look: uses the tokens from globals.css (--c-*, .card, .btn3d) ───────── */

// Big rounded card with the extruded edge.
const card = 'card rounded-[2rem] p-7';

// Disabled 3D buttons turn flat grey (the variables must be re-set because utilities beat .btn3d:disabled).
const btnDisabled = 'disabled:[--face:var(--c-line)] disabled:[--edge:var(--c-line-2)] disabled:text-ink-3';

// Green 3D press button.
const btnPrimary = `btn3d [--face:var(--c-leaf)] [--edge:var(--c-leaf-2)] rounded-2xl px-6 py-3 text-sm font-bold text-white ${btnDisabled}`;

// Dark 3D press button.
const btnSecondary = `btn3d [--face:var(--c-paper-2)] [--edge:var(--c-edge)] rounded-2xl border border-line px-5 py-2.5 text-sm font-bold text-ink ${btnDisabled}`;

// Small selectable chip (like the "5 / 10" picker).
const chipBase =
  'rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50';
const chipIdle = 'border-line bg-paper-2 text-ink-3 hover:border-leaf hover:text-ink';
const chipActive = 'border-leaf bg-leaf/10 text-leaf-2';
const chipMarked = 'border-amber bg-amber-soft text-amber';

// Small uppercase mono label (like "ИРСЭН ХҮСЭЛТ").
const sectionLabel = 'eyebrow text-ink-3';

// Rounded row (like a friend row).
const row = 'rounded-2xl border border-line bg-paper';

// Teal info pill (like the "Демо горим" banner).
const infoPill = 'rounded-full bg-teal-soft px-6 py-3 text-sm font-semibold text-teal';

export function PracticePlayer({ questions, onNext, onComplete, lastInTopic, onResolved }: Props) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const saving = useAnswerSubmission(onResolved);
  const [submitted, setSubmitted] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [showDesmos, setShowDesmos] = useState(false);
  const [showSuu, setShowSuu] = useState(false);

  // Timed Mode state
  const [timedMode, setTimedMode] = useState(false);
  const [session, setSession] = useState(createTimedSession);
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, string>>({});
  const finalizedRef = useRef(false);

  const activeQuestions = timedMode ? questions.slice(0, 5) : questions;

  const question = activeQuestions[index];
  // what the Desmos side panel sends to Суу for this problem (stable per question, so it asks once)
  const desmosInput = useMemo(() => (question ? panelInput(question) : null), [question]);
  // the «AI багш Суу» side panel's problem text (stable per question; a new question starts a new chat)
  const suuProblem = useMemo(() => (question ? questionProblem(question) : ''), [question]);

  // Countdown: one tick per second while the timed session is running.
  useEffect(() => {
    if (!timedMode || session.status !== 'running') {
      return;
    }

    const timer = setInterval(() => {
      setSession((current) => {
        if (current.status !== 'running') {
          return current;
        }

        const next = tickTimedSession(current);

        if (next.status === 'finished') {
          finalizedRef.current = true;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timedMode, session.status]);

  function resetQuestionState() {
    saving.reset();
    setAnswer('');
    setRevealed(false);
    setSubmitted(false);
    setHintVisible(false);
    setShowDesmos(false);
  }

  function startTimedMode() {
    if (questions.length < 5) {
      toast('Timed Mode-д дор хаяж 5 асуулт шаардлагатай.', {
        tone: 'xp',
      });
      return;
    }

    setSession(createTimedSession());
    setSessionAnswers({});
    setIndex(0);
    resetQuestionState();
    finalizedRef.current = false;
    setTimedMode(true);
  }

  function finishTimedMode() {
    if (finalizedRef.current) {
      return;
    }

    finalizedRef.current = true;
    setSession((current) => finishTimedSession(current));
  }

  function submitAnswer(value: string) {
    if (
      saving.busy ||
      (submitted && question && isCorrect(question, answer)) ||
      (timedMode && session.status !== 'running') ||
      !question
    ) {
      return;
    }

    setAnswer(value);
    setSubmitted(true);
    setRevealed(false);
    void saving.submit({ qid: question.id, questionSource: 'practice' }, value);

    if (timedMode) {
      setSessionAnswers((previous) => ({
        ...previous,
        [question.id]: value,
      }));
    }

    if (isCorrect(question, value)) {
      toast('+5 XP', { tone: 'xp' });
    }
  }

  function goTo(nextIndex: number) {
    if (
      saving.busy ||
      nextIndex < 0 ||
      nextIndex >= activeQuestions.length ||
      (timedMode && session.status !== 'running')
    ) {
      return;
    }

    setIndex(nextIndex);
    resetQuestionState();
  }

  if (questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-3 p-6 text-ink">
        <h1 className="font-display text-3xl font-bold tracking-tight">Дасгал</h1>
        <p className="text-ink-2">Одоогоор асуулт алга байна.</p>
      </main>
    );
  }

  // Results screen after manually finishing or running out of time.
  if (timedMode && session.status === 'finished') {
    const correctCount = activeQuestions.filter((item) => {
      const submittedAnswer = sessionAnswers[item.id];

      return submittedAnswer !== undefined && isCorrect(item, submittedAnswer);
    }).length;

    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6 text-ink">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Сорил дууслаа!</h1>
          <p className="text-ink-2">
            {session.remainingSeconds === 0
              ? 'Хугацаа дууссан тул сорил автоматаар дууслаа.'
              : 'Та сорилоо дуусгалаа.'}
          </p>
        </header>

        <section role="status" className={`${card} space-y-6`}>
          <div className="space-y-2">
            <h2 className="text-base font-bold">Зөв хариулт</h2>
            <p className="font-display text-5xl font-bold text-leaf-2">
              {correctCount}{' '}
              <span className="text-2xl font-semibold text-ink-3">/ {activeQuestions.length}</span>
            </p>
            <p className="text-sm text-ink-3">
              {activeQuestions.length > 0
                ? `${Math.round((correctCount / activeQuestions.length) * 100)}% зөв`
                : 'Үр дүн байхгүй'}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className={sectionLabel}>Асуултын үр дүн</h2>

            <div className="scroll-thin max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {activeQuestions.map((item, i) => {
                const submittedAnswer = sessionAnswers[item.id];
                const answeredCorrectly = submittedAnswer !== undefined && isCorrect(item, submittedAnswer);

                return (
                  <div key={item.id} className={`${row} flex items-center justify-between gap-3 px-5 py-3.5`}>
                    <span className="text-sm font-bold text-ink">Асуулт {i + 1}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        submittedAnswer === undefined
                          ? 'bg-paper-2 text-ink-3'
                          : answeredCorrectly
                            ? 'bg-sage text-leaf-2'
                            : 'bg-danger-soft text-danger'
                      }`}
                    >
                      {submittedAnswer === undefined ? 'Хариулаагүй' : answeredCorrectly ? 'Зөв' : 'Буруу'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={startTimedMode} className={btnPrimary}>
            Дахин эхлүүлэх
          </button>

          <button
            type="button"
            onClick={() => {
              setTimedMode(false);
              setSession(createTimedSession());
              setSessionAnswers({});
              setIndex(0);
              resetQuestionState();
              finalizedRef.current = false;
            }}
            className={btnSecondary}
          >
            Энгийн дасгал руу буцах
          </button>
        </div>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-3 p-6 text-ink">
        <h1 className="font-display text-3xl font-bold tracking-tight">Дасгал</h1>
        <p className="text-ink-2">Одоогоор асуулт алга байна.</p>
      </main>
    );
  }

  const correct = submitted && isCorrect(question, answer);
  const last = index === activeQuestions.length - 1;
  const timedSessionRunning = !timedMode || session.status === 'running';

  return (
    <main
      className={`mx-auto w-full p-6 text-ink ${splitLayout((showDesmos && !!desmosInput) || showSuu, 'max-w-3xl')}`}
    >
      <div className="min-w-0 space-y-5">
        {/* Page header */}
        <header className="space-y-2">
          <h1 className="font-display flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
            <span>🐈‍⬛</span> Дасгал
          </h1>
          <p className="text-ink-2">
            SAT Math асуултуудыг бод, XP цуглуул. {index + 1} / {activeQuestions.length}
          </p>
        </header>

        {/* Timed mode banner (teal info pill) */}
        {timedMode ? (
          <div className={`${infoPill} flex flex-wrap items-center justify-between gap-3`}>
            <span>Timed Mode</span>

            <span
              role="timer"
              aria-live="off"
              className="tnum font-mono text-xl font-bold tracking-wider text-leaf-2"
            >
              {formatTime(session.remainingSeconds)}
            </span>

            <button
              type="button"
              onClick={finishTimedMode}
              disabled={session.status !== 'running'}
              className={`${btnSecondary} !px-4 !py-1.5 !text-xs`}
            >
              Дуусгах
            </button>
          </div>
        ) : (
          <div className={`${infoPill} flex flex-wrap items-center justify-between gap-3`}>
            <span>Хугацаатай сорил: 5 асуулт, 6 минут</span>
            <button
              type="button"
              onClick={startTimedMode}
              disabled={questions.length < 5}
              aria-label="6 минутын сорил эхлүүлэх"
              className={`${btnPrimary} !px-4 !py-1.5 !text-xs`}
            >
              <span aria-hidden="true">⚡</span> Эхлүүлэх
            </button>
          </div>
        )}

        {/* Question picker */}
        <section className={`${card} space-y-4`}>
          <h2 className={sectionLabel}>Асуулт сонгох</h2>

          <nav className="flex flex-wrap gap-2" aria-label="Асуулт сонгох">
            {activeQuestions.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(i)}
                disabled={saving.busy || !timedSessionRunning}
                aria-label={`${i + 1}-р асуулт`}
                aria-current={i === index ? 'step' : undefined}
                className={`${chipBase} flex h-10 min-w-12 items-center justify-center gap-1 ${
                  i === index ? chipActive : marked.includes(item.id) ? chipMarked : chipIdle
                }`}
              >
                {marked.includes(item.id) ? (
                  <span>⚑ {i + 1}</span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    {i % 2 === 0 ? '🐈' : '🐈‍⬛'} {i + 1}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </section>

        {/* Question card */}
        <section className={`${card} space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink">{question.skill}</h2>
            <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-bold text-teal">
              Difficulty {question.difficulty}
            </span>
          </div>

          <div className="text-[17px] font-medium leading-relaxed text-ink">
            <Rich text={question.prompt} />
          </div>

          <div>
            <button
              type="button"
              onClick={() =>
                setMarked((previous) =>
                  previous.includes(question.id)
                    ? previous.filter((id) => id !== question.id)
                    : [...previous, question.id],
                )
              }
              disabled={saving.busy || !timedSessionRunning}
              aria-pressed={marked.includes(question.id)}
              className={`${chipBase} px-4 ${marked.includes(question.id) ? chipMarked : chipIdle}`}
            >
              {marked.includes(question.id) ? '⚑ Тэмдэглэгээг авах' : '⚑ Асуултыг тэмдэглэх'}
            </button>
          </div>

          {question.choices ? (
            <div className="grid gap-3">
              {question.choices.map((choice, i) => {
                const isSelected = answer === String(i);
                const isRight = question.answer === i;

                return (
                  <button
                    key={`${question.id}-${i}`}
                    type="button"
                    disabled={saving.busy || (submitted && correct) || !timedSessionRunning}
                    onClick={() => submitAnswer(String(i))}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition ${
                      (revealed || correct) && isRight
                        ? 'border-leaf bg-sage text-leaf-2'
                        : revealed && isSelected
                          ? 'border-danger bg-danger-soft text-danger'
                          : isSelected
                            ? 'border-leaf bg-leaf/10 text-ink'
                            : 'border-line bg-paper-2 text-ink hover:border-leaf'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        (revealed || correct) && isRight
                          ? 'bg-leaf text-white'
                          : revealed && isSelected
                            ? 'bg-danger text-white'
                            : isSelected
                              ? 'bg-leaf text-white'
                              : 'border border-line bg-paper text-ink-3'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <div className="flex-1 text-[15px]">
                      <Rich text={choice} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                if (answer.trim() && !(submitted && correct)) {
                  submitAnswer(answer);
                }
              }}
            >
              <input
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setSubmitted(false);
                  setRevealed(false);
                }}
                disabled={saving.busy || (submitted && correct) || !timedSessionRunning}
                aria-label="Хариулт"
                placeholder="Хариултаа бичнэ үү"
                className="min-w-0 flex-1 rounded-2xl border border-line bg-paper-2 px-5 py-3.5 font-mono text-lg text-ink placeholder:text-sm placeholder:uppercase placeholder:tracking-[0.15em] disabled:opacity-60"
              />

              {!(submitted && correct) && (
                <button
                  type="submit"
                  disabled={saving.busy || !answer.trim() || !timedSessionRunning}
                  className={btnPrimary}
                >
                  Шалгах
                </button>
              )}
            </form>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setHintVisible((visible) => !visible)}
              disabled={saving.busy || !timedSessionRunning}
              className={btnSecondary}
            >
              {hintVisible ? 'Сэжүүр нуух' : '🐈 Hint · Сэжүүр'}
            </button>

            <SuuTutorButton
              open={showSuu}
              onClick={() => {
                setShowDesmos(false);
                setShowSuu((visible) => !visible);
              }}
              disabled={!timedSessionRunning}
            />

            <DesmosCatButton
              open={showDesmos}
              onClick={() => setShowDesmos((visible) => !visible)}
              disabled={saving.busy || !timedSessionRunning}
            />
          </div>

          {hintVisible && (
            <aside className="rounded-2xl border border-amber/40 bg-amber-soft p-4 text-sm text-amber">
              <p className="mb-1 flex items-center gap-1.5 font-bold">
                <span>🐈‍⬛</span> Hint
              </p>
              <Rich text={question.hint} />
            </aside>
          )}

          {submitted && (
            <section
              role="status"
              className={`space-y-3 rounded-2xl border p-5 ${
                correct ? 'border-leaf bg-sage text-leaf-2' : 'border-danger bg-danger-soft text-danger'
              }`}
            >
              <h2 className="flex items-center gap-2 text-base font-bold">
                <span>{correct ? '✨ Зөв хариулт! +5 XP' : 'Буруу байна. Дахин оролдоорой.'}</span>
              </h2>

              {!correct && revealed && (
                <div className="space-y-1.5 text-sm">
                  <p className="font-bold">
                    Хариу: <Rich text={correctAnswerText(question)} />
                  </p>
                  <div className="text-ink">
                    {question.choices && question.why?.[Number(answer)] && (
                      <Rich text={question.why[Number(answer)]} />
                    )}
                    <Rich text={question.explain} />
                  </div>
                </div>
              )}

              {!correct && (
                <button type="button" className={btnSecondary} onClick={() => setRevealed((value) => !value)}>
                  {revealed ? 'Хариу нуух' : 'Хариу харах'}
                </button>
              )}
              {correct && (
                <div className="space-y-1.5 text-sm">
                  <p className="font-bold">Тайлбар</p>
                  <div className="text-ink">
                    <Rich text={question.explain} />
                  </div>
                </div>
              )}
              {correct && (
                <div className="space-y-3">
                  {(lastInTopic ?? last) && <p className="font-bold">Сэдвийн бодлогууд дууслаа!</p>}
                  {(onNext || !last) && !(lastInTopic ?? last) && (
                    <button
                      type="button"
                      disabled={saving.busy}
                      onClick={onNext ?? (() => goTo(index + 1))}
                      className={btnPrimary}
                    >
                      Дараагийн бодлого →
                    </button>
                  )}
                  {(lastInTopic ?? last) && onComplete && (
                    <button
                      type="button"
                      disabled={saving.busy}
                      onClick={onComplete}
                      className={btnSecondary}
                    >
                      Бодлогын жагсаалт руу буцах
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          <SaveStatus {...saving} />

          <footer className="flex items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              disabled={saving.busy || index === 0 || !timedSessionRunning}
              onClick={() => goTo(index - 1)}
              className={btnSecondary}
            >
              Өмнөх
            </button>

            <button
              type="button"
              disabled={saving.busy || last || !timedSessionRunning}
              onClick={() => goTo(index + 1)}
              className={btnPrimary}
            >
              Дараагийн асуулт 🐾
            </button>
          </footer>
        </section>
      </div>

      {showDesmos && desmosInput && (
        <DesmosSidePanel
          input={desmosInput}
          revealed={correct || revealed}
          onClose={() => setShowDesmos(false)}
        />
      )}

      {showSuu && question && (
        <SuuSidePanel
          context={{
            kind: 'question',
            id: question.id,
            title: question.skill,
            problem: suuProblem,
            chosen: submitted ? chosenText(question, answer) : undefined,
          }}
          revealed={submitted}
          onClose={() => setShowSuu(false)}
        />
      )}
    </main>
  );
}
