'use client';
// One SAT-style question: stem (+ Mongolian translation toggle), four choices or a grid-in box.
// After `revealed` it marks the correct choice and the student's wrong one.
import { useId, useState } from 'react';
import { Rich } from '@/components/math';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { Question } from '@/types';
import { isMcq } from '../lib/grade';

export function QuestionView({
  q,
  value,
  onChange,
  revealed = false,
  placeholder,
  onSubmit,
}: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  revealed?: boolean;
  placeholder?: string;
  /** Enter in the grid-in box. */
  onSubmit?: () => void;
}) {
  const t = useT('roadmap');
  const [mn, setMn] = useState(false);
  const inputId = useId();
  const mcq = isMcq(q);

  return (
    <div className="flex flex-col gap-3" data-qid={q.id}>
      {/* Асуултын текстийг илүү тод, том болгосон */}
      <div className="text-lg sm:text-xl font-bold leading-snug text-ink">
        <Rich text={q.prompt} />
      </div>

      {q.mn && (
        <div>
          <button
            type="button"
            aria-pressed={mn}
            onClick={() => setMn((x) => !x)}
            className="min-h-9 rounded-xl px-2 text-[12px] font-bold text-leaf-2 underline-offset-4 hover:underline"
          >
            {mn ? t('stop.translateHide') : t('stop.translate')}
          </button>
          {mn && (
            <p lang="mn" className="mt-1 rounded-2xl bg-paper-2 px-3 py-2 text-[14px] text-ink-2">
              <Rich text={q.mn} />
            </p>
          )}
        </div>
      )}

      {q.figure?.startsWith('/') && (
        // biome-ignore lint/performance/noImgElement: static figures from /public, no optimisation needed
        <img src={q.figure} alt="" className="mx-auto max-h-48 max-w-full object-contain" />
      )}

      {mcq ? (
        <div role="radiogroup" aria-label={t('stop.choices')} className="grid gap-1.5 sm:gap-2">
          {(q.choices ?? []).map((c, i) => {
            const chosen = value === String(i);
            const right = revealed && q.answer === i;
            const wrong = revealed && chosen && q.answer !== i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={revealed}
                onClick={() => onChange(String(i))}
                className={cn(
                  'flex min-h-10 sm:min-h-11 items-center gap-2.5 rounded-xl border-[1.5px] px-3.5 py-2 text-left text-xs sm:text-sm transition-colors',
                  'border-line bg-paper hover:border-line-2 disabled:cursor-default',
                  chosen && !revealed && 'border-leaf bg-sage',
                  right && 'border-leaf bg-sage',
                  wrong && 'border-danger bg-danger-soft',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 sm:size-7 shrink-0 place-items-center rounded-lg border-[1.5px] border-line-2 text-xs font-bold text-ink-2',
                    (chosen || right) && 'border-leaf bg-leaf text-[var(--c-on-leaf)]',
                    wrong && 'border-danger bg-danger text-[var(--c-on-leaf)]',
                  )}
                >
                  {'ABCD'[i]}
                </span>
                <span className="leading-tight flex-1">
                  <Rich text={c} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <label htmlFor={inputId} className="sr-only">
            {placeholder ?? t('stop.placeholder')}
          </label>
          <input
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, 7))}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
            disabled={revealed}
            inputMode="text"
            autoComplete="off"
            placeholder={placeholder ?? t('stop.placeholder')}
            className={cn(
              'h-11 w-full max-w-xs rounded-xl border-[1.5px] border-line-2 bg-paper px-3 font-mono text-base text-ink',
              'focus:border-leaf focus:outline-none disabled:opacity-80',
            )}
          />
        </div>
      )}
    </div>
  );
}
