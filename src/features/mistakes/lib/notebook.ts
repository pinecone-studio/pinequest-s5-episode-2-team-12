// The mistake notebook: one entry per source/question, active until a correct submission is saved.
// Pure (notebook.test.ts); used by the signed-in path (rows from `mistakes`) and demo mode (sessionStorage).

import { isDue, newState, type ReviewState, review } from '@/lib/sm2';
import { noteKey, type QuestionSource } from './identity';

export type MistakeSource = 'stop' | 'placement' | 'testout' | 'mock' | 'daily' | 'duel' | 'practice';
export type Entry = {
  qid: string;
  chosen: string;
  source: MistakeSource;
  at: number;
  questionSource?: QuestionSource;
};
export type NoteState = ReviewState & { resolved: boolean };
export type Note = Entry & { state: NoteState };

/** Latest miss per question wins; a miss newer than the last review puts the question back to «due». */
export function buildNotebook(
  entries: readonly Entry[],
  states: Readonly<Record<string, NoteState & { reviewedAt?: number }>>,
): Note[] {
  const latest = new Map<string, Entry>();
  for (const e of entries) {
    const cur = latest.get(noteKey(e));
    if (!cur || e.at > cur.at) latest.set(noteKey(e), e);
  }
  return [...latest.values()].map((e) => {
    const s = states[noteKey(e)];
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
  return { ...next, resolved: correct };
}

export function summary(notes: readonly Note[], now: number) {
  return {
    total: notes.length,
    due: dueNotes(notes, now).length,
    resolved: notes.filter((n) => n.state.resolved).length,
  };
}
