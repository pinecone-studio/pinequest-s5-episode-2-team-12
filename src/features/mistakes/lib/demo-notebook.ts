'use client';

import { newState } from '@/lib/sm2';
import { noteKey, type QuestionRef } from './identity';
import type { Entry, NoteState } from './notebook';

export const DEMO_NOTES_KEY = 'suprep:mistakes:demo:entries:v1';
export const DEMO_STATES_KEY = 'suprep:mistakes:v1';
export type StoredStates = Record<string, NoteState & { reviewedAt?: number }>;
export function readDemoNotebook(): { entries: Entry[]; states: StoredStates } {
  try {
    return {
      entries: JSON.parse(sessionStorage.getItem(DEMO_NOTES_KEY) ?? '[]'),
      states: JSON.parse(sessionStorage.getItem(DEMO_STATES_KEY) ?? '{}'),
    };
  } catch {
    return { entries: [], states: {} };
  }
}
export function saveDemoSubmission(ref: QuestionRef, answer: string, correct: boolean) {
  const current = readDemoNotebook();
  const key = noteKey(ref);
  const now = Date.now();
  const entries = current.entries.filter((entry) => noteKey(entry) !== key);
  if (!correct) entries.push({ ...ref, chosen: answer, source: 'practice', at: now });
  const states = { ...current.states, [key]: { ...newState(now), resolved: correct, reviewedAt: now } };
  // Only explicit cookie demo sessions use this browser-tab namespace. Signed-in users never read it.
  sessionStorage.setItem(DEMO_NOTES_KEY, JSON.stringify(correct ? current.entries : entries));
  sessionStorage.setItem(DEMO_STATES_KEY, JSON.stringify(states));
  window.dispatchEvent(new Event('suu:mistakes-changed'));
}
