// Component tests never contact Supabase. Server validation/persistence is tested separately.
import { mock } from 'bun:test';
import type { RetryQuestion } from '@/features/mistakes/lib/submission';

export const answerTransport = {
  fail: false,
  failLoad: false,
  calls: [] as { qid: string; questionSource: string; answer: string }[],
  questions: [] as RetryQuestion[],
  storage: 'demo' as 'demo' | 'server',
};
mock.module('@/features/mistakes/submission-actions', () => ({
  submitQuestionAnswer: async (input: { qid: string; questionSource: string; answer: string }) => {
    answerTransport.calls.push(input);
    if (answerTransport.fail) return { ok: false, error: 'Test save failed' };
    return {
      ok: true,
      correct: ['0', 'A', '403', '403.0', '5'].includes(input.answer),
      storage: answerTransport.storage,
    };
  },
  loadRetryQuestions: async () => {
    if (answerTransport.failLoad) throw new Error('Load failed');
    return answerTransport.questions;
  },
}));
export function resetAnswerTransport() {
  answerTransport.fail = false;
  answerTransport.failLoad = false;
  answerTransport.calls = [];
  answerTransport.questions = [];
  answerTransport.storage = 'demo';
  sessionStorage.clear();
}
