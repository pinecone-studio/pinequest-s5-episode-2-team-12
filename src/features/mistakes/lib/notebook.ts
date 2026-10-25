// The mistake notebook: one entry per question answered wrong anywhere, reviewed with SM-2 until it sticks.
// Pure (notebook.test.ts); used by the signed-in path (rows from `mistakes`) and demo mode (localStorage).
import { isDue, newState, type ReviewState, review } from '@/lib/sm2';

export type MistakeSource = 'stop' | 'placement' | 'testout' | 'mock' | 'daily' | 'duel' | 'practice';
export type Entry = { qid: string; chosen: string; source: MistakeSource; at: number };
export type NoteState = ReviewState & { resolved: boolean };
export type Note = Entry & { state: NoteState };

/** An entry counts as learned once its interval reaches this many days. */
export const RESOLVED_AT_DAYS = 21;

/** Latest miss per question wins; a miss newer than the last review puts the question back to «due». */
export function buildNotebook(
  entries: readonly Entry[],
  states: Readonly<Record<string, NoteState & { reviewedAt?: number }>>,
): Note[] {
  const latest = new Map<string, Entry>();
  for (const e of entries) {
    const cur = latest.get(e.qid);
    if (!cur || e.at > cur.at) latest.set(e.qid, e);
  }
  return [...latest.values()].map((e) => {
    const s = states[e.qid];
    const fresh = !s || (s.reviewedAt !== undefined && e.at > s.reviewedAt);
    return { ...e, state: fresh ? { ...newState(e.at), resolved: false } : s };
  });
}

export function dueNotes(notes: readonly Note[], now: number): Note[] {
  return notes
    .filter((n) => !n.state.resolved && isDue(n.state, now))
    .sort((a, b) => a.state.due - b.state.due || b.at - a.at);
}

/** After answering a notebook question again: right → «good», wrong → «again». */
export function afterReview(s: NoteState, correct: boolean, now: number): NoteState {
  const next = review(s, correct ? 'good' : 'again', now);
  return { ...next, resolved: next.interval >= RESOLVED_AT_DAYS };
}

export function summary(notes: readonly Note[], now: number) {
  return {
    total: notes.length,
    due: dueNotes(notes, now).length,
    resolved: notes.filter((n) => n.state.resolved).length,
  };
}
