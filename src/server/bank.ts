// Every question the server can grade, by id: the roadmap bank (stops + placement, also used by mocks,
// daily and duels) and the older practice bank. Server-only — answers live here.
import { mockBank } from '@/features/exam/engine';
import { QUESTIONS } from '@/mocks/questions';
import type { Question } from '@/types';

let all: Map<string, Question> | null = null;

export function questionById(id: string): Question | undefined {
  if (!all) {
    all = new Map(mockBank().bank);
    for (const q of QUESTIONS) if (!all.has(q.id)) all.set(q.id, q);
  }
  return all.get(id);
}
