'use client';
import { useEffect, useRef, useState } from 'react';
import { FLASHCARDS, type FlashCard, type FlashState } from '@/features/flashcards/lib/decks';
import { useT } from '@/lib/i18n-client';
import { currentOwner, installOfflineWorker, readCards, updateCards } from './storage';

type Snapshot = {
  states: Record<string, FlashState>;
  extra: FlashCard[];
  reviewed: string[];
  currentStop: number | null;
};

// After the first download, every online visit to /flashcards refreshes the saved copy — unless offline
// grades are still waiting to sync, since the server states on this page do not include them yet.
export function DownloadCards(snapshot: Snapshot) {
  const t = useT('flashcards');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState<string | null | undefined>();
  const latest = useRef(snapshot);
  latest.current = snapshot;

  useEffect(() => {
    if (!('indexedDB' in window) || !navigator.onLine) return;
    void (async () => {
      const saved = await readCards();
      if (!saved.saved || saved.reviews.length) return;
      setOwner(await currentOwner());
    })().catch(() => {});
  }, []);

  const { states, extra, reviewed, currentStop } = snapshot;
  useEffect(() => {
    if (owner === undefined) return;
    void updateCards((current) => ({ ...current, states, extra, reviewed, currentStop, owner })).catch(
      () => {},
    );
  }, [owner, states, extra, reviewed, currentStop]);

  async function download() {
    setBusy(true);
    setStatus(t('offline.downloading'));
    try {
      await installOfflineWorker();
      const who = await currentOwner();
      await updateCards((current) => ({
        ...current,
        ...latest.current,
        saved: true,
        owner: who,
        // grades still queued for another account stay queued; this copy belongs to the new one
        reviews: current.reviews,
      }));
      setOwner(who);
      setStatus(t('offline.downloaded', { n: FLASHCARDS.length + extra.length }));
    } catch {
      setStatus(t('offline.downloadError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 bg-paper p-3 text-sm">
      <button
        type="button"
        className="rounded-lg bg-leaf px-3 py-2 font-bold text-white disabled:opacity-60"
        disabled={busy}
        onClick={download}
      >
        {t('offline.download')}
      </button>
      <a href="/offline/flashcards" className="font-bold underline">
        {t('offline.open')}
      </a>
      <p role="status" className="text-xs text-ink-2">
        {status || t('offline.hint')}
      </p>
    </section>
  );
}
