'use client';
// /daily: today's 5 problems, one at a time, timed by the server. After each answer the server reveals
// whether it was right; at the end the score (points + speed bonus) and a link to the leaderboard.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { QuestionView } from '@/features/roadmap/components/QuestionView';
import { loadLocalWallet, saveLocalWallet } from '@/features/shop/lib/local-wallet';
import { useWallet } from '@/features/shop/lib/use-wallet';
import { consume } from '@/features/shop/lib/wallet';
import type { ServerWallet } from '@/features/shop/queries';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Question } from '@/types';
import { answerDaily, type DailyStep, dailyHint, startDaily } from '../actions';
import type { DailyAttempt } from '../lib/daily';

const KEY = 'suprep:daily:v1';
const read = (): DailyAttempt | undefined => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
};
const DAYS = 'suprep:daily:days';
const write = (a?: DailyAttempt) => {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    // finished days (for demo gems: localStorage keeps only today's attempt)
    if (a?.finishedAt && !a.flagged) {
      const days = new Set<string>(JSON.parse(localStorage.getItem(DAYS) ?? '[]'));
      days.add(a.day);
      localStorage.setItem(DAYS, JSON.stringify([...days].slice(-400)));
    }
  } catch {
    // storage blocked
  }
};

export function DailyView({ demo, wallet = null }: { demo: boolean; wallet?: ServerWallet | null }) {
  const t = useT('daily');
  const [step, setStep] = useState<DailyStep | null>(null);
  const [started, setStarted] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<DailyStep['last'] | null>(null);
  const [pending, setPending] = useState<DailyStep | null>(null);
  const [hint, setHint] = useState('');
  const w = useWallet(demo, wallet);
  const tokens = w.owned['hints-3'] ?? 0;

  const askHint = async () => {
    if (demo) {
      const spent = consume(loadLocalWallet(), 'hints-3');
      if (!spent) return;
      saveLocalWallet(spent);
    }
    const r = await dailyHint({ attempt: demo ? read() : undefined });
    if (r.ok) setHint(r.hint);
  };

  useEffect(() => {
    // peek without starting the clock: a finished or begun local run shows its state
    if (demo) {
      const a = read();
      if (a?.finishedAt || (a && a.answers.length > 0))
        startDaily({ attempt: a }).then((s) => {
          setStep(s);
          setStarted(true);
        });
    }
  }, [demo]);

  const begin = async () => {
    setBusy(true);
    try {
      const s = await startDaily({ attempt: demo ? read() : undefined });
      if (s.attempt) write(s.attempt);
      setStep(s);
      setStarted(true);
    } catch {
      setError(t('error'));
    }
    setBusy(false);
  };

  const submit = async () => {
    if (!step || busy) return;
    setBusy(true);
    const s = await answerDaily({ answer: value, attempt: demo ? read() : undefined });
    setBusy(false);
    if (!s) return setError(t('error'));
    if (s.attempt) write(s.attempt);
    setFeedback(s.last ?? null);
    setPending(s);
  };

  const next = () => {
    setStep(pending);
    setPending(null);
    setFeedback(null);
    setValue('');
    setHint('');
  };

  if (!started || !step) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-5">
        <header className="grid gap-1">
          <h1 className="font-display text-3xl font-bold text-ink">{t('title')}</h1>
          <p className="text-[14px] text-ink-2">{t('lead')}</p>
        </header>
        <p className="soft-card p-5 text-[14px] text-ink-2">{t('rules')}</p>
        <Button size="lg" onClick={begin} disabled={busy}>
          {t('start')}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (step.finished && !feedback) {
    return (
      <div className="mx-auto grid w-full max-w-xl justify-items-center gap-4 py-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">{t('done')}</h1>
        <p>
          <span className="block text-[12px] text-ink-3">{t('score')}</span>
          <span className="font-display text-[56px] font-bold leading-none text-ink tnum">{step.score}</span>
        </p>
        <p className="text-ink-2">{t('correct', { n: step.correct, total: step.total })}</p>
        {step.flagged && (
          <p className="rounded-2xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">
            {t('flagged')}
          </p>
        )}
        <p className="text-[13px] text-ink-3">{t('tomorrow')}</p>
        <Link
          href={`${routes.leaderboard}?period=daily`}
          className="font-bold text-leaf-2 underline underline-offset-4"
        >
          {t('board')}
        </Link>
      </div>
    );
  }

  const q = step.question;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-ink">{t('title')}</h1>
        <p className="eyebrow">{t('question', { n: step.index + 1, total: step.total })}</p>
      </div>
      <ol className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: step.total }, (_, i) => (
          <li
            key={i}
            className={cn(
              'h-2 flex-1 rounded-full',
              i < step.index ? 'bg-leaf' : i === step.index ? 'bg-lime' : 'bg-line',
            )}
          />
        ))}
      </ol>
      {q && (
        <section className="soft-card grid min-w-0 gap-4 overflow-x-auto p-5">
          <QuestionView
            key={q.id}
            q={{ ...q, skill: '', difficulty: 2, answer: -1, explain: '', hint: '' } as Question}
            value={value}
            onChange={setValue}
            revealed={false}
          />
          {!feedback &&
            (hint ? (
              <p className="rounded-2xl bg-amber-soft px-4 py-2 text-[14px] text-ink-2" role="note">
                💡 <Rich text={hint} />
              </p>
            ) : (
              tokens > 0 && (
                <button
                  type="button"
                  onClick={askHint}
                  className="justify-self-start text-[13px] font-bold text-amber underline underline-offset-4"
                >
                  {t('hint', { n: tokens })}
                </button>
              )
            ))}
          {feedback ? (
            <div
              className={cn(
                'grid gap-2 rounded-2xl px-4 py-3',
                feedback.correct ? 'bg-sage' : 'bg-danger-soft',
              )}
              role="status"
            >
              <p className={cn('font-bold', feedback.correct ? 'text-leaf-2' : 'text-danger')}>
                {feedback.correct ? t('right') : <Rich text={t('wrong', { a: feedback.correctText })} />}
              </p>
              <p className="text-[14px] text-ink-2">
                <span className="font-semibold text-ink">{t('explain')}: </span>
                <Rich text={feedback.explain} />
              </p>
              <Button onClick={next}>{t('next')}</Button>
            </div>
          ) : (
            <Button onClick={submit} disabled={!value || busy}>
              {t('submit')}
            </Button>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
