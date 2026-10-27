// Suu v2 · AI planner skill («AI төлөвлөгөө», /planner).
// Input: what the app already knows (topic accuracy, time per question, trend, habits from the mistake
// analysis, exam countdown, free-text note). Output: focus topics + a 7-day schedule as JSON.
// The gold plan is made by the rules below, so every training answer is consistent with its input.
// What the model must learn: find the weak topics and patterns, read the Mongolian note
// ("Мягмар гарагт завгүй"), and fit the week into each day's time. No runtime imports (runs in Colab).
import { int, mulberry32, pick, type Rng, shuffle } from '../pipeline/templates/shared';
import {
  DAY_NAMES,
  DAYS,
  type Day,
  DESMOS_TOPICS,
  mongolianShare,
  PLANNER_PROMPT,
  type Row,
  TOPIC_NAMES,
} from './skills';

export type TopicStat = {
  id: number;
  name: string;
  /** % correct, 0–100. */
  acc: number;
  /** Questions answered in this topic. */
  n: number;
  /** Average seconds per question. */
  sec: number;
  /** Change in % correct over the last 2 weeks (negative = getting worse). */
  trend: number;
};

/** Counts from the mistake analysis (see analyze.ts). */
export type Habits = { rushed: number; slow: number; desmos: number };

export type PlannerInput = {
  /** The next 7 days, starting today. */
  days: Day[];
  daysLeft: number;
  current: number;
  target: number;
  hoursPerDay: number;
  topics: TopicStat[];
  habits?: Habits;
  /** What the student typed, in Mongolian. */
  note?: string;
};

export type TaskKind = 'lesson' | 'desmos' | 'practice' | 'cards' | 'mock' | 'review';
export type Task = { t: TaskKind; topic?: number; min: number; timed?: true };
export type DayPlan = { day: Day; min: number; tasks: Task[] };
export type Phase = 'learn' | 'mixed' | 'test' | 'final';
export type PlannerOutput = {
  phase: Phase;
  focus: { id: number; why: string }[];
  check: number[];
  week: DayPlan[];
  advice: string;
};

/** What the note says, in structured form (the generator writes the text from this). */
export type NoteRules = { busy: Day[]; set: Partial<Record<Day, number>> };

export const MIN_N = 5;
export const MOCK_MIN = 70;
const round5 = (x: number) => Math.round(x / 5) * 5;

export function phaseOf(daysLeft: number): Phase {
  if (daysLeft <= 3) return 'final';
  if (daysLeft <= 14) return 'test';
  if (daysLeft <= 42) return 'mixed';
  return 'learn';
}

const MOCKS: Record<Phase, number> = { learn: 0, mixed: 1, test: 2, final: 0 };

/**
 * Minutes the student has on each day. Sunday is a light day unless the note says otherwise.
 * Days on or after the exam get 0.
 */
export function budgets(
  input: Pick<PlannerInput, 'days' | 'hoursPerDay' | 'daysLeft'>,
  rules: NoteRules,
): Record<Day, number> {
  const base = Math.round(input.hoursPerDay * 60);
  const out = {} as Record<Day, number>;
  for (const d of DAYS) out[d] = d === 'Ня' ? Math.min(45, Math.max(15, round5(base / 2))) : base;
  for (const [d, m] of Object.entries(rules.set) as [Day, number][]) out[d] = m;
  for (const d of rules.busy) out[d] = 0;
  input.days.forEach((d, i) => {
    if (i >= input.daysLeft) out[d] = 0;
  });
  return out;
}

/** Higher = weaker. Only topics with enough answers count. */
export const weakness = (t: TopicStat) => 100 - t.acc + (t.trend < 0 ? 10 : 0) + (t.sec > 120 ? 5 : 0);

export function focusTopics(topics: TopicStat[]): TopicStat[] {
  return topics
    .filter((t) => t.n >= MIN_N)
    .sort((a, b) => weakness(b) - weakness(a) || a.acc - b.acc || a.id - b.id)
    .slice(0, 3);
}

export function whyText(t: TopicStat): string {
  const parts = [`${t.acc}% зөв (${t.n} бодлого)`];
  if (t.trend < 0) parts.push(`сүүлд ${-t.trend} пункт буурсан`);
  if (t.sec > 120) parts.push(`дунджаар ${t.sec} сек`);
  return parts.join(', ');
}

/**
 * Days that get a full test: not Sunday, at least 70 min, and not in the last 2 days before the exam.
 * Saturday first, then the longest day.
 */
function mockDays(days: Day[], b: Record<Day, number>, count: number, daysLeft: number): Day[] {
  const ok = days.filter((d, i) => d !== 'Ня' && b[d] >= MOCK_MIN && i <= daysLeft - 3);
  const order = [...ok].sort(
    (x, y) => Number(y === 'Бя') - Number(x === 'Бя') || b[y] - b[x] || days.indexOf(x) - days.indexOf(y),
  );
  return order.slice(0, count);
}

/** Practice block. The app shows about one question per 2 minutes (min / 2). */
const practice = (topic: number | undefined, min: number, timed: boolean): Task => ({
  t: 'practice',
  ...(topic ? { topic } : {}),
  min,
  ...(timed ? { timed: true as const } : {}),
});

export function namesOf(days: Day[]): string {
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

/** The gold plan. */
export function plan(input: PlannerInput, rules: NoteRules): PlannerOutput {
  const phase = phaseOf(input.daysLeft);
  const b = budgets(input, rules);
  const focus = focusTopics(input.topics);
  const check = input.topics.filter((t) => t.n < MIN_N).map((t) => t.id);
  const h = input.habits ?? { rushed: 0, slow: 0, desmos: 0 };
  const timed = h.slow >= 3;
  const mocks = new Set(mockDays(input.days, b, MOCKS[phase], input.daysLeft));
  let k = 0;
  let desmosLeft = h.desmos >= 3;

  const week: DayPlan[] = input.days.map((day) => {
    const B = b[day];
    const tasks: Task[] = [];
    if (B <= 0) return { day, min: 0, tasks };
    if (mocks.has(day)) {
      tasks.push({ t: 'mock', min: MOCK_MIN });
      if (B - MOCK_MIN >= 10) tasks.push({ t: 'review', min: B - MOCK_MIN });
    } else if (phase === 'final' || day === 'Ня' || B < 30) {
      if (phase === 'final' && B >= 45) tasks.push({ t: 'review', min: B - 15 }, { t: 'cards', min: 15 });
      else tasks.push({ t: 'review', min: B });
    } else {
      const topic = focus.length ? focus[k++ % focus.length]?.id : undefined;
      if (phase === 'test') {
        if (B >= 40) tasks.push({ t: 'review', min: 20 }, practice(topic, B - 20, timed));
        else tasks.push(practice(topic, B, timed));
      } else if (B >= 60) {
        const useDesmos = desmosLeft && topic !== undefined && DESMOS_TOPICS.has(topic);
        if (useDesmos) desmosLeft = false;
        tasks.push(
          { t: useDesmos ? 'desmos' : 'lesson', ...(topic ? { topic } : {}), min: 25 },
          practice(topic, B - 40, timed),
          { t: 'cards', min: 15 },
        );
      } else {
        tasks.push(practice(topic, B - 10, timed), { t: 'cards', min: 10 });
      }
    }
    return { day, min: tasks.reduce((s, t) => s + t.min, 0), tasks };
  });

  return {
    phase,
    focus: focus.map((t) => ({ id: t.id, why: whyText(t) })),
    check,
    week,
    advice: adviceText(input, rules, phase, focus, check, mocks.size < MOCKS[phase]),
  };
}

const PHASE_TEXT: Record<Phase, (d: number) => string> = {
  learn: (d) => `Шалгалт хүртэл ${d} өдөр байна — одоо сул сэдвээ суурьтай нь сурах үе.`,
  mixed: (d) => `Шалгалт хүртэл ${d} өдөр байна — сул сэдвээ давтаж, долоо хоногт 1 бүтэн тест өг.`,
  test: (d) => `Шалгалт хүртэл ${d} өдөр үлдлээ — долоо хоногт 2 бүтэн тест өгч, алдаагаа зас.`,
  final: (d) =>
    `Шалгалт хүртэл ${d} өдөр л үлдлээ — шинэ сэдэв бүү эхлүүл, алдааны дэвтрээ давтаад сайн амар.`,
};

function adviceText(
  input: PlannerInput,
  rules: NoteRules,
  phase: Phase,
  focus: TopicStat[],
  check: number[],
  mockShort: boolean,
): string {
  const s = [PHASE_TEXT[phase](input.daysLeft)];
  if (focus.length && phase !== 'final') {
    const names = focus.slice(0, 2).map((t) => t.name);
    s.push(`Эхлээд ${names.join(' ба ')} дээр төвлөр.`);
  }
  const h = input.habits;
  if (h && h.rushed >= 3) s.push('Яарч алдсан бодлого олон байна — хариугаа сонгохоос өмнө нэг удаа шалга.');
  else if (h && h.slow >= 3) s.push('Удаан бодсон бодлого олон байна — дасгалаа цаг хэмжиж хий.');
  else if (h && h.desmos >= 3)
    s.push('Desmos-оор хурдан бодох боломжтой бодлогууд дээр алдсан байна — Desmos аргыг сур.');
  if (rules.busy.length) s.push(`${namesOf(rules.busy)} гарагт хичээл тавьсангүй.`);
  for (const [d, m] of Object.entries(rules.set) as [Day, number][])
    s.push(`${DAY_NAMES[d]} гарагт ${m} минут тавилаа.`);
  if (mockShort)
    s.push('Бүтэн тест (70 мин) багтах өдөр хүрэлцэхгүй байна — нэг өдөр цаг гаргаж чадвал сайн.');
  if (check.length && phase !== 'final')
    s.push(`${check.map((id) => TOPIC_NAMES[id]).join(', ')}: бодлого цөөн байна — эхлээд богино тест хий.`);
  if (input.target > input.current && phase !== 'final')
    s.push(`Зорилго: +${input.target - input.current} оноо.`);
  return s.join(' ');
}

// ——— random students ———

const BUSY_WORDS = [
  'завгүй',
  'дугуйлантай',
  'сургуулийн шалгалттай',
  'ажилтай',
  'хичээллэх боломжгүй',
] as const;
const CHATTER = [
  'Би 11-р ангийн сурагч.',
  'Миний зорилго тэтгэлэгтэй сургуульд орох.',
  'Математикт дуртай.',
  'Өглөө эрт босдог.',
] as const;

function randomDaysLeft(r: Rng): number {
  const x = r();
  if (x < 0.07) return int(r, 1, 3);
  if (x < 0.32) return int(r, 4, 14);
  if (x < 0.65) return int(r, 15, 42);
  if (x < 0.88) return int(r, 43, 120);
  return int(r, 121, 300); // the app offers SAT dates up to a year ahead
}

/**
 * Which topics the student has data for, the way the app sends them: answered roadmap topics (n ≥ 1) plus topics
 * the student marked weak without answering any (n = 0). Brand-new students have only a few thin topics; active
 * ones up to all 26.
 */
function randomTopicCount(r: Rng): { count: number; fresh: boolean } {
  const x = r();
  if (x < 0.1) return { count: int(r, 0, 3), fresh: true };
  if (x < 0.25) return { count: int(r, 10, 26), fresh: false };
  return { count: int(r, 5, 9), fresh: false };
}

/** Note rules and the Mongolian text that says them. */
export function randomNote(r: Rng, base: number): { rules: NoteRules; text?: string } {
  const rules: NoteRules = { busy: [], set: {} };
  if (r() < 0.4) return { rules };
  const parts: string[] = [];
  const kinds = shuffle(r, ['busy', 'more', 'less', 'sunday'] as const).slice(0, r() < 0.6 ? 1 : 2);
  const used = new Set<Day>();
  for (const kind of kinds) {
    if (kind === 'busy') {
      const ds = shuffle(
        r,
        DAYS.filter((d) => d !== 'Ня' && !used.has(d)),
      ).slice(0, int(r, 1, 2));
      const ordered = DAYS.filter((d) => ds.includes(d));
      for (const d of ordered) used.add(d);
      rules.busy.push(...ordered);
      parts.push(`${namesOf(ordered)} гарагт ${pick(r, BUSY_WORDS)}.`);
    } else if (kind === 'more') {
      const d = pick(
        r,
        (['Бя', 'Ба', 'Лх'] as Day[]).filter((x) => !used.has(x)),
      );
      if (!d) continue;
      const hours = pick(r, [2, 2.5, 3] as const);
      if (hours * 60 <= base) continue;
      used.add(d);
      rules.set[d] = hours * 60;
      parts.push(`${DAY_NAMES[d]} гарагт ${hours} цаг гаргаж чадна.`);
    } else if (kind === 'less') {
      const d = pick(
        r,
        (['Да', 'Мя', 'Пү', 'Ба'] as Day[]).filter((x) => !used.has(x)),
      );
      if (!d) continue;
      const m = pick(r, [30, 45] as const);
      if (m >= base) continue;
      used.add(d);
      rules.set[d] = m;
      parts.push(`${DAY_NAMES[d]} гарагт зөвхөн ${m} минут байна.`);
    } else if (!used.has('Ня')) {
      used.add('Ня');
      rules.busy.push('Ня');
      parts.push('Ням гарагт бүрэн амармаар байна.');
    }
  }
  rules.busy = DAYS.filter((d) => rules.busy.includes(d));
  if (!parts.length) return { rules: { busy: [], set: {} } };
  if (r() < 0.25) parts.unshift(pick(r, CHATTER));
  return { rules, text: parts.join(' ') };
}

export function randomStudent(r: Rng): { input: PlannerInput; rules: NoteRules } {
  const start = int(r, 0, 6);
  const days = DAYS.map((_, i) => DAYS[(start + i) % 7] as Day);
  const current = 200 + 10 * int(r, 0, 58);
  const target = Math.min(800, current + 10 * int(r, 4, 20));
  const hoursPerDay = pick(r, [0.5, 1, 1, 1.5, 1.5, 2, 2, 2.5, 3, 4, 5, 6] as const);
  const { count, fresh } = randomTopicCount(r);
  const ids = shuffle(
    r,
    Array.from({ length: 26 }, (_, i) => i + 1),
  ).slice(0, count);
  let few = 0;
  const level = (current - 200) / 6;
  const topics: TopicStat[] = ids
    .sort((a, b) => a - b)
    .map((id) => {
      const isFew = fresh || (few < 2 && r() < 0.15);
      if (isFew) few++;
      const n = isFew ? int(r, 0, MIN_N - 1) : int(r, MIN_N, 40);
      // a topic marked weak but never answered has no accuracy or time yet
      if (n === 0) return { id, name: TOPIC_NAMES[id] ?? String(id), acc: 0, n: 0, sec: 0, trend: 0 };
      return {
        id,
        name: TOPIC_NAMES[id] ?? String(id),
        acc: Math.max(10, Math.min(98, Math.round(level + int(r, -35, 30)))),
        n,
        sec: int(r, 40, 200),
        trend: r() < 0.5 || n < MIN_N ? 0 : int(r, -15, 15),
      };
    });
  if (!fresh && !topics.some((t) => t.n >= MIN_N) && topics[0]) topics[0].n = int(r, MIN_N, 20);
  const habits = r() < 0.6 ? { rushed: int(r, 0, 6), slow: int(r, 0, 6), desmos: int(r, 0, 6) } : undefined;
  const { rules, text } = randomNote(r, Math.round(hoursPerDay * 60));
  const input: PlannerInput = {
    days,
    daysLeft: randomDaysLeft(r),
    current,
    target,
    hoursPerDay,
    topics,
    ...(habits ? { habits } : {}),
    ...(text ? { note: text } : {}),
  };
  return { input, rules };
}

export function plannerRows(seed: number, count: number, prefix = 'plan'): Row[] {
  const r = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const { input, rules } = randomStudent(r);
    const gold = plan(input, rules);
    return {
      skill: 'planner' as const,
      id: `${prefix}-${seed}-${i}`,
      messages: [
        { role: 'system' as const, content: PLANNER_PROMPT },
        { role: 'user' as const, content: JSON.stringify(input) },
        { role: 'assistant' as const, content: JSON.stringify(gold) },
      ],
      check: { rules },
    };
  });
}

// ——— checking a model's plan ———

/** First {...} block in the text (models sometimes wrap JSON in ``` fences). */
export function parseJson(text: string): unknown {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
}

export type PlannerScore = {
  json: boolean;
  phase: boolean;
  focus: boolean;
  focusSet: boolean;
  week: boolean;
  busy: boolean;
  budget: boolean;
  exact: boolean;
  mocks: boolean;
  topics: boolean;
  mongolian: boolean;
  pass: boolean;
};

const isTask = (x: unknown): x is Task =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as Task).t === 'string' &&
  typeof (x as Task).min === 'number';

export function scorePlan(output: string, input: PlannerInput, rules: NoteRules): PlannerScore {
  const gold = plan(input, rules);
  const b = budgets(input, rules);
  const o = parseJson(output) as Partial<PlannerOutput> | null;
  const none: PlannerScore = {
    json: false,
    phase: false,
    focus: false,
    focusSet: false,
    week: false,
    busy: false,
    budget: false,
    exact: false,
    mocks: false,
    topics: false,
    mongolian: false,
    pass: false,
  };
  if (!o || typeof o !== 'object') return none;
  const ids = Array.isArray(o.focus) ? o.focus.map((f) => Number((f as { id?: unknown })?.id)) : [];
  const goldIds = gold.focus.map((f) => f.id);
  const week = Array.isArray(o.week) ? o.week : [];
  const days = week.map((d) => d?.day);
  const weekOk =
    week.length === 7 &&
    days.every((d, i) => d === input.days[i]) &&
    week.every((d) => typeof d?.min === 'number' && Array.isArray(d.tasks) && d.tasks.every(isTask));
  const known = new Set(input.topics.map((t) => t.id));
  const tasks = weekOk ? week.flatMap((d) => d.tasks) : [];
  const s: PlannerScore = {
    json: true,
    phase: o.phase === gold.phase,
    focus: ids.length === goldIds.length && ids.every((id, i) => id === goldIds[i]),
    focusSet: ids.length === goldIds.length && goldIds.every((id) => ids.includes(id)),
    week: weekOk,
    busy: weekOk && week.every((d) => b[d.day] > 0 || (d.min === 0 && d.tasks.length === 0)),
    budget:
      weekOk && week.every((d) => d.min <= b[d.day] && d.tasks.reduce((sum, t) => sum + t.min, 0) === d.min),
    exact: weekOk && week.every((d, i) => d.min === gold.week[i]?.min),
    mocks:
      weekOk &&
      tasks.filter((t) => t.t === 'mock').length ===
        gold.week.flatMap((d) => d.tasks).filter((t) => t.t === 'mock').length,
    topics: weekOk && tasks.every((t) => t.topic === undefined || known.has(t.topic)),
    mongolian: typeof o.advice === 'string' && mongolianShare(o.advice) >= 0.6,
    pass: false,
  };
  s.pass = s.json && s.phase && s.focus && s.week && s.busy && s.budget && s.mocks && s.topics && s.mongolian;
  return s;
}
