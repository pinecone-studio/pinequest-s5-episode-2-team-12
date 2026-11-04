// Demo mode (no Supabase): finished mock attempts and the one in progress live in localStorage.
import earlierMock from '@/features/demo/earlier-mock.json';
import type { MockAttempt } from './mock';

const KEY = 'suprep:mocks:v1';
const CURRENT = 'suprep:mock:current:v1';
const CAP = 20;

export type InProgress = {
  id: string;
  /** Demo: the attempt the server gave back last; signed in: only the id. */
  attempt?: MockAttempt;
  answers: Record<string, string>;
  times: Record<string, number>;
  marked: string[];
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the attempt lasts for this page only
  }
}

export function loadLocalMocks(): MockAttempt[] {
  const list = read<MockAttempt[]>(KEY, []);
  const finished = Array.isArray(list) ? list.filter((a) => a?.finishedAt) : [];
  const tuya = finished.find((a) => a.id === 'local-tuya-practice-test-1');
  // Upgrade existing Tuya demos without replacing user edits or later attempts.
  if (tuya && !finished.some((a) => a.id === earlierMock.id)) {
    const baseline = structuredClone(earlierMock) as MockAttempt;
    const offset = Date.parse(tuya.startedAt) - 7 * 86400000 - Date.parse(baseline.startedAt);
    const shift = (at: string) => new Date(Date.parse(at) + offset).toISOString();
    baseline.startedAt = shift(baseline.startedAt);
    baseline.finishedAt = shift(baseline.finishedAt!);
    baseline.modules = baseline.modules.map((m) => ({
      ...m,
      startedAt: shift(m.startedAt),
      endsAt: shift(m.endsAt),
      submittedAt: m.submittedAt ? shift(m.submittedAt) : null,
    }));
    const upgraded = [...finished, baseline].sort(
      (a, b) => Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!),
    );
    write(KEY, upgraded);
    return upgraded;
  }
  return finished;
}

export function saveLocalMock(a: MockAttempt) {
  const rest = loadLocalMocks().filter((x) => x.id !== a.id);
  write(KEY, [a, ...rest].slice(0, CAP));
}

export const loadInProgress = () => read<InProgress | null>(CURRENT, null);
export const saveInProgress = (p: InProgress | null) => write(CURRENT, p);
