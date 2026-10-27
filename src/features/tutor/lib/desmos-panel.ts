// What the Desmos side panel (the cat «Desmos» button next to a problem) sends to Суу, and how much of the
// lesson it shows before the student has answered. Pure functions: safe on the server and in the browser.
import type { DesmosPanelInput, Question } from '@/types';
import type { DesmosAiLesson } from './desmos-lessons';

export type { DesmosPanelInput };

/** Same limit as POST /api/desmos/lesson. */
export const PANEL_QUESTION_MAX = 1200;

/** "$\frac{33}{2}$" → "33/2", "$(2, 5)$" → "(2, 5)", "$-4$" → "-4"; null when it isn't a plain value. */
export function plainValue(text: string): string | null {
  const s = text
    .replace(/\$/g, '')
    .replace(/\\(?:d|t)?frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2')
    .replace(/\\left|\\right|\\,|\\!/g, '')
    .replace(/−/g, '-')
    .trim();
  const num = String.raw`-?\d+(?:\.\d+)?(?:\/\d+)?`;
  if (new RegExp(`^${num}$`).test(s)) return s;
  const point = new RegExp(`^\\(\\s*(${num})\\s*,\\s*(${num})\\s*\\)$`).exec(s);
  return point ? `(${point[1]}, ${point[2]})` : null;
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** The side panel's input for a bank question. */
export function panelInput(q: Question): DesmosPanelInput {
  const prompt = q.prompt.replace(/\$/g, '').trim();
  const choices = q.choices?.map((c, i) => `${letter(i)}) ${c.replace(/\$/g, '').trim()}`) ?? [];
  const question = [prompt, ...choices].join('\n').slice(0, PANEL_QUESTION_MAX);
  let answer: string | undefined;
  if (typeof q.answer === 'number') {
    const choice = q.choices?.[q.answer];
    if (choice !== undefined) answer = plainValue(choice) ?? letter(q.answer);
  } else {
    answer = q.answer[0]?.trim() || undefined;
  }
  return {
    question,
    ...(answer ? { answer } : {}),
    ...(q.desmos?.rows.length ? { rows: q.desmos.rows } : {}),
    ...(q.desmos?.tip ? { tip: q.desmos.tip } : {}),
  };
}

/**
 * How many steps the panel shows. Before the student answers, the last step (where the lesson reaches the
 * answer) stays locked; after, every step. A one-step lesson shows nothing until then.
 */
export function visibleSteps(lesson: DesmosAiLesson, revealed: boolean): number {
  return revealed ? lesson.steps.length : Math.max(lesson.steps.length - 1, 0);
}
