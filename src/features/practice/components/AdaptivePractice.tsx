'use client';

// «Ухаалаг дасгал»: one question at a time, each picked by the student's Elo rating per domain (lib/elo.ts).
// Only the first answer to a question moves the rating (a retry after seeing it is wrong doesn't count).
// Ratings live in this browser; answers are still saved to the mistake notebook by PracticePlayer.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '@/types';
import {
  DOMAIN_NAMES,
  DOMAINS,
  loadRatings,
  pickNext,
  type Ratings,
  ratingOf,
  START_RATING,
  satEstimate,
  saveRatings,
  update,
} from '../lib/elo';
import { PracticePlayer } from './PracticePlayer';

export function AdaptivePractice({ pool, rng = Math.random }: { pool: Question[]; rng?: () => number }) {
  const [ratings, setRatings] = useState<Ratings>({});
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [current, setCurrent] = useState<Question | null>(null);
  const graded = useRef(new Set<string>());

  // ratings come from localStorage, so they are read after mount (the server render has none)
  // biome-ignore lint/correctness/useExhaustiveDependencies: pick the first question once, with the loaded ratings
  useEffect(() => {
    const loaded = loadRatings();
    setRatings(loaded);
    const first = pickNext(pool, loaded, new Set(), rng);
    setCurrent(first);
    if (first) setSeen(new Set([first.id]));
  }, [pool]);

  const estimate = useMemo(() => satEstimate(ratings), [ratings]);

  function onGraded(q: Question, correct: boolean) {
    if (graded.current.has(q.id)) return;
    graded.current.add(q.id);
    setRatings((r) => {
      const next = update(r, q, correct);
      saveRatings(next);
      return next;
    });
  }

  function next() {
    const q = pickNext(pool, ratings, seen, rng);
    setCurrent(q);
    if (q) setSeen((s) => new Set(s).add(q.id));
  }

  return (
    <div className="space-y-4">
      <section aria-label="Түвшин" className="card flex flex-wrap items-center gap-3 p-4">
        <p className="mr-auto text-sm font-bold text-ink">
          Ухаалаг дасгал — бодлого бүр таны түвшинд тааруулж сонгогдоно.
          {estimate !== null && <span className="ml-2 text-leaf-2">SAT Math ≈ {estimate}</span>}
        </p>
        <ul className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => {
            const r = ratingOf(ratings, d);
            const delta = r.r - START_RATING;
            return (
              <li key={d} className="rounded-xl border border-line bg-paper-2 px-3 py-1.5 text-xs">
                <span className="font-bold">{DOMAIN_NAMES[d]}</span>{' '}
                <output aria-label={`${DOMAIN_NAMES[d]} үнэлгээ`}>{r.r}</output>
                {r.n > 0 && (
                  <span className={delta >= 0 ? 'text-leaf-2' : 'text-danger'}>
                    {' '}
                    ({delta >= 0 ? '+' : ''}
                    {delta})
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {current ? (
        <PracticePlayer
          key={current.id}
          questions={[current]}
          lastInTopic={false}
          onNext={next}
          onGraded={onGraded}
        />
      ) : (
        <p className="card p-6 text-center font-bold">
          {pool.length ? 'Бүх бодлогыг бодлоо! Маргааш дахин ирээрэй.' : 'Бодлого олдсонгүй.'}
        </p>
      )}
    </div>
  );
}
