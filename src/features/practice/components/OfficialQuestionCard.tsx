'use client';

import { type ClipboardEvent, type FormEvent, useEffect, useId, useState } from 'react';
import { SaveStatus } from '@/features/mistakes/components/SaveStatus';
import { useAnswerSubmission } from '@/features/mistakes/useAnswerSubmission';
import { SuuTutorButton } from '@/features/tutor/components/SuuSidePanel';
import { checkGridInAnswer } from '@/lib/check-answer';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { copyText, questionCopyText } from '../lib/copy-text';
import { cbScope, type OfficialQuestion } from '../lib/official';
import { officialSolveIssue } from '../lib/topic-bank';

/** Copy a selection inside a question as one-line math instead of MathML's symbol-per-line text. */
function copyAsText(event: ClipboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  const text = Array.from({ length: selection.rangeCount }, (_, i) =>
    copyText(selection.getRangeAt(i).cloneContents()),
  ).join('\n');
  if (!text) return;
  event.preventDefault();
  event.clipboardData.setData('text/plain', text);
}

/** Copies the whole question (prompt + choices) as plain text. */
function CopyQuestionButton({ question }: { question: OfficialQuestion }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(questionCopyText(question.promptHtml, question.choices));
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Бодлогыг хуулах · ${question.id}`}
      className="rounded-lg border border-line bg-paper-2 px-2.5 py-1 text-xs font-bold text-ink-2 transition hover:border-leaf hover:text-leaf-2"
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Хуулсан ✓' : state === 'failed' ? 'Хуулж чадсангүй' : 'Хуулах'}
      </span>
    </button>
  );
}

/** College Board HTML that was prepared on the server with the same scope (see lib/cb-html.ts). */
export function CbHtml({ html, scope, className }: { html: string; scope: string; className?: string }) {
  return (
    <div
      data-cb={scope}
      className={cn('cb-html', className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by prepareCbHtml on the server
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** What the bank's «AI багш Суу» panel needs from the card that opened it. */
export type SuuState = { checked: boolean; chosen?: string };

export function OfficialQuestionCard({
  question,
  index,
  onNext,
  onComplete,
  lastInTopic = false,
  onResolved,
  suuOpen = false,
  onSuu,
  initialAnswer,
  initiallyChecked = false,
  onAnswer,
}: {
  question: OfficialQuestion;
  index: number;
  onNext?: () => void;
  onComplete?: () => void;
  lastInTopic?: boolean;
  onResolved?: () => void;
  /** This card's problem is open in the Суу side panel. */
  suuOpen?: boolean;
  /** Opens (state) or closes (null) the Суу side panel for this card. */
  onSuu?: (state: SuuState | null) => void;
  /** Offline practice: the answer saved on this device, and whether it was already checked. */
  initialAnswer?: string;
  initiallyChecked?: boolean;
  onAnswer?: (answer: string) => void;
}) {
  const t = useT('practice');
  const inputId = useId();
  const isMcq = question.format === 'mcq';
  const [choice, setChoice] = useState<string | null>(isMcq ? (initialAnswer ?? null) : null);
  const [typed, setTyped] = useState(isMcq ? '' : (initialAnswer ?? ''));
  const [checked, setChecked] = useState(initiallyChecked);
  const [correct, setCorrect] = useState(
    () =>
      initiallyChecked &&
      initialAnswer !== undefined &&
      (isMcq ? initialAnswer === question.answer : checkGridInAnswer(initialAnswer, question.accepted)),
  );
  const [showExplanation, setShowExplanation] = useState(correct);
  const saving = useAnswerSubmission(onResolved);
  const chosen = checked ? (isMcq ? (choice ?? undefined) : typed.trim() || undefined) : undefined;

  // keep the open panel in step with this card: checking unlocks the full explanation
  // biome-ignore lint/correctness/useExhaustiveDependencies: onSuu is a fresh closure on every render
  useEffect(() => {
    if (suuOpen) onSuu?.({ checked, chosen });
  }, [suuOpen, checked, chosen]);

  const issue = officialSolveIssue(question);
  if (issue)
    return (
      <article className="section-panel space-y-3 p-6">
        <h2 className="font-bold">{question.skill}</h2>
        <p role="status">{issue}</p>
      </article>
    );

  const canCheck = isMcq ? choice !== null : typed.trim() !== '';
  const answerText = isMcq ? question.answer : question.accepted.join(', ');

  function check(event?: FormEvent) {
    event?.preventDefault();
    if (!canCheck || saving.busy) return;
    const right = isMcq ? choice === question.answer : checkGridInAnswer(typed, question.accepted);
    setCorrect(right);
    setChecked(true);
    setShowExplanation(right);
    onAnswer?.(isMcq ? (choice ?? '') : typed.trim());
    void saving.submit({ qid: question.id, questionSource: 'official' }, isMcq ? choice! : typed);
  }

  function retry() {
    setCorrect(false);
    setChecked(false);
    setShowExplanation(false);
    setChoice(null);
    setTyped('');
  }

  return (
    <article
      className="section-panel bank-question official-question space-y-4"
      aria-labelledby={`${inputId}-title`}
      id={`official-question-${question.id}`}
      tabIndex={-1}
      onCopy={copyAsText}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm font-bold text-ink-3 tnum">#{index}</span>
        <h2 id={`${inputId}-title`} className="text-sm font-bold text-ink">
          {question.skill}
        </h2>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-bold',
            question.difficulty === 1 && 'bg-sage text-leaf-ink',
            question.difficulty === 2 && 'bg-amber-soft text-amber',
            question.difficulty === 3 && 'bg-danger-soft text-danger',
          )}
        >
          {t(
            question.difficulty === 1 ? 'bank.easy' : question.difficulty === 2 ? 'bank.medium' : 'bank.hard',
          )}
        </span>
        {!isMcq && (
          <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-bold text-teal">
            {t('official.gridIn')}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-3">{question.id}</span>
        <CopyQuestionButton question={question} />
      </div>

      <CbHtml
        html={question.promptHtml}
        scope={cbScope(question.id, 'q')}
        className="text-[17px] font-medium leading-relaxed text-ink"
      />

      <form onSubmit={check} className="space-y-3">
        {isMcq ? (
          <div
            role="radiogroup"
            aria-label={t('official.choicesLabel')}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {question.choices.map((c) => {
              const picked = choice === c.label;
              const isAnswer = (showExplanation || (checked && correct)) && c.label === question.answer;
              return (
                <button
                  key={c.label}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={saving.busy || (checked && correct)}
                  onClick={() => {
                    setChoice(c.label);
                    setChecked(false);
                    setShowExplanation(false);
                  }}
                  className={cn(
                    'flex items-center gap-3.5 rounded-2xl border p-3.5 text-left text-[15px] text-ink transition',
                    'border-line bg-paper-2 enabled:hover:border-leaf',
                    picked && !checked && 'border-leaf bg-leaf/10',
                    isAnswer && 'border-leaf bg-sage',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-xs font-bold text-ink-3',
                      (picked || isAnswer) && 'border-leaf text-leaf-2',
                    )}
                  >
                    {c.label}
                  </span>
                  <CbHtml html={c.html} scope={cbScope(question.id, c.label)} className="min-w-0 flex-1" />
                </button>
              );
            })}
          </div>
        ) : (
          <label htmlFor={inputId} className="block max-w-xs space-y-2">
            <span className="eyebrow text-ink-3">{t('official.yourAnswer')}</span>
            <input
              id={inputId}
              value={typed}
              disabled={saving.busy || (checked && correct)}
              onChange={(e) => {
                setTyped(e.target.value);
                setChecked(false);
                setShowExplanation(false);
              }}
              placeholder={t('official.answerPlaceholder')}
              inputMode="decimal"
              autoComplete="off"
              className="w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-ink placeholder:text-sm placeholder:text-ink-3"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {checked ? (
            <button
              type="button"
              onClick={retry}
              disabled={saving.busy}
              className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-ink hover:border-leaf"
            >
              {t('official.tryAgain')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canCheck || saving.busy}
              className="rounded-xl bg-leaf px-5 py-2 text-sm font-bold text-on-leaf transition enabled:hover:bg-leaf-2 disabled:opacity-50"
            >
              {t('official.check')}
            </button>
          )}
          {checked && !correct && (
            <button
              type="button"
              aria-expanded={showExplanation}
              onClick={() => setShowExplanation((v) => !v)}
              className="rounded-xl px-3 py-2 text-sm font-bold text-leaf-2 hover:bg-leaf/10"
            >
              {showExplanation ? 'Хариу нуух' : 'Хариу харах'}
            </button>
          )}
          {onSuu && (
            <SuuTutorButton open={suuOpen} onClick={() => onSuu(suuOpen ? null : { checked, chosen })} />
          )}
        </div>
      </form>

      {checked && (
        <p
          role="status"
          className={cn(
            'rounded-2xl px-4 py-3 text-sm font-bold',
            correct ? 'bg-sage text-leaf-ink' : 'bg-danger-soft text-danger',
          )}
        >
          {correct ? t('official.correct') : 'Буруу байна. Дахин оролдоорой.'}
        </p>
      )}

      <SaveStatus {...saving} />
      {checked && correct && (onNext || onComplete) && (
        <div className="space-y-3">
          {lastInTopic && <p className="font-bold text-leaf-2">Сэдвийн бодлогууд дууслаа!</p>}
          <button
            type="button"
            disabled={saving.busy}
            onClick={lastInTopic ? onComplete : onNext}
            className="rounded-xl bg-leaf px-5 py-3 font-bold text-on-leaf"
          >
            {lastInTopic ? 'Бодлогын жагсаалт руу буцах' : 'Дараагийн бодлого →'}
          </button>
        </div>
      )}
      {showExplanation && (
        <section className="space-y-2 rounded-2xl border border-line bg-paper-2 p-4">
          <h3 className="eyebrow text-ink-3">{t('official.explanation')}</h3>
          {!correct && (
            <p className="text-sm font-bold text-ink">{t('official.answerIs', { answer: answerText })}</p>
          )}
          {question.explanationHtml.trim() ? (
            <CbHtml
              html={question.explanationHtml}
              scope={cbScope(question.id, 'e')}
              className="text-[15px] leading-relaxed text-ink-2"
            />
          ) : (
            <p className="text-sm text-ink-3">Эх сурвалжид тайлбар оруулаагүй байна.</p>
          )}
        </section>
      )}
    </article>
  );
}
