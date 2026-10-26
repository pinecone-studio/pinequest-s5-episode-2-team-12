'use client';
// /duel/[id]: rules → one question at a time (server-graded, no right/wrong until both finish, the clock
// runs on the server) → waiting → results with both scores, the problems with answers, and reactions.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { QuestionView } from '@/features/roadmap/components/QuestionView';
import { correctAnswerText } from '@/features/roadmap/lib/grade';
import { TOPICS } from '@/features/roadmap/topics';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { Question } from '@/types';
import { answerDuel, type DuelStep, duelReview, reactDuel, startDuelRun } from '../actions';
import { botById } from '../lib/bots';
import { type Duel, type DuelOutcome, duelOutcome, type Run } from '../lib/duel';
import { REACTION_EMOJI, REACTIONS, type Reaction } from '../lib/friends';
import { type LocalDuel, loadSocial, saveSocial } from '../lib/local-social';
import type { PublicUser } from '../queries';

export type DuelServer = {
  duel: Duel;
  mine: Run | null;
  theirs: Run | null;
  theirsFinished: boolean;
  opponent: PublicUser;
  outcome: DuelOutcome;
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function DuelView({ id, demo, server }: { id: string; demo: boolean; server: DuelServer | null }) {
  const t = useT('social');
  const [local, setLocal] = useState<LocalDuel | null>(null);
  const [state, setState] = useState<DuelServer | null>(server);
  const [step, setStep] = useState<DuelStep | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [review, setReview] = useState<Question[]>([]);
  const [sent, setSent] = useState<Reaction | null>(null);

  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  useEffect(() => {
    if (!demo) return;
    const d = loadSocial().duels.find((x) => x.duel.id === id) ?? null;
    setLocal(d);
    if (d) {
      const b = botById(d.duel.opponent);
      setState({
        duel: d.duel,
        mine: d.mine,
        theirs: d.mine?.finishedAt ? d.theirs : null,
        theirsFinished: true,
        opponent: { id: d.duel.opponent, name: b?.name ?? '—', avatarId: b?.avatarId, level: b?.level ?? 1 },
        outcome: duelOutcome(d.duel, d.mine, d.theirs, Date.now()),
      });
    }
  }, [demo, id]);

  const saveMine = useCallback(
    (run: Run) => {
      if (!demo) return;
      const s = loadSocial();
      const duels = s.duels.map((d) => (d.duel.id === id ? { ...d, mine: run } : d));
      saveSocial({ ...s, duels });
      const d = duels.find((x) => x.duel.id === id) ?? null;
      setLocal(d);
      setState((st) =>
        st && d
          ? {
              ...st,
              mine: run,
              theirs: run.finishedAt ? d.theirs : null,
              outcome: duelOutcome(d.duel, run, d.theirs, Date.now()),
            }
          : st,
      );
    },
    [demo, id],
  );

  const outcome = state?.outcome ?? null;
  const revealed = Boolean(outcome?.reveal);

  useEffect(() => {
    if (!revealed || !state || review.length) return;
    duelReview({ duelId: id, duel: demo ? state.duel : undefined }).then((qs) => setReview(qs as Question[]));
  }, [revealed, state, id, demo, review.length]);

  if (!state)
    return (
      <div className="grid gap-3">
        <p className="text-ink-2">{t('duels.expired')}</p>
        <Link href="/friends" className="font-bold text-leaf-2 underline">
          ←
        </Link>
      </div>
    );

  const { duel, opponent } = state;
  const expired = now > Date.parse(duel.expiresAt);
  const topic = duel.topicId ? TOPICS.find((x) => x.id === duel.topicId)?.title : t('duels.mixed');

  const begin = async () => {
    setBusy(true);
    const r = await startDuelRun({
      duelId: id,
      duel: demo ? duel : undefined,
      run: demo ? (state.mine ?? undefined) : undefined,
    });
    setBusy(false);
    if (!r.ok) return toast(r.reason);
    setStep(r.step);
    if (r.step.run) saveMine(r.step.run);
  };

  const submit = async () => {
    if (!step) return;
    setBusy(true);
    const r = await answerDuel({
      duelId: id,
      answer: value,
      duel: demo ? duel : undefined,
      run: demo ? (local?.mine ?? step.run) : undefined,
    });
    setBusy(false);
    if (!r.ok) return toast(r.reason);
    setValue('');
    setStep(r.step);
    if (r.step.run) saveMine(r.step.run);
    if (r.step.finished && !demo) window.location.reload();
  };

  /* ——— playing ——— */
  if (step && !step.finished && step.question) {
    const q = step.question;
    const left = Date.parse(step.deadline) - now;
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold text-ink">
            {t('duels.vs', { a: t('duels.you'), b: opponent.name })}
          </h1>
          <div
            role="timer"
            aria-label={`${t('duels.timeLeft')}: ${mmss(left)}`}
            className={cn(
              'rounded-2xl px-3 py-1.5 font-display text-xl font-bold tnum',
              left < 60_000 ? 'bg-danger-soft text-danger' : 'bg-paper-2 text-ink',
            )}
          >
            {mmss(left)}
          </div>
        </div>
        <p className="eyebrow">{t('duels.question', { n: step.index + 1, total: step.total })}</p>
        <section className="soft-card grid min-w-0 gap-4 overflow-x-auto p-5">
          <QuestionView
            key={q.id}
            q={{ ...q, skill: '', difficulty: 2, answer: -1, explain: '', hint: '' } as Question}
            value={value}
            onChange={setValue}
          />
          <Button onClick={submit} disabled={!value || busy}>
            {t('duels.submit')}
          </Button>
        </section>
      </div>
    );
  }

  const mine = state.mine;
  const theirs = revealed ? state.theirs : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <header className="soft-card grid gap-3 p-5">
        <div className="flex items-center gap-3">
          <Avatar name={opponent.name} avatarId={opponent.avatarId} size={48} />
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">
              {t('duels.vs', { a: t('duels.you'), b: opponent.name })}
            </h1>
            <p className="text-[13px] text-ink-3">
              {topic} · {duel.size}
            </p>
          </div>
        </div>
        {!mine?.finishedAt && !expired && (
          <>
            <p className="text-[14px] text-ink-2">
              {t('duels.rules', { n: duel.size, m: Math.round(duel.timeLimitMs / 60_000) })}
            </p>
            <Button size="lg" onClick={begin} disabled={busy}>
              {mine ? t('duels.play') : t('duels.start')}
            </Button>
          </>
        )}
        {mine?.finishedAt && !revealed && (
          <p className="text-[14px] font-semibold text-ink-2">
            {t('duels.waitingOther', { name: opponent.name })}
          </p>
        )}
        {expired && !mine?.finishedAt && !revealed && (
          <p className="text-[14px] text-ink-3">{t('duels.expired')}</p>
        )}
      </header>

      {revealed && outcome && (
        <section className="soft-card grid gap-4 p-5" aria-label={t('duels.result')}>
          <p className="text-center font-display text-3xl font-bold text-ink">
            {outcome.winner === 'draw'
              ? t('duels.draw')
              : outcome.winner === mine?.userId
                ? t('duels.youWon')
                : outcome.winner
                  ? t('duels.youLost')
                  : t('duels.status.expired')}
            {outcome.forfeit && (
              <span className="block text-[13px] font-semibold text-ink-3">{t('duels.forfeit')}</span>
            )}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-center">
            {[
              [t('duels.you'), mine],
              [opponent.name, theirs],
            ].map(([who, r]) => (
              <div key={who as string} className="rounded-2xl bg-paper-2 px-3 py-3">
                <dt className="text-[12px] text-ink-3">{who as string}</dt>
                <dd className="font-display text-2xl font-bold text-ink tnum">
                  {r ? t('duels.correct', { n: (r as Run).correct }) : '—'}
                </dd>
                <dd className="text-[12px] text-ink-3 tnum">
                  {r ? t('duels.time', { s: Math.round((r as Run).timeMs / 1000) }) : ''}
                </dd>
                {(r as Run | null)?.flagged && (
                  <dd>
                    <Pill tone="amber">{t('duels.flagged')}</Pill>
                  </dd>
                )}
              </div>
            ))}
          </dl>
          <div className="grid gap-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">{t('duels.react')}</p>
            <div className="flex flex-wrap gap-2">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={sent === r}
                  onClick={async () => {
                    await reactDuel({ duelId: id, code: r });
                    setSent(r);
                    toast(t('duels.reacted'));
                  }}
                  className={cn(
                    'h-10 rounded-2xl border px-3 text-[13.5px] font-bold',
                    sent === r ? 'border-leaf bg-sage text-leaf-2' : 'border-line text-ink-2',
                  )}
                >
                  {REACTION_EMOJI[r]} {t(`duels.reactions.${r}`)}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {revealed && review.length > 0 && (
        <section className="grid gap-2" aria-label={t('duels.review')}>
          <h2 className="font-bold text-ink">{t('duels.review')}</h2>
          {review.map((q, i) => {
            const me = mine?.answers[i];
            const them = theirs?.answers[i];
            return (
              <div key={q.id} className="soft-card grid gap-2 p-4">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="font-bold text-ink">{i + 1}.</span>
                  <Pill tone={me?.correct ? 'leaf' : 'danger'}>
                    {t('duels.you')} {me?.correct ? '✓' : '✗'}
                  </Pill>
                  <Pill tone={them?.correct ? 'leaf' : 'danger'}>
                    {opponent.name} {them?.correct ? '✓' : '✗'}
                  </Pill>
                </div>
                <p className="text-[14px] text-ink">
                  <Rich text={q.prompt} />
                </p>
                <p className="text-[13.5px] font-semibold text-leaf-2">
                  <Rich text={correctAnswerText(q)} />
                </p>
                <p className="text-[13px] text-ink-2">
                  <Rich text={q.explain} />
                </p>
              </div>
            );
          })}
        </section>
      )}
      <Link href="/friends" className="text-[13px] font-bold text-ink-2 hover:text-ink">
        ← {t('friends.title')}
      </Link>
    </div>
  );
}
