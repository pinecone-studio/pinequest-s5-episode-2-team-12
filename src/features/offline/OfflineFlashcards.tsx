'use client';
import { useCallback, useEffect, useState } from 'react';
import { FlashcardsView } from '@/features/flashcards/components/FlashcardsView';
import type { FlashState } from '@/features/flashcards/lib/decks';
import { useT } from '@/lib/i18n-client';
import type { Grade } from '@/lib/sm2';
import { type OfflineCards, readCards, syncOffline, updateCards } from './storage';

export function OfflineFlashcards() {
  const t = useT('flashcards');
  const [data, setData] = useState<OfflineCards | null>(null);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    async function refresh() {
      setOnline(navigator.onLine);
      try {
        if (navigator.onLine) await syncOffline().catch(() => {});
        const saved = await readCards();
        // keep the view mounted once loaded; only the pending count changes after a sync
        if (active) setData((current) => (current ? { ...current, reviews: saved.reviews } : saved));
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

  const grade = useCallback(
    (key: string, g: Grade, at: number, next: FlashState) => {
      void (async () => {
        try {
          await updateCards((current) => ({
            ...current,
            states: { ...current.states, [key]: next },
            reviews: current.owner
              ? [...current.reviews, { id: crypto.randomUUID(), key, grade: g, at, owner: current.owner }]
              : current.reviews,
          }));
          if (navigator.onLine) await syncOffline().catch(() => {});
          const saved = await readCards();
          setData((current) => current && { ...current, reviews: saved.reviews });
        } catch {
          setStatus(t('offline.storageError'));
        }
      })();
    },
    [t],
  );

  const pending = data?.reviews.filter((r) => r.owner).length ?? 0;
  return (
    <main className="text-ink">
      <div className="mx-auto max-w-3xl space-y-2 px-4 pt-6 text-sm">
        <nav className="flex gap-4">
          <a href="/flashcards" className="underline">
            {t('offline.back')}
          </a>
          <a href="/offline" className="underline">
            {t('offline.practice')}
          </a>
        </nav>
        <h1 className="font-display text-2xl">{t('offline.title')}</h1>
        <p>{online ? t('offline.online') : t('offline.offline')}</p>
        <p role="status">{status || (pending ? t('offline.pending', { n: pending }) : t('offline.ready'))}</p>
      </div>
      {data && !data.saved && <p className="mx-auto max-w-3xl px-4 py-6">{t('offline.empty')}</p>}
      {data?.saved && (
        <FlashcardsView
          demo={data.owner === null}
          serverStates={data.states}
          currentStop={data.currentStop}
          reviewed={data.reviewed}
          extra={data.extra}
          onGrade={grade}
        />
      )}
    </main>
  );
}
