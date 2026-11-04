import type { FlashCard, FlashState } from '@/features/flashcards/lib/decks';
import type { OfficialQuestion } from '@/features/practice/lib/official';
import type { Grade } from '@/lib/sm2';

export type Attempt = {
  id: string;
  questionId: string;
  answer: string;
  at: string;
  owner: string | null;
  synced: boolean;
};
export type SavedQuestion = { question: OfficialQuestion; answer?: string; checked?: boolean };
export type OfflineData = { questions: SavedQuestion[]; attempts: Attempt[]; owner: string | null };
const empty = (): OfflineData => ({ questions: [], attempts: [], owner: null });

/** One «Шинэ үг» grade made offline; replayed in order on the server by /api/offline/flashcards. */
export type CardReview = { id: string; key: string; grade: Grade; at: number; owner: string | null };
/** Snapshot of /flashcards for /offline/flashcards. `saved` is false until the student downloads it. */
export type OfflineCards = {
  saved: boolean;
  owner: string | null;
  states: Record<string, FlashState>;
  extra: FlashCard[];
  reviewed: string[];
  currentStop: number | null;
  reviews: CardReview[];
};
const emptyCards = (): OfflineCards => ({
  saved: false,
  owner: null,
  states: {},
  extra: [],
  reviewed: [],
  currentStop: null,
  reviews: [],
});

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('suprep-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('practice');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Both features share the one 'practice' store: questions under 'data', word cards under 'flashcards'.
async function read<T>(key: string, fallback: () => T): Promise<T> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('practice').objectStore('practice').get(key);
      request.onsuccess = () => resolve(request.result ?? fallback());
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Read + update in one transaction so tabs cannot overwrite each other's attempts.
async function update<T>(key: string, fallback: () => T, change: (data: T) => T) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('practice', 'readwrite');
      const store = tx.objectStore('practice');
      const request = store.get(key);
      request.onsuccess = () => store.put(change(request.result ?? fallback()), key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const readOffline = () => read('data', empty);
export const updateOffline = (change: (data: OfflineData) => OfflineData) => update('data', empty, change);
export const readCards = () => read('flashcards', emptyCards);
export const updateCards = (change: (data: OfflineCards) => OfflineCards) =>
  update('flashcards', emptyCards, change);

/** Installs /offline-sw.js so the offline pages open without a connection. */
export async function installOfflineWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('unsupported');
  await navigator.serviceWorker.register('/offline-sw.js', { scope: '/' });
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 45000)),
  ]);
}

export async function currentOwner() {
  const session = await fetch('/api/offline/session', { cache: 'no-store' });
  if (!session.ok) throw new Error('session');
  return ((await session.json()) as { owner: string | null }).owner;
}

export async function syncOffline() {
  const [data, cards] = await Promise.all([readOffline(), readCards()]);
  const cardsPending = cards.reviews.some((r) => r.owner);
  if (!data.attempts.some((a) => !a.synced && a.owner) && !cardsPending) return;
  const owner = await currentOwner();
  if (cardsPending) await syncCards(owner);
  const pending = data.attempts.filter((a) => !a.synced && a.owner && a.owner === owner);
  if (!pending.length) return;
  const response = await fetch('/api/offline/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempts: pending.slice(0, 100) }),
  });
  if (!response.ok) throw new Error('sync');
  const { ids } = (await response.json()) as { ids: string[] };
  await updateOffline((current) => ({
    ...current,
    attempts: current.attempts.map((a) => (ids.includes(a.id) ? { ...a, synced: true } : a)),
  }));
}

// Synced reviews are dropped: the server's card_states is the history.
async function syncCards(owner: string | null) {
  const pending = (await readCards()).reviews.filter((r) => r.owner && r.owner === owner);
  if (!pending.length) return;
  const response = await fetch('/api/offline/flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviews: pending.slice(0, 200) }),
  });
  if (!response.ok) throw new Error('sync');
  const { ids } = (await response.json()) as { ids: string[] };
  await updateCards((current) => ({
    ...current,
    reviews: current.reviews.filter((r) => !ids.includes(r.id)),
  }));
}
