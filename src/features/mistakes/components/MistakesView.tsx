'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { CbHtml, OfficialQuestionCard } from '@/features/practice/components/OfficialQuestionCard';
import { PracticePlayer } from '@/features/practice/components/PracticePlayer';
import { cbScope } from '@/features/practice/lib/official';
import { TOPICS, topicById } from '@/features/roadmap/topics';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { readDemoNotebook, type StoredStates } from '../lib/demo-notebook';
import { noteKey } from '../lib/identity';
import { localEntries } from '../lib/local-data';
import { buildNotebook, dueNotes, type Entry, summary } from '../lib/notebook';
import type { RetryQuestion } from '../lib/submission';
import { loadRetryQuestions } from '../submission-actions';
import { SuuInsights } from './SuuInsights';

export function MistakesView({
  demo,
  server,
  loadError = false,
}: {
  demo: boolean;
  server: { entries: Entry[]; states: StoredStates };
  loadError?: boolean;
}) {
  const t = useT('mistakes');
  const router = useRouter();
  const [entries, setEntries] = useState(server.entries);
  const [states, setStates] = useState(server.states);
  const [questions, setQuestions] = useState<Record<string, RetryQuestion>>({});
  const [topic, setTopic] = useState<number>();
  const [session, setSession] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(loadError ? 'Алдааны дэвтрийг ачаалж чадсангүй.' : '');
  const [reload, setReload] = useState(0);
  const topicId = useId();

  useEffect(() => {
    setEntries(server.entries);
    setStates(server.states);
    setError(loadError ? 'Алдааны дэвтрийг ачаалж чадсангүй.' : '');
  }, [server, loadError]);
  useEffect(() => {
    if (!demo) return;
    const read = () => {
      setEntries(localEntries());
      setStates(readDemoNotebook().states);
    };
    read();
    window.addEventListener('suu:mistakes-changed', read);
    return () => window.removeEventListener('suu:mistakes-changed', read);
  }, [demo]);

  const notes = useMemo(() => buildNotebook(entries, states), [entries, states]);
  const active = notes.filter((note) => !note.state.resolved);
  // Depends on identities, not loaded previews, so unavailable items cannot cause a fetch loop.
  const refs = JSON.stringify({
    items: active.map(({ qid, questionSource }) => ({ qid, questionSource })),
    reload,
  });
  useEffect(() => {
    let cancelled = false;
    const input = JSON.parse(refs).items;
    if (!input.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      Array.from({ length: Math.ceil(input.length / 500) }, (_, index) =>
        loadRetryQuestions(input.slice(index * 500, (index + 1) * 500)),
      ),
    )
      .then((batches) => {
        const items = batches.flat();
        if (cancelled) return;
        setQuestions((previous) => ({
          ...previous,
          ...Object.fromEntries(
            items.map((item) => [
              noteKey({ qid: item.question.id, questionSource: item.questionSource }),
              item,
            ]),
          ),
        }));
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Асуултуудыг ачаалж чадсангүй. Дахин оролдоно уу.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refs]);

  const topicOf = (key: string) => {
    const item = questions[key];
    return item?.questionSource === 'practice' ? item.question.topicId : undefined;
  };
  const shown = active.filter((note) => !topic || topicOf(noteKey(note)) === topic);
  const stats = summary(notes, Date.now());
  const due = dueNotes(shown, Date.now());
  const current = session[0];
  const item = current ? questions[current] : undefined;
  const resolved = () => {
    // The solver calls this only after server grading AND successful persistence.
    setStates((previous) => {
      const note = notes.find((candidate) => noteKey(candidate) === current);
      return note
        ? { ...previous, [current]: { ...note.state, resolved: true, reviewedAt: Date.now() } }
        : previous;
    });
  };
  if (item && current)
    return (
      <div className="workspace-page max-w-5xl">
        <PageHeader title={t('pages.mistakes.title')} icon="mistakes" />
        <Button variant="ghost" onClick={() => setSession([])}>
          ← Алдааны дэвтэр
        </Button>
        <Link
          href={routes.tutor({ kind: 'mistake', id: item.question.id })}
          className="text-sm font-bold text-leaf-2 underline"
        >
          Суугаас асуух
        </Link>
        {item.questionSource === 'official' ? (
          <OfficialQuestionCard
            key={current}
            question={item.question}
            index={1}
            onResolved={resolved}
            onNext={() => setSession((previous) => previous.slice(1))}
            onComplete={() => setSession([])}
            lastInTopic={session.length === 1}
          />
        ) : (
          <PracticePlayer
            key={current}
            questions={[item.question]}
            onResolved={resolved}
            onNext={() => setSession((previous) => previous.slice(1))}
            onComplete={() => setSession([])}
            lastInTopic={session.length === 1}
          />
        )}
      </div>
    );

  return (
    <div className="workspace-page max-w-5xl">
      <PageHeader title={t('pages.mistakes.title')} description={t('lead')} icon="mistakes" />
      <dl className="grid grid-cols-3 gap-2">
        {(['due', 'total', 'resolved'] as const).map((key) => (
          <div key={key} className="stat-card">
            <dt className="text-xs text-ink-3">{t(`stats.${key}`)}</dt>
            <dd className="font-display text-2xl font-bold">{stats[key]}</dd>
          </div>
        ))}
      </dl>
      <SuuInsights demo={demo} count={active.length} />
      {error && (
        <div role="alert" className="space-y-2 text-danger">
          <p>{error}</p>
          <Button
            onClick={() => {
              setReload((value) => value + 1);
              router.refresh();
            }}
          >
            Дахин ачаалах
          </Button>
        </div>
      )}
      {loading && <p role="status">Асуултуудыг ачаалж байна…</p>}
      <div className="filter-panel flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor={topicId}>
          {t('filter')}
        </label>
        <select
          id={topicId}
          value={topic ?? ''}
          onChange={(event) => setTopic(event.target.value ? Number(event.target.value) : undefined)}
          className="h-11 max-w-[260px] rounded-2xl border border-line bg-paper px-3"
        >
          <option value="">{t('allTopics')}</option>
          {TOPICS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.id}. {entry.title}
            </option>
          ))}
        </select>
        <Button
          disabled={!due.length || loading}
          onClick={() => setSession(due.filter((note) => questions[noteKey(note)]).map(noteKey))}
        >
          {t('review')} ({due.length})
        </Button>
      </div>
      {!shown.length && !loading && !error && (
        <p className="soft-card border-dashed p-10 text-center text-ink-2">{t('empty')}</p>
      )}
      <section aria-label={t('list')} className="grid gap-3">
        {shown.map((note) => {
          const key = noteKey(note);
          const question = questions[key];
          return (
            <article key={key} className="soft-card space-y-3 p-5">
              <p className="text-xs text-ink-3">
                {question?.questionSource === 'official'
                  ? 'College Board'
                  : (topicById(topicOf(key) ?? 0)?.title ?? t(`source.${note.source}`))}{' '}
                · {note.qid}
              </p>
              <div className="text-sm leading-relaxed text-ink">
                {question?.questionSource === 'official' ? (
                  <CbHtml html={question.question.promptHtml} scope={cbScope(note.qid, 'q')} />
                ) : question ? (
                  <Rich text={question.question.prompt} />
                ) : (
                  <p className="text-sm text-ink-3">
                    {loading ? 'Ачаалж байна…' : 'Энэ асуултын өгөгдөл одоогоор олдсонгүй.'}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={!question || loading} onClick={() => setSession([key])}>
                  Дахин бодох
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
