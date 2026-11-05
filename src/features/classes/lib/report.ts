// Teacher view: turns the class_report rows (migration 0022) into what the teacher needs to act on —
// who needs help first, and why. Pure functions, so they are tested without a database.
import { TOPICS } from '@/features/roadmap/topics';

export type StudentRow = {
  id: string;
  name: string;
  username: string | null;
  joined_at: string;
  answers: number;
  correct: number;
  week: number;
  last_active: string | null;
  open_mistakes: number;
  weak_topics: number[];
};

export type Status = 'inactive' | 'struggling' | 'new' | 'ok';

export type StudentView = StudentRow & {
  /** Whole percent, or null with no answers yet. */
  accuracy: number | null;
  status: Status;
  weakTopicNames: string[];
  /** Days since the last answer (null: never). */
  idleDays: number | null;
};

const DAY = 86_400_000;
/** No answer for this many days → inactive. */
export const INACTIVE_DAYS = 7;
/** Below this accuracy, with at least MIN_ANSWERS answers → struggling. */
export const STRUGGLING_PCT = 50;
export const MIN_ANSWERS = 10;

const topicTitle = (id: number) => TOPICS.find((t) => t.id === id)?.title ?? `Сэдэв ${id}`;

export function view(row: StudentRow, now: number): StudentView {
  const accuracy = row.answers ? Math.round((100 * row.correct) / row.answers) : null;
  const idleDays = row.last_active ? Math.floor((now - Date.parse(row.last_active)) / DAY) : null;
  let status: Status = 'ok';
  if (row.answers === 0) status = Date.parse(row.joined_at) > now - INACTIVE_DAYS * DAY ? 'new' : 'inactive';
  else if (idleDays !== null && idleDays >= INACTIVE_DAYS) status = 'inactive';
  else if (row.answers >= MIN_ANSWERS && (accuracy ?? 100) < STRUGGLING_PCT) status = 'struggling';
  return { ...row, accuracy, status, idleDays, weakTopicNames: row.weak_topics.map(topicTitle) };
}

const ORDER: Record<Status, number> = { struggling: 0, inactive: 1, new: 2, ok: 3 };

/** Students who need the teacher first: struggling, then inactive, then new, then the rest; ties by name. */
export function classView(rows: StudentRow[], now: number): StudentView[] {
  return rows
    .map((r) => view(r, now))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
}

export type ClassSummary = {
  students: number;
  activeWeek: number;
  /** Class accuracy over all answers (whole percent), null with none. */
  accuracy: number | null;
  needHelp: number;
  /** Roadmap topics most often among students' weakest, most common first. */
  commonWeak: { topic: string; students: number }[];
};

export function summary(views: StudentView[]): ClassSummary {
  const answers = views.reduce((s, v) => s + v.answers, 0);
  const correct = views.reduce((s, v) => s + v.correct, 0);
  const weak = new Map<number, number>();
  for (const v of views) for (const t of v.weak_topics) weak.set(t, (weak.get(t) ?? 0) + 1);
  return {
    students: views.length,
    activeWeek: views.filter((v) => v.week > 0).length,
    accuracy: answers ? Math.round((100 * correct) / answers) : null,
    needHelp: views.filter((v) => v.status === 'struggling' || v.status === 'inactive').length,
    commonWeak: [...weak]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 3)
      .map(([t, students]) => ({ topic: topicTitle(t), students })),
  };
}

/** A class code as typed by a student: 6 letters/digits, upper case, spaces and dashes ignored. */
export function normalizeCode(input: string): string | null {
  const c = input.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

/** Sample class for demo mode (no database), so the page can be shown without accounts. */
export function demoRows(now: number): StudentRow[] {
  const ago = (d: number) => new Date(now - d * DAY).toISOString();
  return [
    {
      id: 'd1',
      name: 'Болд',
      username: 'bold',
      joined_at: ago(20),
      answers: 140,
      correct: 112,
      week: 35,
      last_active: ago(0),
      open_mistakes: 6,
      weak_topics: [14, 9],
    },
    {
      id: 'd2',
      name: 'Сараа',
      username: 'saraa',
      joined_at: ago(20),
      answers: 60,
      correct: 24,
      week: 12,
      last_active: ago(1),
      open_mistakes: 21,
      weak_topics: [3, 14, 7],
    },
    {
      id: 'd3',
      name: 'Тэмүүлэн',
      username: 'temuulen',
      joined_at: ago(19),
      answers: 45,
      correct: 33,
      week: 0,
      last_active: ago(10),
      open_mistakes: 4,
      weak_topics: [14],
    },
    {
      id: 'd4',
      name: 'Номин',
      username: 'nomin',
      joined_at: ago(2),
      answers: 0,
      correct: 0,
      week: 0,
      last_active: null,
      open_mistakes: 0,
      weak_topics: [],
    },
  ];
}
