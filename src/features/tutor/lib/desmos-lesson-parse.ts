// Checks a Desmos lesson written by Suu (the fine-tuned model) before a student sees it.
// The model answers in the JSON format of the training kit (sat_desmos_kit):
//   {"technique": "...", "steps": [{"text", "desmos": [...], "bounds"}], "check": "...", "answer": "..."}
// A lesson is only shown when the JSON is valid, every Desmos item has a known safe shape, the text is
// Mongolian, and the final answer matches the correct answer. Otherwise the page falls back to the samples.
import { z } from 'zod';
import type { DesmosAiLesson, DesmosItem, DesmosStep } from './desmos-lessons';

/** Mongolian titles for the 16 Desmos techniques of the training kit. */
export const TECHNIQUE_TITLES: Record<string, string> = {
  intersection_equation: 'Огтлолцол',
  system_intersection: 'Тэгшитгэлийн систем',
  quadratic_zeros: 'Тэгүүд (x-тэнхлэг)',
  max_min: 'Хамгийн их / бага утга',
  slider_constant: 'Slider (тогтмол k)',
  linear_regression: 'Хүснэгт + шугаман регресс',
  exponential_regression: 'Хүснэгт + илтгэгч регресс',
  statistics: 'Жагсаалт + статистик',
  inequality_system: 'Тэнцэтгэл бишийн муж',
  circle: 'Тойрог',
  function_eval: 'Функцийн утга f(a)',
  function_input: 'f(x) = k-ийн x',
  equivalent_expressions: 'Тэнцүү илэрхийлэл',
  distance_midpoint: 'Зай ба дундаж цэг',
  percent: 'Хувь',
  number_theory: 'ЭБХ, ХБЕХ, үлдэгдэл',
};

export const LIMITS = {
  steps: 8,
  text: 400,
  items: 8,
  latex: 200,
  label: 40,
  columns: 4,
  values: 20,
} as const;

const COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'black'] as const;
const short = (n: number) => z.string().trim().min(1).max(n);
const cell = z.union([z.string().max(20), z.number().finite()]).transform(String);

const Table = z.object({
  type: z.literal('table'),
  columns: z
    .array(z.object({ latex: short(LIMITS.label), values: z.array(cell).max(LIMITS.values) }))
    .min(1)
    .max(LIMITS.columns),
});

const Expression = z.object({
  latex: short(LIMITS.latex),
  color: z.string().optional(),
  label: z.union([z.string(), z.number()]).transform(String).optional(),
  showLabel: z.boolean().optional(),
  sliderBounds: z
    .object({ min: z.coerce.string(), max: z.coerce.string(), step: z.coerce.string() })
    .optional(),
  lineStyle: z.string().optional(),
  hidden: z.boolean().optional(),
});

const Bounds = z
  .object({
    left: z.number().finite(),
    right: z.number().finite(),
    bottom: z.number().finite(),
    top: z.number().finite(),
  })
  .refine((b) => b.left < b.right && b.bottom < b.top, 'empty bounds');

const Step = z.object({
  text: short(LIMITS.text),
  desmos: z.array(z.unknown()).max(LIMITS.items).default([]),
  bounds: z.unknown().optional(),
});

const Lesson = z.object({
  technique: z.string().optional(),
  steps: z.array(Step).min(1).max(LIMITS.steps),
  check: z.union([z.string(), z.number()]).transform(String).default(''),
  answer: z.union([z.string(), z.number()]).transform(String),
});

/** The JSON object in the model's reply (code fences and text around it are allowed). */
export function extractJson(text: string): unknown {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const i = t.indexOf('{');
    const j = t.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try {
      return JSON.parse(t.slice(i, j + 1));
    } catch {
      return null;
    }
  }
}

const NUM = /-?\d+(?:\.\d+)?(?:\/\d+)?/g;
type NormAnswer = { kind: 'letter' | 'num' | 'point' | 'text'; value: string | number | number[] };

const toNumber = (n: string) => {
  const [a, b] = n.split('/');
  const v = b ? Number(a) / Number(b) : Number(a);
  return Math.round(v * 1e6) / 1e6;
};

/** Same rules as the training kit's norm_answer: letter (A–D), point, number, or plain text. */
export function normAnswer(answer: string): NormAnswer {
  const a = answer.trim().replace(/[−–]/g, '-');
  const letter = /^\(?([A-D])\)?\.?$/.exec(a);
  if (letter) return { kind: 'letter', value: letter[1] };
  const nums = a.match(NUM);
  if (!nums) return { kind: 'text', value: a.toLowerCase() };
  const vals = nums.map(toNumber);
  if (vals.length === 2 && a.includes('(')) return { kind: 'point', value: vals };
  return { kind: 'num', value: vals[0] };
}

export function answersMatch(a: string, b: string): boolean {
  const x = normAnswer(a);
  const y = normAnswer(b);
  if (x.kind !== y.kind) return false;
  if (x.kind === 'num') return Math.abs((x.value as number) - (y.value as number)) < 1e-6;
  return JSON.stringify(x.value) === JSON.stringify(y.value);
}

const IGNORE = new Set(['desmos', 'slider', 'table', 'mean', 'median', 'distance', 'midpoint', 'lcm', 'gcd']);
const IGNORE_MORE = new Set(['mod', 'max', 'min', 'stdev', 'sqrt']);

/** Share of real words that are Mongolian (math, English terms in brackets and Desmos names are ignored). */
export function mongolianRatio(texts: string[]): number {
  const s = texts.join(' ').replace(/\([^()]*\)/g, ' ');
  const words = (s.match(/[A-Za-zА-Яа-яЁёӨөҮү]{3,}/g) ?? []).filter(
    (w) => !IGNORE.has(w.toLowerCase()) && !IGNORE_MORE.has(w.toLowerCase()),
  );
  if (!words.length) return 0;
  return words.filter((w) => /^[А-Яа-яЁёӨөҮү]/.test(w)).length / words.length;
}

/** Keeps only the Desmos item fields the page draws, with safe values. Null when the item is unusable. */
export function cleanItem(raw: unknown): DesmosItem | null {
  const table = Table.safeParse(raw);
  if (table.success) return { type: 'table', columns: table.data.columns };
  const e = Expression.safeParse(raw);
  if (!e.success) return null;
  const item: DesmosItem = { latex: e.data.latex };
  if (e.data.color && (COLORS as readonly string[]).includes(e.data.color)) {
    item.color = e.data.color as DesmosItem['color'];
  }
  if (e.data.label) {
    item.label = e.data.label.slice(0, LIMITS.label);
    item.showLabel = e.data.showLabel !== false;
  }
  if (e.data.sliderBounds) item.sliderBounds = e.data.sliderBounds;
  if (e.data.lineStyle === 'DASHED') item.lineStyle = 'DASHED';
  return item;
}

export type ParseResult =
  | { ok: true; lesson: DesmosAiLesson; technique: string | null }
  | { ok: false; reason: 'json' | 'schema' | 'items' | 'mongolian' | 'answer' };

/**
 * Turns the model's reply into a lesson the page can draw.
 * `answer` is the correct answer the model was given; the lesson must end with the same answer.
 */
export function parseModelLesson(text: string, question: string, answer: string): ParseResult {
  const json = extractJson(text);
  if (!json || typeof json !== 'object') return { ok: false, reason: 'json' };
  const parsed = Lesson.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'schema' };
  const o = parsed.data;

  const steps: DesmosStep[] = [];
  for (const s of o.steps) {
    const items = s.desmos.map(cleanItem);
    if (items.some((i) => i === null)) return { ok: false, reason: 'items' };
    const step: DesmosStep = { text: s.text, desmos: items as DesmosItem[] };
    const b = Bounds.safeParse(s.bounds);
    if (b.success) step.bounds = b.data;
    steps.push(step);
  }
  if (!steps.some((s) => s.desmos.length)) return { ok: false, reason: 'items' };
  if (mongolianRatio(steps.map((s) => s.text)) < 0.6) return { ok: false, reason: 'mongolian' };
  if (!answersMatch(o.answer, answer)) return { ok: false, reason: 'answer' };

  const technique = o.technique && TECHNIQUE_TITLES[o.technique] ? o.technique : null;
  return {
    ok: true,
    technique,
    lesson: {
      id: 'ai',
      title: technique ? TECHNIQUE_TITLES[technique] : 'Desmos',
      question,
      answer,
      check: o.check,
      match: [],
      steps,
    },
  };
}
