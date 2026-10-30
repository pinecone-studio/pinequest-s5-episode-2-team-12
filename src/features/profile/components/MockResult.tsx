'use client';
// /profile/mock/[id]: one finished full test — estimated score, domains, and every question with the
// student's answer, the correct one, the explanation and the time spent. Demo mode reads the attempt from
// localStorage and asks the server for the questions.
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Rich } from '@/components/math';
import { Pill } from '@/components/ui/Pill';
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import type { MockAttempt } from '@/features/exam/lib/mock';
import { reviewQuestions } from '@/features/exam/mock-actions';
import { correctAnswerText, isMcq } from '@/features/roadmap/lib/grade';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Question } from '@/types';
import { DOMAIN_AXES } from '../lib/radar';

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Finished attempts: the server's list when signed in, localStorage in demo mode. */
export function useAttempts(demo: boolean, server: MockAttempt[]) {
  const [list, setList] = useState<MockAttempt[] | null>(demo ? null : server);
  useEffect(() => {
    if (demo) setList(loadLocalMocks());
  }, [demo]);
  return list;
}

function yourAnswer(q: Question, answer: string, blank: string) {
  if (!answer) return blank;
  if (isMcq(q)) {
    const i = Number(answer);
    return `${'ABCD'[i] ?? '?'}) ${q.choices?.[i] ?? ''}`;
  }
  return answer;
}

export function MockResult({
  id,
  demo,
  attempts: serverAttempts,
  questions: serverQuestions,
}: {
  id: string;
  demo: boolean;
  attempts: MockAttempt[];
  questions: Question[];
}) {
  const t = useT('profile');
  const te = useT('exam');
  const attempts = useAttempts(demo, serverAttempts);
  const attempt = attempts?.find((a) => a.id === id) ?? null;
  const [questions, setQuestions] = useState<Question[]>(serverQuestions);
  const [withId, setWithId] = useState('');
  const uid = useId();

  useEffect(() => {
    if (!demo || !attempt) return;
    reviewQuestions({ id, ids: attempt.modules.flatMap((m) => m.ids) }).then(setQuestions);
  }, [demo, attempt, id]);

  if (!attempts) return <p className="text-ink-3">{t('result.loading')}</p>;
  if (!attempt?.finishedAt)
    return (
      <div className="grid gap-3">
        <p className="text-ink-2">{t('result.notFound')}</p>
        <Link href={routes.profile} className="font-bold text-leaf-2 underline">
          {t('result.back')}
        </Link>
      </div>
    );

  const byId = new Map(questions.map((q) => [q.id, q]));
  const earlier = attempts
    .filter((a) => a.id !== id && Date.parse(a.finishedAt!) < Date.parse(attempt.finishedAt!))
    .sort((a, b) => Date.parse(a.finishedAt!) - Date.parse(b.finishedAt!));
  const previous = earlier.find((a) => a.id === withId) ?? earlier[0];
  const scoreDelta = (attempt.score ?? 0) - (previous?.score ?? 0);
  let n = 0;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <Link href={routes.profile} className="text-[13px] font-bold text-ink-2 hover:text-ink">
        ← {t('result.back')}
      </Link>
      <header className="soft-card grid gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {attempt.formId?.match(/^pt(\d+)$/) && (
              <p className="eyebrow">{t('result.practiceTest', { n: Number(attempt.formId.slice(2)) })}</p>
            )}
            <h1 className="font-display text-2xl font-bold text-ink">{t('result.title')}</h1>
            <p className="text-[13px] text-ink-3">{t('result.disclaimer')}</p>
          </div>
          <p className="text-right">
            <span className="block text-[12px] text-ink-3">{t('result.score')}</span>
            <span className="font-display text-[56px] font-bold leading-none text-ink tnum">
              {attempt.score}
            </span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[13px]">
          {[
            [t('result.date'), fmtDate(attempt.finishedAt)],
            [t('result.time'), t('mocks.time', { m: Math.round(attempt.timeUsedSec / 60) })],
            [t('result.correct'), `${attempt.raw.correct}/${attempt.raw.total}`],
            [t('result.route'), attempt.route ? t(`mocks.route.${attempt.route}`) : '—'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-paper-2 px-3 py-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="font-bold text-ink tnum">{v}</dd>
            </div>
          ))}
        </dl>
        {attempt.flagged && (
          <p className="rounded-2xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">
            {t('result.flagged')}
          </p>
        )}
      </header>

      <section className="soft-card grid gap-3 p-5" aria-labelledby={`${uid}-domains-title`}>
        <h2 id={`${uid}-domains-title`} className="font-bold text-ink">
          {t('result.domains')}
        </h2>
        <ul className="grid gap-2.5">
          {DOMAIN_AXES.map((d) => {
            const s = attempt.domains[d];
            const pct = s.total ? s.correct / s.total : 0;
            return (
              <li key={d} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="text-[13.5px] text-ink-2">{te(`domainsFull.${d}`)}</span>
                <span className="text-[13px] font-bold text-ink tnum">
                  {s.correct}/{s.total}
                </span>
                <span className="col-span-2 h-2 rounded-full bg-line" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${pct * 100}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="soft-card grid gap-3 p-5" aria-labelledby={`${uid}-compare-title`}>
        <h2 id={`${uid}-compare-title`} className="font-bold text-ink">
          {t('result.compare')}
        </h2>
        {earlier.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">{t('result.noPrevious')}</p>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-ink-2">
              {fmtDate(previous.finishedAt!)} · {previous.score} → {attempt.score}
              <span className={cn('ml-3 font-bold', scoreDelta >= 0 ? 'text-leaf-2' : 'text-danger')}>
                {scoreDelta > 0 ? '+' : ''}
                {scoreDelta}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`${uid}-compare-with`}>
                {t('result.compareWith')}
              </label>
              <select
                id={`${uid}-compare-with`}
                value={previous?.id ?? ''}
                onChange={(e) => setWithId(e.target.value)}
                className="h-11 rounded-2xl border border-line bg-paper-2 px-3 text-[14px]"
              >
                {earlier.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fmtDate(a.finishedAt!)} · {a.score}
                  </option>
                ))}
              </select>
              <Link
                href={routes.mockCompare(id, previous.id)}
                className="inline-flex h-11 items-center rounded-2xl bg-leaf-deep px-5 text-[14px] font-bold text-[var(--c-on-leaf)]"
              >
                {t('result.compare')}
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby={`${uid}-questions-title`}>
        <h2 id={`${uid}-questions-title`} className="font-bold text-ink">
          {t('result.questions')}
        </h2>
        {attempt.modules.map((m) => (
          <div key={m.no} className="grid gap-2">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
              {t('result.module', { n: m.no })}
            </h3>
            <ol className="grid gap-2">
              {m.answers.map((a) => {
                n++;
                const q = byId.get(a.qid);
                return (
                  <li
                    key={a.qid}
                    className={cn(
                      'soft-card grid gap-2 border-l-4 p-4',
                      a.correct ? 'border-l-[var(--c-leaf)]' : 'border-l-[var(--c-danger)]',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink tnum">{n}.</span>
                      <Pill tone={a.correct ? 'leaf' : 'danger'}>{a.correct ? '✓' : '✗'}</Pill>
                      {q && <span className="text-[12px] text-ink-3">{te(`domains.${q.domain}`)}</span>}
                      <span className="ml-auto text-[12px] text-ink-3 tnum">
                        {t('result.spent')} {mmss(a.timeMs)}
                      </span>
                    </div>
                    {q ? (
                      <>
                        <div className="text-[14.5px] leading-relaxed text-ink">
                          <Rich text={q.prompt} />
                        </div>
                        <dl className="grid gap-1 text-[13.5px] sm:grid-cols-2">
                          <div>
                            <dt className="text-ink-3">{t('result.yours')}</dt>
                            <dd className={cn('font-semibold', a.correct ? 'text-leaf-2' : 'text-danger')}>
                              <Rich text={yourAnswer(q, a.answer, t('result.blank'))} />
                            </dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">{t('result.right')}</dt>
                            <dd className="font-semibold text-ink">
                              <Rich text={correctAnswerText(q)} />
                            </dd>
                          </div>
                        </dl>
                        <details className="rounded-xl bg-paper-2 px-3 py-2">
                          <summary className="cursor-pointer text-[13px] font-bold text-leaf-2">
                            {t('result.explain')}
                          </summary>
                          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                            <Rich text={q.explain} />
                          </p>
                          <Link
                            href={routes.tutor({
                              kind: 'question',
                              id: q.id,
                              chosen: a.answer ? yourAnswer(q, a.answer, '') : undefined,
                            })}
                            className="mt-2 inline-block text-[13px] font-bold text-leaf-2 underline underline-offset-4"
                          >
                            {t('result.ask')}
                          </Link>
                        </details>
                      </>
                    ) : (
                      <p className="skeleton h-10 rounded-xl bg-paper-2" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
