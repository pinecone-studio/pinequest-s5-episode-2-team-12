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
  const prompt = q.prompt.replace(/(?<!\\)\$/g, '').trim();
  const choices = q.choices?.map((c, i) => `${letter(i)}) ${c.replace(/(?<!\\)\$/g, '').trim()}`) ?? [];
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

/** Every number in a text or Desmos LaTeX: "\\frac{33}{2}" and "33/2" count as 16.5, "−4" as -4. */
function numbersIn(text: string): number[] {
  const s = text.replace(/\\(?:d|t)?frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2').replace(/[−–]/g, '-');
  return (s.match(/-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?/g) ?? []).map((n) => {
    const [a, b] = n.split('/');
    return Math.round((b ? Number(a) / Number(b) : Number(a)) * 1e6) / 1e6;
  });
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * The first step that gives the answer away. Many lessons say the result before the end ("Desmos шууд -76
 * гэж бодно" in step 2 of 3), so locking only the last step is not enough. A step reveals a number answer when
 * its text or Desmos items contain that number and the question doesn't (numbers in the question are given,
 * like the 5 in "3x + 5 = 20"); a point answer when both coordinates appear as a point. Letter answers and
 * anything unclear: the last step.
 */
export function revealStep(lesson: DesmosAiLesson): number {
  const last = Math.max(lesson.steps.length - 1, 0);
  const answer = numbersIn(lesson.answer);
  const isPoint = answer.length === 2 && lesson.answer.includes('(');
  if (answer.length !== 1 && !isPoint) return last;
  // the choices ("C) 96") hold the answer itself, so only the question text counts as given
  const given = numbersIn(lesson.question.replace(/^\(?[A-D]\)[^\n]*$/gm, ''));
  for (let i = 0; i < last; i++) {
    const step = lesson.steps[i];
    const blob = [step.text, ...step.desmos.flatMap((d) => [d.latex ?? '', d.label ?? ''])].join(' ');
    if (isPoint) {
      const flat = blob.replace(/\\left|\\right|\s/g, '');
      const pts = [...flat.matchAll(/\((-?[\d./]+),(-?[\d./]+)\)/g)].map((m) => numbersIn(`${m[1]} ${m[2]}`));
      if (pts.some((p) => p.length === 2 && near(p[0], answer[0]) && near(p[1], answer[1]))) return i;
    } else if (!given.some((g) => near(g, answer[0])) && numbersIn(blob).some((n) => near(n, answer[0]))) {
      return i;
    }
  }
  return last;
}

/**
 * How many steps the panel shows. Before the student answers, everything from the step that gives the answer
 * away is locked (and not drawn); after, every step.
 */
export function visibleSteps(lesson: DesmosAiLesson, revealed: boolean): number {
  return revealed ? lesson.steps.length : revealStep(lesson);
}
