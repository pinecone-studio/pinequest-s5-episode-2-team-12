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
    <div className="flex flex-col gap-4" data-qid={q.id}>
      <div className="text-[17px] leading-relaxed text-ink">
        <Rich text={q.prompt} />
      </div>
      {q.mn && (
        <div>
          <button
            type="button"
            aria-pressed={mn}
            onClick={() => setMn((x) => !x)}
            className="min-h-11 rounded-xl px-2 text-[13px] font-bold text-leaf-2 underline-offset-4 hover:underline"
          >
            {mn ? t('stop.translateHide') : t('stop.translate')}
          </button>
          {mn && (
            <p lang="mn" className="mt-1 rounded-2xl bg-paper-2 px-4 py-3 text-[15px] text-ink-2">
              <Rich text={q.mn} />
            </p>
          )}
        </div>
      )}
      {q.figure?.startsWith('/') && (
        // biome-ignore lint/performance/noImgElement: static figures from /public, no optimisation needed
        <img src={q.figure} alt="" className="mx-auto max-h-64 max-w-full" />
      )}

      {mcq ? (
        <div role="radiogroup" aria-label={t('stop.choices')} className="grid gap-2.5">
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
                  'flex min-h-12 items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2.5 text-left text-[15px] transition-colors',
                  'border-line bg-paper hover:border-line-2 disabled:cursor-default',
                  chosen && !revealed && 'border-leaf bg-sage',
                  right && 'border-leaf bg-sage',
                  wrong && 'border-danger bg-danger-soft',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-line-2 text-[13px] font-bold text-ink-2',
                    (chosen || right) && 'border-leaf bg-leaf text-[var(--c-on-leaf)]',
                    wrong && 'border-danger bg-danger text-[var(--c-on-leaf)]',
                  )}
                >
                  {'ABCD'[i]}
                </span>
                <Rich text={c} />
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
              'h-12 w-full max-w-xs rounded-2xl border-[1.5px] border-line-2 bg-paper px-4 font-mono text-lg text-ink',
              'focus:border-leaf focus:outline-none disabled:opacity-80',
            )}
          />
        </div>
      )}
    </div>
  );
}
