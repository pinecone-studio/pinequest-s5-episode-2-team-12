// Server-only. Asks Suu to write a step-by-step Desmos lesson for a SAT question.
// The Desmos skill was trained with the correct answer in the prompt ("Зөв хариу: …") and teaches *how* to get
// it in Desmos. When the student doesn't know the answer, the chat skill solves the question first (2–3 times;
// only an answer two solves agree on is taught — solveByVote), and the
// page says that the answer came from Suu. Every lesson goes through parseModelLesson before it is shown.

import { answersMatch, normAnswer, parseModelLesson } from '@/features/tutor/lib/desmos-lesson-parse';
import type { DesmosAiLesson } from '@/features/tutor/lib/desmos-lessons';
import { type ChatMessage, hasOllama, ollamaChat } from './ollama-client';
import { CHAT_PROMPT, DESMOS_PROMPT, desmosUserMessage, EXPLAIN_ASK } from './prompts';
import { type Hit, similarExamples } from './rag/retrieve';

export type ModelLesson = {
  lesson: DesmosAiLesson;
  technique: string | null;
  /** 'student': the answer was typed by the student. 'model': Suu solved the question first. */
  answerFrom: 'student' | 'model';
  /** Library lessons Suu was shown as worked examples (RAG), most similar first. */
  examples: { id: string; technique: string; score: number }[];
};

/**
 * RAG: the retrieved lessons go in as earlier turns of the same conversation — the exact format Suu was
 * fine-tuned on (question + correct answer → lesson JSON) — so Suu sees how this kind of problem is solved in
 * Desmos before writing its own lesson. An example with the very same question is skipped (it would just be copied).
 */
export function lessonMessages(question: string, answer: string, hits: Hit[]): ChatMessage[] {
  const same = (q: string) =>
    q.replace(/\s+/g, ' ').trim().toLowerCase() === question.replace(/\s+/g, ' ').trim().toLowerCase();
  const shots = hits
    .filter((h) => !same(h.question))
    .flatMap((h): ChatMessage[] => [
      { role: 'user', content: desmosUserMessage(h.question, h.answer) },
      { role: 'assistant', content: h.lesson },
    ]);
  return [
    { role: 'system', content: DESMOS_PROMPT },
    ...shots,
    { role: 'user', content: desmosUserMessage(question, answer) },
  ];
}

/**
 * The final answer from a chat explanation ("…\n\nХариу: A) $5$" → "A"; "Хариу: $\frac{33}{2}$" → "33/2").
 * Null when there is no answer line or the answer isn't a letter, a number or a point (Desmos lessons check those).
 */
export function answerFromExplanation(text: string): string | null {
  const lines = [...text.matchAll(/Хариу:\s*(.+)/g)];
  const raw = lines.at(-1)?.[1]?.trim();
  if (!raw) return null;
  const letter = /^\(?([A-D])\)/.exec(raw);
  if (letter) return letter[1];
  const plain = raw
    .replace(/\$/g, '')
    .replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2')
    .replace(/\\left|\\right|\\,|\\%|%/g, '')
    .replace(/^[a-zA-Z]\s*=\s*/, '')
    .replace(/[.。]$/, '')
    .trim();
  if (/\\|[a-zA-Z]{2,}/.test(plain)) return null; // sqrt, pi, words: not a checkable answer
  if (/^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(plain)) return plain;
  const point = /^\(\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)$/.exec(plain);
  return point ? `(${point[1]}, ${point[2]})` : null;
}

/** Answers the Desmos lessons can check: a choice letter, a number/fraction or a point. */
export function checkableAnswer(answer: string): boolean {
  const a = answer.trim();
  if (!a || a.length > 40) return false;
  return normAnswer(a).kind !== 'text';
}

const DESMOS_OPTS = { json: true, temperature: 0, maxTokens: 1200 } as const;
/** Whole request budget: the route allows 60 s (maxDuration) and a laptop writes a lesson in ~10–30 s. */
export const LESSON_BUDGET_MS = 55_000;
/** Don't start a model call with less time than this left. */
const MIN_CALL_MS = 12_000;

/** Self-check: how many solves must agree before Suu's own answer is taught (SELF_CHECK=0 turns it off). */
export const solveVotes = () => (process.env.SELF_CHECK === '0' ? 1 : 2);
/** Greedy first, then sampled: a 3B model that is unsure gives different answers on different samples. */
const SOLVE_TEMPS = [0, 0.6, 0.6] as const;
/** A solve plus the lesson after it must still fit in the budget. */
const MIN_SOLVE_MS = 8_000;

export type Vote = { answer: string; agreed: number; tries: number };

/**
 * Self-consistency check for the answer Suu teaches when the student didn't give one: solve the question up to
 * three times and accept an answer only when two solves agree. One confident-but-wrong solve no longer turns into
 * a whole lesson that "proves" a wrong answer. Null when no two solves agree, the model is down, or time is short.
 */
export async function solveByVote(
  question: string,
  fetchImpl: typeof fetch,
  left: () => number,
  need = solveVotes(),
): Promise<Vote | null> {
  const answers: string[] = [];
  let tries = 0;
  for (const temperature of SOLVE_TEMPS.slice(0, need === 1 ? 1 : SOLVE_TEMPS.length)) {
    if (left() < MIN_SOLVE_MS + MIN_CALL_MS) break;
    tries++;
    const explanation = await ollamaChat(
      [
        { role: 'system', content: CHAT_PROMPT },
        { role: 'user', content: `${question.trim()}\n\n${EXPLAIN_ASK}` },
      ],
      { temperature, maxTokens: 700, timeoutMs: Math.min(25_000, left() - MIN_CALL_MS) },
      fetchImpl,
    );
    if (!explanation) return null; // model off, down or too slow
    const a = answerFromExplanation(explanation);
    if (!a) continue;
    answers.push(a);
    const agreed = answers.filter((x) => answersMatch(x, a)).length;
    if (agreed >= need) return { answer: a, agreed, tries };
  }
  return null;
}

/** A checked lesson from the model, or null (model off, too slow, or every try failed the checks). */
export async function modelDesmosLesson(
  question: string,
  answer?: string,
  fetchImpl: typeof fetch = fetch,
  budgetMs = LESSON_BUDGET_MS,
  /** The student asked for another lesson: skip the greedy one (they've seen it) and sample instead. */
  another = false,
): Promise<ModelLesson | null> {
  const deadline = Date.now() + budgetMs;
  const left = () => deadline - Date.now();
  let correct = answer?.trim() ?? '';
  let answerFrom: ModelLesson['answerFrom'] = 'student';
  if (!hasOllama('desmos')) return null;
  if (correct && !checkableAnswer(correct)) return null;

  if (!correct) {
    // Solving needs the chat skill; with it off the page asks the student to add the answer.
    if (!hasOllama('chat')) return null;
    const solved = await solveByVote(question, fetchImpl, left);
    if (!solved) return null;
    correct = solved.answer;
    answerFrom = 'model';
  }

  const { hits } = await similarExamples(question, undefined, fetchImpl);
  const messages = lessonMessages(question, correct, hits);
  const examples = hits.map((h) => ({
    id: h.id,
    technique: h.technique,
    score: Math.round(h.score * 100) / 100,
  }));
  // greedy first (what the scores were measured with), then one sampled retry if there is time left
  for (const temperature of another ? [0.7, 0.4] : [0, 0.4]) {
    if (left() < MIN_CALL_MS) return null;
    const reply = await ollamaChat(messages, { ...DESMOS_OPTS, temperature, timeoutMs: left() }, fetchImpl);
    if (!reply) return null; // model off, down or too slow: no point retrying
    const parsed = parseModelLesson(reply, question.trim(), correct);
    if (parsed.ok) return { lesson: parsed.lesson, technique: parsed.technique, answerFrom, examples };
  }
  return null;
}
