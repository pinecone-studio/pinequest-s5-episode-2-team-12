// Grading one answer. Shared by the players (instant feedback) and the server actions (re-check).
import { checkChoiceAnswer, checkGridInAnswer } from '@/lib/check-answer';
import type { Question } from '@/types';

export const isMcq = (q: Question) => (q.format ? q.format === 'mcq' : Array.isArray(q.choices));

/** `answer` is the choice index as a string for MCQ, or the typed value for SPR. */
export function isCorrect(q: Question, answer: string): boolean {
  if (isMcq(q)) {
    if (!/^\d$/.test(answer.trim())) return false;
    return typeof q.answer === 'number' && checkChoiceAnswer(Number(answer), q.answer);
  }
  return Array.isArray(q.answer) && checkGridInAnswer(answer, q.answer);
}

/** The correct answer as shown to the student: «B) $5$» or «3/4». */
export function correctAnswerText(q: Question): string {
  if (isMcq(q) && typeof q.answer === 'number') return `${'ABCD'[q.answer]}) ${q.choices?.[q.answer] ?? ''}`;
  return Array.isArray(q.answer) ? q.answer[0] : '';
}
