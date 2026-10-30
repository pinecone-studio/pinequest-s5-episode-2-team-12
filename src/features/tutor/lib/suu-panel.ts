// What the «AI багш Суу» side panel (next to a problem) sends to Суу. Pure functions: safe on the server
// and in the browser.
import type { Question, TutorMode } from '@/types';

/** The tutor API takes 2000 characters; leave room for the student's answer and a typed question. */
export const PROBLEM_MAX = 1500;

const letter = (i: number) => String.fromCharCode(65 + i);

/** A bank problem as Суу reads it: the prompt, then the choices as "A) …" lines. */
export function questionProblem(q: Question): string {
  const choices = q.choices?.map((c, i) => `${letter(i)}) ${c}`) ?? [];
  return [q.prompt, ...choices].join('\n').slice(0, PROBLEM_MAX);
}

/** The student's answer in words: "B) 12" for a choice index, the typed value for grid-in. */
export function chosenText(q: Question, value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (!q.choices) return v;
  const i = Number(v);
  const choice = Number.isInteger(i) ? q.choices[i] : undefined;
  return choice === undefined ? undefined : `${letter(i)}) ${choice}`;
}

/** Quick actions in the panel. Desmos has its own panel, so it is not repeated here. */
export const PANEL_MODES: TutorMode[] = ['hint', 'explain', 'similar', 'translate'];

/** Quick actions that walk through the whole solution: locked until the student has answered. */
export const SOLUTION_MODES: ReadonlySet<TutorMode> = new Set(['explain']);
