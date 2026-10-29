// Server-only. Asks Suu to write a step-by-step Desmos lesson for a SAT question.
// The Desmos skill was trained with the correct answer in the prompt ("Зөв хариу: …") and teaches *how* to get
// it in Desmos. When the student doesn't know the answer, Gemini (or else Suu's chat skill) solves the question
// first, and the page says the answer came from the AI. Every lesson goes through parseModelLesson before it is shown.

import { normAnswer, parseModelLesson } from '@/features/tutor/lib/desmos-lesson-parse';
import type { DesmosAiLesson } from '@/features/tutor/lib/desmos-lessons';
import { geminiSolve, hasGeminiChat } from './gemini-chat';
import { type ChatMessage, hasOllama, ollamaChat } from './ollama-client';
import { CHAT_PROMPT, DESMOS_PROMPT, desmosUserMessage, EXPLAIN_ASK } from './prompts';

export type ModelLesson = {
  lesson: DesmosAiLesson;
  technique: string | null;
  /** 'student': the answer was typed by the student. 'model': Suu solved the question first. */
  answerFrom: 'student' | 'model';
};

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

/** A checked lesson from the model, or null (model off, too slow, or every try failed the checks). */
export async function modelDesmosLesson(
  question: string,
  answer?: string,
  fetchImpl: typeof fetch = fetch,
  budgetMs = LESSON_BUDGET_MS,
): Promise<ModelLesson | null> {
  const deadline = Date.now() + budgetMs;
  const left = () => deadline - Date.now();
  let correct = answer?.trim() ?? '';
  let answerFrom: ModelLesson['answerFrom'] = 'student';
  if (!hasOllama('desmos')) return null;
  if (correct && !checkableAnswer(correct)) return null;

  if (!correct) {
    // No answer from the student: Gemini solves it (the stronger solver), else Suu's chat skill. Suu then only
    // teaches how to reach that answer in Desmos, which is what it was trained for.
    let solved: string | null = null;
    if (hasGeminiChat()) {
      const reply = await geminiSolve(question, fetchImpl, Math.min(20_000, left() - MIN_CALL_MS));
      solved = reply ? answerFromExplanation(reply) : null;
    }
    if (!solved && hasOllama('chat') && left() > MIN_CALL_MS) {
      const explanation = await ollamaChat(
        [
          { role: 'system', content: CHAT_PROMPT },
          { role: 'user', content: `${question.trim()}\n\n${EXPLAIN_ASK}` },
        ],
        { temperature: 0, maxTokens: 700, timeoutMs: Math.min(25_000, left() - MIN_CALL_MS) },
        fetchImpl,
      );
      solved = explanation ? answerFromExplanation(explanation) : null;
    }
    if (!solved) return null;
    correct = solved;
    answerFrom = 'model';
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: DESMOS_PROMPT },
    { role: 'user', content: desmosUserMessage(question, correct) },
  ];
  // greedy first (what the scores were measured with), then one sampled retry if there is time left
  for (const temperature of [0, 0.4]) {
    if (left() < MIN_CALL_MS) return null;
    const reply = await ollamaChat(messages, { ...DESMOS_OPTS, temperature, timeoutMs: left() }, fetchImpl);
    if (!reply) return null; // model off, down or too slow: no point retrying
    const parsed = parseModelLesson(reply, question.trim(), correct);
    if (parsed.ok) return { lesson: parsed.lesson, technique: parsed.technique, answerFrom };
  }
  return null;
}
