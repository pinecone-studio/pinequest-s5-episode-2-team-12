// Suu v2 · mistake pattern skill (/mistakes, full-test results, and the input for the planner).
// Input: the student's recent mistakes as the app stores them (topic, seconds, source, Desmos-solvable,
// how many times, position in a full test, English words in the question).
// Output: the patterns that repeat, exact counts, and next steps. Patterns are computed by code below,
// so the gold answer always matches the data. No runtime imports (runs in Colab).
import { int, mulberry32, pick, type Rng, shuffle } from '../pipeline/templates/shared';
import { parseJson } from './planner';
import { ANALYZE_PROMPT, DESMOS_TOPICS, mongolianShare, type Row, TOPIC_NAMES } from './skills';

export type Source = 'practice' | 'exam' | 'lesson' | 'checkpoint' | 'hard';
export type MistakeRow = {
  q: string;
  topic: number;
  sec: number;
  src: Source;
  /** The question can be solved quickly with Desmos. */
  desmos: boolean;
  /** How many times the student got this question wrong. */
  times: number;
  /** Position 1–22 in the module, only for full tests (src = exam). */
  pos?: number;
  /** SAT words in the question that students often misread. */
  words?: string[];
};
export type AnalyzeInput = { answered: number; correct: number; mistakes: MistakeRow[] };

export type PatternType = 'topic' | 'rushed' | 'slow' | 'desmos' | 'repeat' | 'late' | 'vocab';
export type Pattern = { type: PatternType; count: number; topic?: number; word?: string };
export type AnalyzeOutput = {
  patterns: Pattern[];
  habits: { rushed: number; slow: number; desmos: number };
  summary: string;
  next: string[];
};

export const RUSHED_SEC = 30;
export const SLOW_SEC = 150;
const ORDER: PatternType[] = ['topic', 'rushed', 'slow', 'desmos', 'repeat', 'late', 'vocab'];

export const keyOf = (p: Pick<Pattern, 'type' | 'topic' | 'word'>) => `${p.type}:${p.topic ?? p.word ?? ''}`;

/** All patterns in the data, biggest first. */
export function findPatterns(input: AnalyzeInput): Pattern[] {
  const m = input.mistakes;
  const out: Pattern[] = [];
  const byTopic = new Map<number, number>();
  for (const x of m) byTopic.set(x.topic, (byTopic.get(x.topic) ?? 0) + 1);
  for (const [topic, count] of byTopic) if (count >= 3) out.push({ type: 'topic', topic, count });
  const h = habitCounts(input);
  if (h.rushed >= 3) out.push({ type: 'rushed', count: h.rushed });
  if (h.slow >= 3) out.push({ type: 'slow', count: h.slow });
  if (h.desmos >= 3) out.push({ type: 'desmos', count: h.desmos });
  const repeat = m.filter((x) => x.times >= 2).length;
  if (repeat >= 2) out.push({ type: 'repeat', count: repeat });
  const exam = m.filter((x) => x.src === 'exam' && x.pos !== undefined);
  const late = exam.filter((x) => (x.pos ?? 0) >= 16).length;
  if (late >= 3 && late * 5 >= exam.length * 3) out.push({ type: 'late', count: late });
  const words = new Map<string, number>();
  for (const x of m) for (const w of new Set(x.words ?? [])) words.set(w, (words.get(w) ?? 0) + 1);
  for (const [word, count] of words) if (count >= 2) out.push({ type: 'vocab', word, count });
  return out.sort(
    (a, b) =>
      b.count - a.count ||
      ORDER.indexOf(a.type) - ORDER.indexOf(b.type) ||
      (a.topic ?? 0) - (b.topic ?? 0) ||
      (a.word ?? '').localeCompare(b.word ?? ''),
  );
}

/** Raw habit counts (also below the pattern threshold) — the planner's `habits` input. */
export function habitCounts(input: AnalyzeInput) {
  const m = input.mistakes;
  return {
    rushed: m.filter((x) => x.sec < RUSHED_SEC).length,
    slow: m.filter((x) => x.sec > SLOW_SEC).length,
    desmos: m.filter((x) => x.desmos).length,
  };
}

function phrase(p: Pattern): string {
  switch (p.type) {
    case 'topic':
      return `${TOPIC_NAMES[p.topic ?? 0]} сэдэвт ${p.count} алдаа`;
    case 'rushed':
      return `30 секундээс бага хугацаанд ${p.count} алдаа (яарсан)`;
    case 'slow':
      return `2.5 минутаас удаан бодоод ${p.count} алдаа`;
    case 'desmos':
      return `Desmos-оор бодож болох ${p.count} бодлогод алдсан`;
    case 'repeat':
      return `${p.count} бодлогыг дахин алдсан`;
    case 'late':
      return `бүтэн тестийн сүүлийн асуултуудад ${p.count} алдаа`;
    case 'vocab':
      return `"${p.word}" үгтэй ${p.count} бодлогод алдсан`;
  }
}

function action(p: Pattern): string {
  switch (p.type) {
    case 'topic':
      return `${TOPIC_NAMES[p.topic ?? 0]}: замналын хичээлээ давтаад 10 бодлого бод.`;
    case 'rushed':
      return 'Хариугаа сонгохоос өмнө 10 секунд зарцуулж шалга.';
    case 'slow':
      return 'Цаг хэмжсэн дасгал хий — нэг бодлогод 2 минутаас илүүгүй.';
    case 'desmos':
      return 'Desmos Академид огтлолцол, регрессийн аргыг сур.';
    case 'repeat':
      return 'Алдааны дэвтрээ 3 хоногийн дараа дахин бод.';
    case 'late':
      return 'Бүтэн тестэд цагаа хуваарил: 11 асуулт тутамд цагаа шалга.';
    case 'vocab':
      return `Карт хэсэгт "${p.word}" үгийг давт.`;
  }
}

/** The gold analysis. */
export function analyze(input: AnalyzeInput): AnalyzeOutput {
  const patterns = findPatterns(input);
  const top = patterns.slice(0, 3);
  return {
    patterns,
    habits: habitCounts(input),
    summary: top.length
      ? `Гол хэв маяг: ${top.map(phrase).join('; ')}.`
      : 'Тодорхой давтагдсан хэв маяг алга — алдаанууд тархмал байна. Дасгалаа үргэлжлүүл.',
    next: top.length ? top.map(action) : ['Өдөр бүр холимог 10 бодлого бодож, алдаагаа тэмдэглэ.'],
  };
}

// ——— random mistake lists ———

export const WORDS = [
  'at least',
  'at most',
  'respectively',
  'in terms of',
  'proportional',
  'equivalent',
  'consecutive integers',
  'remainder',
  'median',
  'percent increase',
] as const;
const SOURCES: Source[] = ['practice', 'practice', 'lesson', 'checkpoint', 'hard'];

export function randomMistakes(r: Rng): AnalyzeInput {
  const n = r() < 0.1 ? int(r, 0, 3) : int(r, 4, 15);
  const pool = shuffle(
    r,
    Array.from({ length: 26 }, (_, i) => i + 1),
  ).slice(0, int(r, 2, 6));
  const main = r() < 0.6 ? pick(r, pool) : undefined;
  const plant = {
    rushed: r() < 0.35,
    slow: r() < 0.3,
    desmos: r() < 0.35,
    exam: r() < 0.35,
    late: r() < 0.5,
    word: r() < 0.35 ? pick(r, WORDS) : undefined,
  };
  const mistakes: MistakeRow[] = [];
  for (let i = 0; i < n; i++) {
    const topic = main && r() < 0.5 ? main : pick(r, pool);
    const speed = r();
    const sec =
      plant.rushed && speed < 0.4
        ? int(r, 8, 29)
        : plant.slow && speed > 0.6
          ? int(r, 151, 260)
          : int(r, 31, 150);
    const src: Source = plant.exam && r() < 0.6 ? 'exam' : pick(r, SOURCES);
    const desmos = DESMOS_TOPICS.has(topic) && r() < (plant.desmos ? 0.8 : 0.25);
    const words = new Set<string>();
    if (plant.word && r() < 0.4) words.add(plant.word);
    if (r() < 0.15) words.add(pick(r, WORDS));
    const row: MistakeRow = {
      q: `q${int(r, 1, 999)}`,
      topic,
      sec,
      src,
      desmos,
      times: r() < 0.15 ? int(r, 2, 3) : 1,
    };
    if (src === 'exam') row.pos = plant.late && r() < 0.7 ? int(r, 16, 22) : int(r, 1, 22);
    if (words.size) row.words = [...words];
    mistakes.push(row);
  }
  const answered = n + int(r, n, 40);
  return { answered, correct: answered - n, mistakes };
}

export function analyzeRows(seed: number, count: number, prefix = 'ana'): Row[] {
  const r = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const input = randomMistakes(r);
    return {
      skill: 'analyze' as const,
      id: `${prefix}-${seed}-${i}`,
      messages: [
        { role: 'system' as const, content: ANALYZE_PROMPT },
        { role: 'user' as const, content: JSON.stringify(input) },
        { role: 'assistant' as const, content: JSON.stringify(analyze(input)) },
      ],
    };
  });
}

// ——— checking a model's analysis ———

export type AnalyzeScore = {
  json: boolean;
  recall: number;
  precision: number;
  exactSet: boolean;
  counts: boolean;
  habits: boolean;
  mongolian: boolean;
  pass: boolean;
};

export function scoreAnalysis(output: string, input: AnalyzeInput): AnalyzeScore {
  const gold = analyze(input);
  const o = parseJson(output) as Partial<AnalyzeOutput> | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.patterns))
    return {
      json: false,
      recall: 0,
      precision: 0,
      exactSet: false,
      counts: false,
      habits: false,
      mongolian: false,
      pass: false,
    };
  const want = new Map(gold.patterns.map((p) => [keyOf(p), p.count]));
  const got = new Map(
    o.patterns
      .filter((p): p is Pattern => typeof p === 'object' && p !== null && typeof p.type === 'string')
      .map((p) => [keyOf(p), Number(p.count)]),
  );
  const hit = [...got.keys()].filter((k) => want.has(k));
  const recall = want.size ? hit.length / want.size : got.size === 0 ? 1 : 0;
  const precision = got.size ? hit.length / got.size : want.size === 0 ? 1 : 0;
  const exactSet = hit.length === want.size && got.size === want.size;
  const counts = hit.every((k) => got.get(k) === want.get(k));
  const h = o.habits;
  const habits =
    !!h && h.rushed === gold.habits.rushed && h.slow === gold.habits.slow && h.desmos === gold.habits.desmos;
  const mongolian = typeof o.summary === 'string' && mongolianShare(o.summary) >= 0.6;
  return {
    json: true,
    recall,
    precision,
    exactSet,
    counts,
    habits,
    mongolian,
    pass: exactSet && counts && habits && mongolian,
  };
}
