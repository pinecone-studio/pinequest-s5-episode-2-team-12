// The line the server adds after a student's answer when it has graded it with code (question bank answer).
// Suu v3's chat data has the exact same line (ai/train/export.ts), so Suu learns to *follow* the verdict
// instead of guessing it — v2 guessed "correct" for 90% of wrong answers.
export const VERDICT = { right: '(Шалгагч: зөв)', wrong: '(Шалгагч: буруу)' } as const;

/** Adds the verdict line when the answer was graded (null = not graded, message unchanged). */
export function withVerdict(message: string, correct: boolean | null): string {
  if (correct === null) return message;
  return `${message.trimEnd()}\n\n${correct ? VERDICT.right : VERDICT.wrong}`;
}
