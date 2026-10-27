'use client';
import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
// /mistakes: every wrong answer, grouped by topic, with an SM-2 review session (answer again → server
// grades → explanation → the note moves later or comes back). Demo mode builds the notebook from the
// roadmap history and mocks in localStorage.
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { QuestionView } from '@/features/roadmap/components/QuestionView';
import { TOPICS, topicById } from '@/features/roadmap/topics';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Question } from '@/types';
import { type CheckResult, checkMistake, mistakePreviews, type Preview } from '../actions';
import { localEntries } from '../lib/local-data';
import { buildNotebook, dueNotes, type Entry, type NoteState, summary } from '../lib/notebook';
import { SuuInsights } from './SuuInsights';

const KEY = 'suprep:mistakes:v1';
type Stored = Record<string, NoteState & { reviewedAt?: number }>;

function readLocal(): Stored {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stored;
  } catch {
    return {};
  }
}
function writeLocal(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked
  }
}

const asView = (q: Preview): Question => ({
  ...q,
  skill: '',
  difficulty: 2,
  answer: -1,
  explain: '',
  hint: '',
});

export function MistakesView({
  demo,
  server,
}: {
  demo: boolean;
  server: { entries: Entry[]; states: Stored };
}) {
  const t = useT('mistakes');
  const [entries, setEntries] = useState(server.entries);
  const [states, setStates] = useState<Stored>(server.states);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [topic, setTopic] = useState<number | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const [session, setSession] = useState<string[] | null>(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<Extract<CheckResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState(false);
  const topicFieldId = useId();

  useEffect(() => {
    if (!demo) return;
    setEntries(localEntries());
    setStates(readLocal());
  }, [demo]);

  const notes = useMemo(() => buildNotebook(entries, states), [entries, states]);
  useEffect(() => {
    const missing = notes.map((n) => n.qid).filter((id) => !previews[id]);
    if (!missing.length) return;
    mistakePreviews(missing).then((ps) =>
      setPreviews((p) => ({ ...p, ...Object.fromEntries(ps.map((x) => [x.id, x])) })),
    );
  }, [notes, previews]);

  const topicOf = (qid: string) => previews[qid]?.topicId;
  const shown = notes.filter((n) => !topic || topicOf(n.qid) === topic);
  const stats = summary(shown, now);
  const due = dueNotes(shown, now);

  const current = session?.[0];
  const q = current ? previews[current] : undefined;
  const note = notes.find((n) => n.qid === current);

  const check = async () => {
    if (!current || !note || busy) return;
    setBusy(true);
    const r = await checkMistake({ qid: current, answer: value, state: demo ? note.state : undefined });
    setBusy(false);
    if (!r.ok) return;
    setResult(r);
    if (r.state) {
      const next = { ...states, [current]: { ...r.state, reviewedAt: Date.now() } };
      setStates(next);
      if (demo) writeLocal(next);
    }
  };
  const next = () => {
    setSession((s) => (s ? s.slice(1) : s));
    setValue('');
    setResult(null);
    setNow(Date.now());
  };

  if (session && current && q && note) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">
            {topicById(q.topicId ?? 0)?.title} · {t(`source.${note.source}`)}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSession(null)}>
            {t('stop')}
          </Button>
        </div>
        <section className="soft-card grid min-w-0 gap-4 overflow-x-auto p-5">
          <QuestionView key={q.id} q={asView(q)} value={value} onChange={setValue} revealed={false} />
          {note.chosen && !result && (
            <p className="text-[13px] text-ink-3">
              {t('yourWas', { a: q.choices?.[Number(note.chosen)] ?? note.chosen })}
            </p>
          )}
          {result ? (
            <div
              className={cn(
                'grid gap-2 rounded-2xl px-4 py-3',
                result.correct ? 'bg-sage' : 'bg-danger-soft',
              )}
              role="status"
            >
              <p className={cn('font-bold', result.correct ? 'text-leaf-2' : 'text-danger')}>
                {result.correct ? t('right') : <Rich text={t('wrong', { a: result.correctText })} />}
              </p>
              <p className="text-[14px] text-ink-2">
                <span className="font-semibold text-ink">{t('explain')}: </span>
                <Rich text={result.explain} />
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={next}>{t('next')}</Button>
                <Link
                  href={routes.tutor({ kind: 'mistake', id: q.id, chosen: value })}
                  className="inline-flex h-11 items-center px-3 text-[14px] font-bold text-leaf-2 underline"
                >
                  {t('ask')}
                </Link>
              </div>
            </div>
          ) : (
            <Button onClick={check} disabled={!value || busy}>
              {t('check')}
            </Button>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="workspace-page max-w-5xl">
      <PageHeader title={t('pages.mistakes.title')} description={t('lead')} icon="mistakes" />
      <dl className="grid grid-cols-3 gap-2">
        {(['due', 'total', 'resolved'] as const).map((k) => (
          <div key={k} className="stat-card">
            <dt className="text-[12px] text-ink-3">{t(`stats.${k}`)}</dt>
            <dd className="font-display text-2xl font-bold text-ink tnum">{stats[k]}</dd>
          </div>
        ))}
      </dl>
      <SuuInsights demo={demo} count={notes.length} />
      <div className="filter-panel flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor={topicFieldId}>
          {t('filter')}
        </label>
        <select
          id={topicFieldId}
          value={topic ?? ''}
          onChange={(e) => setTopic(e.target.value ? Number(e.target.value) : undefined)}
          className="h-11 max-w-[260px] rounded-2xl border border-line bg-paper px-3 text-[14px]"
        >
          <option value="">{t('allTopics')}</option>
          {TOPICS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id}. {x.title}
            </option>
          ))}
        </select>
        <Button onClick={() => setSession(due.map((n) => n.qid))} disabled={!due.length}>
          {t('review')} ({due.length})
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="soft-card border-dashed p-10 text-center text-[14px] leading-relaxed text-ink-2">
          {t('empty')}
        </p>
      ) : (
        <section aria-label={t('list')}>
          {due.length === 0 && <p className="mb-3 text-[14px] font-semibold text-leaf-2">{t('allDone')}</p>}
          <ul className="grid gap-2">
            {shown.map((n) => {
              const p = previews[n.qid];
              const isDueNow = !n.state.resolved && n.state.due <= now;
              return (
                <li key={n.qid} className="soft-card grid gap-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                    <span>{topicById(p?.topicId ?? 0)?.title ?? '—'}</span>
                    <span>· {t(`source.${n.source}`)}</span>
                    <span className="ml-auto">
                      {n.state.resolved ? (
                        <Pill tone="leaf">{t('learned')}</Pill>
                      ) : isDueNow ? (
                        <Pill tone="amber">{t('due')}</Pill>
                      ) : (
                        <Pill>{t('later')}</Pill>
                      )}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[14px] text-ink">{p ? <Rich text={p.prompt} /> : '…'}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
