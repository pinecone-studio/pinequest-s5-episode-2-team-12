'use client';

import { type FormEvent, useId, useState } from 'react';
import { checkGridInAnswer } from '@/lib/check-answer';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { cbScope, type OfficialQuestion } from '../lib/official';

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

export function OfficialQuestionCard({ question, index }: { question: OfficialQuestion; index: number }) {
  const t = useT('practice');
  const inputId = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const isMcq = question.format === 'mcq';
  const correct = isMcq ? choice === question.answer : checkGridInAnswer(typed, question.accepted);
  const canCheck = isMcq ? choice !== null : typed.trim() !== '';
  const answerText = isMcq ? question.answer : question.accepted.join(', ');

  function check(event?: FormEvent) {
    event?.preventDefault();
    if (!canCheck) return;
    setChecked(true);
    setShowExplanation(true);
  }

  function retry() {
    setChecked(false);
    setShowExplanation(false);
    setChoice(null);
    setTyped('');
  }

  return (
    <article
      className="section-panel bank-question official-question space-y-4"
      aria-labelledby={`${inputId}-title`}
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
              const isAnswer = checked && c.label === question.answer;
              const isWrongPick = checked && picked && !isAnswer;
              return (
                <button
                  key={c.label}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={checked}
                  onClick={() => setChoice(c.label)}
                  className={cn(
                    'flex items-center gap-3.5 rounded-2xl border p-3.5 text-left text-[15px] text-ink transition',
                    'border-line bg-paper-2 enabled:hover:border-leaf',
                    picked && !checked && 'border-leaf bg-leaf/10',
                    isAnswer && 'border-leaf bg-sage',
                    isWrongPick && 'border-danger bg-danger-soft',
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
              disabled={checked}
              onChange={(e) => setTyped(e.target.value)}
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
              className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-ink hover:border-leaf"
            >
              {t('official.tryAgain')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canCheck}
              className="rounded-xl bg-leaf px-5 py-2 text-sm font-bold text-on-leaf transition enabled:hover:bg-leaf-2 disabled:opacity-50"
            >
              {t('official.check')}
            </button>
          )}
          <button
            type="button"
            aria-expanded={showExplanation}
            onClick={() => setShowExplanation((v) => !v)}
            className="rounded-xl px-3 py-2 text-sm font-bold text-leaf-2 hover:bg-leaf/10"
          >
            {t(showExplanation ? 'official.hideExplanation' : 'official.showExplanation')}
          </button>
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
          {correct ? t('official.correct') : t('official.incorrect', { answer: answerText })}
        </p>
      )}

      {showExplanation && (
        <section className="space-y-2 rounded-2xl border border-line bg-paper-2 p-4">
          <h3 className="eyebrow text-ink-3">{t('official.explanation')}</h3>
          {!checked && (
            <p className="text-sm font-bold text-ink">{t('official.answerIs', { answer: answerText })}</p>
          )}
          <CbHtml
            html={question.explanationHtml}
            scope={cbScope(question.id, 'e')}
            className="text-[15px] leading-relaxed text-ink-2"
          />
        </section>
      )}
    </article>
  );
}
