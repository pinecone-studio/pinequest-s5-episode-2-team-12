'use client';

// «Төстэй бодлого»: after a question is answered, the student can try one more of the same kind.
// Made by the question templates (lib/similar.ts): new numbers, an answer computed by code, works offline.
// Practice only — it is not saved to the mistake notebook or progress.
import { useId, useMemo, useState } from 'react';
import { Rich } from '@/components/math';
import { correctAnswerText, isCorrect, isMcq } from '@/features/roadmap/lib/grade';
import { cn } from '@/lib/cn';
import type { Question } from '@/types';
import { similarQuestion, templatesFor } from '../lib/similar';

type Base = Pick<Question, 'id' | 'domain' | 'skill' | 'difficulty' | 'prompt'>;

const btn =
  'rounded-2xl border border-line bg-paper-2 px-4 py-2 text-sm font-bold text-ink transition hover:border-leaf disabled:opacity-50';

/** The button plus, once pressed, the generated question. Renders nothing when no template fits `base`. */
export function SimilarQuestion({ base, seedStart = Date.now() }: { base: Base; seedStart?: number }) {
  const [seed, setSeed] = useState<number | null>(null);
  const fits = useMemo(() => templatesFor(base).length > 0, [base]);
  const q = useMemo(() => (seed === null ? null : similarQuestion(base, seed)), [base, seed]);
  if (!fits) return null;

  const next = () => setSeed((s) => (s === null ? seedStart % 100_000 : s + 1));
  return (
    <div className="space-y-3">
      <button type="button" className={btn} onClick={next}>
        {q ? 'Өөр төстэй бодлого ↻' : 'Төстэй бодлого бодох'}
      </button>
      {q && <SimilarCard key={q.id} q={q} />}
    </div>
  );
}

function SimilarCard({ q }: { q: Question }) {
  const inputId = useId();
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const mcq = isMcq(q);
  const right = checked && isCorrect(q, answer);

  return (
    <section
      aria-label="Төстэй бодлого"
      className="space-y-3 rounded-2xl border border-line bg-paper p-4 text-ink"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Төстэй бодлого · {q.skill}</p>
      <div className="text-base">
        <Rich text={q.prompt} />
      </div>

      {mcq ? (
        <div role="radiogroup" aria-label="Хариултууд" className="grid gap-2">
          {q.choices?.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={answer === String(i)}
              onClick={() => {
                setAnswer(String(i));
                setChecked(false);
              }}
              className={cn(
                'rounded-xl border px-3 py-2 text-left text-sm',
                answer === String(i) ? 'border-leaf bg-sage' : 'border-line bg-paper-2',
              )}
            >
              <span className="mr-2 font-bold">{'ABCD'[i]}</span>
              <Rich text={c} />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-bold">
            Хариу
          </label>
          <input
            id={inputId}
            value={answer}
            inputMode="decimal"
            onChange={(e) => {
              setAnswer(e.target.value);
              setChecked(false);
            }}
            className="w-40 rounded-xl border border-line bg-paper-2 px-3 py-2"
          />
        </div>
      )}

      <button type="button" className={btn} disabled={answer.trim() === ''} onClick={() => setChecked(true)}>
        Шалгах
      </button>

      {checked && (
        <div
          role="status"
          className={cn(
            'space-y-1.5 rounded-xl p-3 text-sm',
            right ? 'bg-sage text-leaf-2' : 'bg-danger-soft text-danger',
          )}
        >
          <p className="font-bold">{right ? '✨ Зөв!' : 'Буруу байна.'}</p>
          {!right && (
            <p>
              Зөв хариу: <Rich text={correctAnswerText(q)} />
            </p>
          )}
          <div className="text-ink">
            <Rich text={q.explain} />
          </div>
        </div>
      )}
      {!checked && q.hint && (
        <details className="text-sm text-ink-3">
          <summary className="cursor-pointer font-bold">Hint</summary>
          <Rich text={q.hint} />
        </details>
      )}
    </section>
  );
}
