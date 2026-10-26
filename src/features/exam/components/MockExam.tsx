'use client';
// «Бүтэн тест»: intro → module 1 (35 min) → break (≤10 min) → module 2 (adaptive, 35 min) → results.
// The server grades every module (mock-actions.ts); the browser only ever sees questions without answers.
// Answers, flags and time per question survive a reload (lib/local-mocks.ts); when the clock runs out the
// module is sent automatically.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { QuestionView } from '@/features/roadmap/components/QuestionView';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Question } from '@/types';
import { getRemainingSeconds } from '../lib/exam-machine';
import {
  type InProgress,
  loadInProgress,
  loadLocalMocks,
  saveInProgress,
  saveLocalMock,
} from '../lib/local-mocks';
import type { PublicQuestion } from '../lib/mock';
import { beginModule2, type ExamStep, startMock, submitModule, viewMock } from '../mock-actions';

/** QuestionView wants a full Question; during the exam it only gets the public fields. */
const asView = (q: PublicQuestion): Question => ({
  ...q,
  skill: '',
  difficulty: 2,
  answer: -1,
  explain: '',
  hint: '',
});

function useCountdown(endsAt: string | undefined, onZero: () => void) {
  const [left, setLeft] = useState(() => getRemainingSeconds(endsAt ?? null));
  const fired = useRef(false);
  const cb = useRef(onZero);
  cb.current = onZero;
  useEffect(() => {
    fired.current = false;
    if (!endsAt) return;
    const tick = () => {
      const s = getRemainingSeconds(endsAt);
      setLeft(s);
      if (s <= 0 && !fired.current) {
        fired.current = true;
        cb.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return left;
}

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function MockExam({
  demo,
  attemptId,
}: {
  demo: boolean /** Open this signed-in attempt (group mock). */;
  attemptId?: string;
}) {
  const t = useT('exam');
  const router = useRouter();
  const [step, setStep] = useState<ExamStep | null>(null);
  const [progress, setProgress] = useState<InProgress | null>(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resumable, setResumable] = useState<InProgress | null>(null);
  const entered = useRef(Date.now());

  useEffect(() => setResumable(loadInProgress()), []);

  const persist = useCallback((p: InProgress | null) => {
    setProgress(p);
    saveInProgress(p);
  }, []);

  const apply = useCallback(
    (next: ExamStep, keep?: InProgress | null) => {
      setStep(next);
      setI(0);
      setConfirming(false);
      entered.current = Date.now();
      if (next.late) setNotice(t('late'));
      if (next.phase === 'done') {
        if (next.attempt) saveLocalMock(next.attempt);
        persist(null);
        router.push(routes.mockResult(next.id));
        return;
      }
      const base = keep ?? { id: next.id, answers: {}, times: {}, marked: [] };
      persist({ ...base, id: next.id, attempt: next.attempt ?? base.attempt });
    },
    [persist, router, t],
  );

  // a group mock arrives with its attempt already created on the server
  useEffect(() => {
    if (!attemptId) return;
    viewMock({ id: attemptId }).then((r) => {
      if (r.ok) apply(r.step);
      else setError(t('error'));
    });
  }, [attemptId, apply, t]);

  const seen = useCallback(
    () => (demo ? loadLocalMocks().flatMap((a) => a.modules.flatMap((m) => m.ids)) : undefined),
    [demo],
  );

  const start = async () => {
    setBusy(true);
    setError('');
    const r = await startMock({ seen: seen() });
    setBusy(false);
    if (!r.ok) return setError(t('error'));
    apply(r.step);
  };

  const resume = async () => {
    const p = resumable;
    if (!p) return;
    setBusy(true);
    const r = await viewMock({ id: p.id, attempt: p.attempt });
    setBusy(false);
    if (!r.ok) {
      saveInProgress(null);
      setResumable(null);
      return setError(t('error'));
    }
    apply(r.step, p);
  };

  const record = useCallback(() => {
    const q = step?.module?.questions[i];
    if (!q || !progress) return progress;
    const spent = Date.now() - entered.current;
    entered.current = Date.now();
    return { ...progress, times: { ...progress.times, [q.id]: (progress.times[q.id] ?? 0) + spent } };
  }, [step, i, progress]);

  const go = (to: number) => {
    const p = record();
    if (p) persist(p);
    setI(to);
    setConfirming(false);
  };

  const send = useCallback(async () => {
    if (!step?.module || busy) return;
    const p = record() ?? progress;
    setBusy(true);
    const answers = step.module.questions.map((q) => ({
      qid: q.id,
      answer: p?.answers[q.id] ?? '',
      timeMs: p?.times[q.id] ?? 0,
    }));
    const r = await submitModule({
      id: step.id,
      no: step.module.no,
      answers,
      attempt: p?.attempt,
      seen: seen(),
    });
    setBusy(false);
    if (!r.ok) return setError(t('error'));
    apply(r.step, p ? { ...p, answers: {}, times: {}, marked: [] } : null);
  }, [step, busy, record, progress, apply, t, seen]);

  const left = useCountdown(step?.module?.endsAt, () => {
    setNotice(t('module.timeUp'));
    void send();
  });

  const startModule2 = useCallback(async () => {
    if (!step || busy) return;
    setBusy(true);
    const r = await beginModule2({ id: step.id, attempt: progress?.attempt });
    setBusy(false);
    if (!r.ok) return setError(t('error'));
    apply(r.step, progress);
  }, [step, busy, progress, apply, t]);
  const breakLeft = useCountdown(
    step?.phase === 'break' ? step.breakEndsAt : undefined,
    () => void startModule2(),
  );

  /* ——— intro ——— */
  if (!step) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6 py-6">
        <header className="grid gap-2">
          <p className="eyebrow">{t('intro.eyebrow')}</p>
          <h1 className="font-display text-3xl font-bold text-ink">{t('intro.title')}</h1>
          <p className="text-[15px] leading-relaxed text-ink-2">{t('intro.lead')}</p>
        </header>
        <ul className="soft-card grid gap-2 p-5 text-[14.5px] text-ink-2">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
              {t(`intro.rule${n}`)}
            </li>
          ))}
        </ul>
        <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          {t('intro.note')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={start} disabled={busy}>
            {t('intro.start')}
          </Button>
          {resumable && (
            <Button size="lg" variant="secondary" onClick={resume} disabled={busy}>
              {t('intro.resume')}
            </Button>
          )}
          <Link
            href={routes.profile}
            className="inline-flex h-[52px] items-center px-3 font-bold text-ink-2 underline underline-offset-4"
          >
            {t('intro.history')}
          </Link>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  /* ——— break ——— */
  if (step.phase === 'break') {
    return (
      <div className="mx-auto grid w-full max-w-xl justify-items-center gap-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">{t('break.title')}</h1>
        <p className="font-display text-5xl font-bold text-ink tnum" aria-live="off">
          {mmss(breakLeft)}
        </p>
        <p className="text-ink-2">{t('break.lead')}</p>
        {notice && <p className="text-sm font-semibold text-amber">{notice}</p>}
        <Button size="lg" onClick={startModule2} disabled={busy}>
          {t('break.continue')}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  /* ——— finished: the router is on its way to the result page ——— */
  if (step.phase === 'done' || !step.module) {
    return (
      <div className="mx-auto grid w-full max-w-xl justify-items-center gap-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">{t('done.title')}</h1>
        <Link
          href={routes.mockResult(step.id)}
          className="font-bold text-leaf-2 underline underline-offset-4"
        >
          {t('done.view')}
        </Link>
      </div>
    );
  }

  /* ——— module ——— */
  const mod = step.module;
  const qs = mod.questions;
  const q = qs[i];
  const answers = progress?.answers ?? {};
  const marked = new Set(progress?.marked ?? []);
  const answered = qs.filter((x) => answers[x.id]).length;
  const last = mod.no === 2;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">{t('module.title', { n: mod.no })}</h1>
          <p className="text-[13px] text-ink-3">{t('module.answered', { n: answered, total: qs.length })}</p>
        </div>
        <div
          role="timer"
          className={cn(
            'rounded-2xl px-4 py-2 font-display text-2xl font-bold tnum',
            left < 300 ? 'bg-danger-soft text-danger' : 'bg-paper-2 text-ink',
          )}
          aria-label={`${t('module.timeLeft')}: ${mmss(left)}`}
        >
          {mmss(left)}
        </div>
      </header>

      {notice && (
        <p className="rounded-2xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">{notice}</p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <section
          aria-label={t('module.question', { n: i + 1, total: qs.length })}
          className="soft-card grid min-w-0 content-start gap-4 overflow-x-auto p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">{t('module.question', { n: i + 1, total: qs.length })}</p>
            <button
              type="button"
              aria-pressed={marked.has(q.id)}
              onClick={() =>
                progress &&
                persist({
                  ...progress,
                  marked: marked.has(q.id)
                    ? progress.marked.filter((x) => x !== q.id)
                    : [...progress.marked, q.id],
                })
              }
              className={cn(
                'h-9 rounded-xl border px-3 text-[13px] font-bold',
                marked.has(q.id) ? 'border-amber bg-amber-soft text-amber' : 'border-line text-ink-2',
              )}
            >
              🚩 {marked.has(q.id) ? t('module.marked') : t('module.mark')}
            </button>
          </div>
          <QuestionView
            key={q.id}
            q={asView(q)}
            value={answers[q.id] ?? ''}
            onChange={(v) =>
              progress && persist({ ...progress, answers: { ...progress.answers, [q.id]: v } })
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => go(i - 1)} disabled={i === 0}>
              {t('module.prev')}
            </Button>
            {i < qs.length - 1 ? (
              <Button onClick={() => go(i + 1)}>{t('module.next')}</Button>
            ) : (
              <Button onClick={() => setConfirming(true)}>
                {last ? t('module.finishTest') : t('module.finish')}
              </Button>
            )}
          </div>
        </section>

        <nav aria-label={t('module.nav')} className="grid content-start gap-3">
          <ol className="grid grid-cols-6 gap-1.5 md:grid-cols-5">
            {qs.map((x, n) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => go(n)}
                  aria-current={n === i ? 'step' : undefined}
                  aria-label={`${t('module.question', { n: n + 1, total: qs.length })}${answers[x.id] ? ' ✓' : ''}${marked.has(x.id) ? ' 🚩' : ''}`}
                  className={cn(
                    'relative grid h-10 w-full place-items-center rounded-xl border text-[13px] font-bold tnum',
                    n === i ? 'border-leaf ring-2 ring-leaf' : 'border-line',
                    answers[x.id] ? 'bg-sage text-leaf-2' : 'bg-paper text-ink-2',
                  )}
                >
                  {n + 1}
                  {marked.has(x.id) && (
                    <span aria-hidden="true" className="absolute -top-1.5 -right-1 text-[11px]">
                      🚩
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {last ? t('module.finishTest') : t('module.finish')}
          </Button>
        </nav>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label={t('module.confirm')}
          className="soft-card grid gap-3 border-2 border-amber p-5"
        >
          <p className="font-bold text-ink">{t('module.confirm')}</p>
          {answered < qs.length && (
            <p className="text-sm text-amber">{t('module.unanswered', { n: qs.length - answered })}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={send} disabled={busy}>
              {busy ? t('module.saving') : t('module.yes')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('module.no')}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
