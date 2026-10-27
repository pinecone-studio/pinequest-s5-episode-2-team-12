// Server-only. The student's own data → the exact inputs Суу's planner and analyze skills were trained on
// (ai/v2/planner.ts PlannerInput, ai/v2/analyze.ts AnalyzeInput). Pure functions (student-input.test.ts).
//   answers: problem_attempts (signed in) or the roadmap history in localStorage (demo)
//   mistakes: the mistake notebook; question facts (topic, vocab, Desmos rows) come from the server's bank
import { type AnalyzeInput, habitCounts, type MistakeRow, type Source, WORDS } from '../../../ai/v2/analyze';
import { MIN_N, type PlannerInput, type TopicStat } from '../../../ai/v2/planner';
import { DAYS, type Day, TOPIC_NAMES } from '../../../ai/v2/skills';

export type Attempt = { qid: string; topicId: number; correct: boolean; timeMs: number; at: number };
export type MistakeSource = 'stop' | 'placement' | 'testout' | 'mock' | 'daily' | 'duel' | 'practice';
export type MistakeEntry = { qid: string; source: MistakeSource; at: number };
/** What the analysis needs to know about a question (from the server's bank). */
export type QuestionFacts = { topicId?: number; vocab?: string[]; desmos: boolean };

const DAY_MS = 86_400_000;
/** "Trend" compares the last 2 weeks with what came before (the kit's definition). */
const TREND_MS = 14 * DAY_MS;
/** The analysis looks at the most recent mistakes (the kit trains on up to 30). */
export const MAX_MISTAKES = 30;

/**
 * Where a mistake happened, in the kit's words. Mock mistakes have no position in the test stored, and the kit's
 * `exam` rows always carry one, so they count as practice.
 */
export const SOURCE: Record<MistakeSource, Source> = {
  stop: 'lesson',
  placement: 'checkpoint',
  testout: 'checkpoint',
  mock: 'practice',
  daily: 'practice',
  duel: 'practice',
  practice: 'practice',
};

const pct = (num: number, den: number) => Math.round((100 * num) / den);

/** The 7 days starting `today` ("2026-10-27"), Monday-first Mongolian short names (the kit's DAYS). */
export function weekFrom(today: string): Day[] {
  const js = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const start = (js + 6) % 7; // Monday = 0
  return DAYS.map((_, i) => DAYS[(start + i) % 7] as Day);
}

/** Days from `today` to the exam (at least 1). */
export function daysUntil(today: string, examDate: string): number {
  return Math.max(
    1,
    Math.round((Date.parse(`${examDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS),
  );
}

/**
 * Accuracy, count, seconds per question and 2-week trend per roadmap topic. Topics the student marked weak
 * without answering get n = 0 (the plan then asks for a short test first). Sorted by topic id.
 */
export function topicStats(
  attempts: readonly Attempt[],
  now: number,
  weakIds: readonly number[] = [],
): TopicStat[] {
  const by = new Map<number, Attempt[]>();
  for (const a of attempts) {
    if (!TOPIC_NAMES[a.topicId]) continue;
    const list = by.get(a.topicId) ?? [];
    list.push(a);
    by.set(a.topicId, list);
  }
  const out: TopicStat[] = [];
  for (const [id, list] of by) {
    const n = list.length;
    const correct = list.filter((a) => a.correct).length;
    const timed = list.filter((a) => a.timeMs > 0);
    const sec = timed.length ? Math.round(timed.reduce((s, a) => s + a.timeMs, 0) / timed.length / 1000) : 0;
    const recent = list.filter((a) => a.at > now - TREND_MS);
    const older = list.filter((a) => a.at <= now - TREND_MS);
    const trend =
      n >= MIN_N && recent.length >= 3 && older.length >= 3
        ? pct(recent.filter((a) => a.correct).length, recent.length) -
          pct(older.filter((a) => a.correct).length, older.length)
        : 0;
    out.push({ id, name: TOPIC_NAMES[id], acc: pct(correct, n), n, sec, trend });
  }
  for (const id of new Set(weakIds))
    if (TOPIC_NAMES[id] && !by.has(id))
      out.push({ id, name: TOPIC_NAMES[id], acc: 0, n: 0, sec: 0, trend: 0 });
  return out.sort((a, b) => a.id - b.id);
}

/**
 * The student's recent mistakes as the analyze skill reads them: topic, seconds spent on the last wrong try
 * (60 when unknown, i.e. neither rushed nor slow), how many times it was missed, Desmos-solvable, SAT words.
 * Questions the bank doesn't know (no topic) are left out.
 */
export function analyzeInput(
  mistakes: readonly MistakeEntry[],
  attempts: readonly Attempt[],
  facts: (qid: string) => QuestionFacts | undefined,
): AnalyzeInput {
  const latest = new Map<string, MistakeEntry>();
  for (const m of mistakes) {
    const cur = latest.get(m.qid);
    if (!cur || m.at > cur.at) latest.set(m.qid, m);
  }
  const rows: MistakeRow[] = [];
  for (const m of [...latest.values()].sort((a, b) => b.at - a.at)) {
    if (rows.length >= MAX_MISTAKES) break;
    const f = facts(m.qid);
    if (!f?.topicId || !TOPIC_NAMES[f.topicId]) continue;
    const wrong = attempts.filter((a) => a.qid === m.qid && !a.correct).sort((a, b) => b.at - a.at);
    const sec = wrong[0]?.timeMs ? Math.max(1, Math.round(wrong[0].timeMs / 1000)) : 60;
    const words = (f.vocab ?? [])
      .map((w) => w.toLowerCase().trim())
      .filter((w): w is (typeof WORDS)[number] => (WORDS as readonly string[]).includes(w));
    const row: MistakeRow = {
      q: m.qid,
      topic: f.topicId,
      sec,
      src: SOURCE[m.source] ?? 'practice',
      desmos: f.desmos,
      times: Math.min(5, Math.max(1, wrong.length)),
    };
    if (words.length) row.words = [...new Set(words)];
    rows.push(row);
  }
  const answered = Math.max(attempts.length, rows.length);
  return { answered, correct: answered - rows.length, mistakes: rows };
}

export type PlanForm = {
  today: string;
  examDate: string;
  current: number;
  target: number;
  hoursPerDay: number;
  note?: string;
  weakIds?: number[];
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const score = (x: number) => clamp(Math.round(x / 10) * 10, 200, 800);

/** The planner skill's input: the form, the student's topic stats, and habits from their mistakes. */
export function plannerInput(
  form: PlanForm,
  attempts: readonly Attempt[],
  analysis?: AnalyzeInput,
): PlannerInput {
  const note = form.note?.trim().slice(0, 300);
  const input: PlannerInput = {
    days: weekFrom(form.today),
    daysLeft: daysUntil(form.today, form.examDate),
    current: score(form.current),
    target: score(form.target),
    hoursPerDay: clamp(Math.round(form.hoursPerDay * 2) / 2, 0.5, 6),
    topics: topicStats(attempts, Date.parse(`${form.today}T12:00:00Z`), form.weakIds ?? []),
  };
  if (analysis?.mistakes.length) input.habits = habitCounts(analysis);
  if (note) input.note = note;
  return input;
}
