// Demo mode (no Supabase): the roadmap lives in localStorage, like journey/lib/local-progress.ts.
import type { ProblemAttempt, RoadmapState } from '../types';
import { initialState, isRoadmapState } from './state';

const KEY = 'suprep:roadmap:v1';
const HISTORY_CAP = 600;

export type LocalRoadmap = { state: RoadmapState; history: ProblemAttempt[]; xp: number; badges: string[] };

const empty = (): LocalRoadmap => ({ state: initialState(), history: [], xp: 0, badges: [] });

export function loadLocalRoadmap(): LocalRoadmap {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LocalRoadmap>;
    if (!isRoadmapState(parsed.state)) return empty();
    return {
      state: parsed.state,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    };
  } catch {
    return empty();
  }
}

export function saveLocalRoadmap(next: LocalRoadmap): LocalRoadmap {
  const trimmed = { ...next, history: next.history.slice(-HISTORY_CAP) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // storage full or blocked: the session still works, it just will not persist
  }
  return trimmed;
}

export function clearLocalRoadmap() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
