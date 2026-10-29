'use client';
import { useEffect, useState } from 'react';
import { OfficialQuestionCard } from '@/features/practice/components/OfficialQuestionCard';
import { useT } from '@/lib/i18n-client';
import { type OfflineData, readOffline, syncOffline, updateOffline } from './storage';

export function OfflinePractice() {
  const t = useT('practice');
  const [data, setData] = useState<OfflineData | null>(null);
  const [status, setStatus] = useState('');
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [difficulty, setDifficulty] = useState('');
  useEffect(() => {
    let active = true;
    let syncing = false;
    async function refresh() {
      setOnline(navigator.onLine);
      try {
        if (navigator.onLine && !syncing) {
          syncing = true;
          try {
            await syncOffline();
          } catch {
            if (active) setStatus(t('offline.syncError'));
          } finally {
            syncing = false;
          }
        }
        const saved = await readOffline();
        if (active) setData(saved);
      } catch {
        if (active) setStatus(t('offline.storageError'));
      }
    }
    void refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, [t]);
  async function save(questionId: string, answer: string) {
    try {
      await updateOffline((current) => ({
        ...current,
        questions: current.questions.map((item) =>
          item.question.id === questionId ? { ...item, answer, checked: true } : item,
        ),
        attempts: [
          ...current.attempts,
          {
            id: crypto.randomUUID(),
            questionId,
            answer,
            at: new Date().toISOString(),
            owner: current.owner,
            synced: false,
          },
        ],
      }));
      setStatus(t('offline.saved'));
      if (navigator.onLine) {
        try {
          await syncOffline();
        } catch {
          setStatus(t('offline.syncError'));
        }
      }
      setData(await readOffline());
    } catch {
      setStatus(t('offline.storageError'));
    }
  }
  const questions = data?.questions.filter(
    ({ question: q }) =>
      (!domain || q.domain === domain) &&
      (!difficulty || String(q.difficulty) === difficulty) &&
      (!search || `${q.text} ${q.skill}`.toLowerCase().includes(search.toLowerCase())),
  );
  const pending = data?.attempts.filter((a) => a.owner && !a.synced).length ?? 0;
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-ink">
      <nav className="flex gap-4">
        <a href="/bank" className="underline">
          {t('offline.back')}
        </a>
        <a href="/offline/flashcards" className="underline">
          {t('offline.words')}
        </a>
      </nav>
      <h1 className="font-display text-3xl">{t('offline.title')}</h1>
      <p>
        {online ? t('offline.online') : t('offline.offline')} ·{' '}
        {t('offline.count', { n: data?.questions.length ?? 0 })}
      </p>
      <p>{t('offline.tutorHint')}</p>
      <p role="status">{status || (pending ? t('offline.pending', { n: pending }) : t('offline.ready'))}</p>
      <div className="flex flex-wrap gap-3">
        <input
          className="rounded-xl border border-line bg-paper p-3"
          aria-label={t('bank.search')}
          placeholder={t('bank.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border border-line bg-paper p-3"
          aria-label={t('bank.domain')}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          {['', 'alg', 'adv', 'psda', 'geo'].map((d) => (
            <option key={d} value={d}>
              {t(`bank.domains.${d || 'all'}`)}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-line bg-paper p-3"
          aria-label={t('bank.difficulty')}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">{t('bank.allDifficulties')}</option>
          {[1, 2, 3].map((d) => (
            <option key={d} value={d}>
              {t(`bank.${['', 'easy', 'medium', 'hard'][d]}`)}
            </option>
          ))}
        </select>
      </div>
      {data && !data.questions.length && <p>{t('offline.empty')}</p>}
      {questions?.map((item, index) => (
        <OfficialQuestionCard
          key={item.question.id}
          question={item.question}
          index={index + 1}
          initialAnswer={item.answer}
          initiallyChecked={item.checked}
          onAnswer={(answer) => void save(item.question.id, answer)}
        />
      ))}
      {Boolean(data?.questions.length) && (
        <button
          type="button"
          className="underline"
          onClick={async () => {
            if (!window.confirm(t('offline.confirmDelete'))) return;
            try {
              await updateOffline((current) => ({ ...current, questions: [] }));
              setData(await readOffline());
            } catch {
              setStatus(t('offline.storageError'));
            }
          }}
        >
          {t('offline.delete')}
        </button>
      )}
    </main>
  );
}
