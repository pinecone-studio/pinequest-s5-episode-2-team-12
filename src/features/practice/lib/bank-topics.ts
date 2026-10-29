import type { Domain, Question } from '@/types';

export const HARD_TOPICS = [
  { id: 'alg', label: 'Алгебр' },
  { id: 'fractions', label: 'Энгийн бутархай' },
  { id: 'adv', label: 'Ахисан математик' },
  { id: 'psda', label: 'Өгөгдөл ба бодлого' },
  { id: 'geo', label: 'Геометр' },
] as const;

export type HardTopic = Domain | 'fractions';

/** Fractions use skill metadata because the bank has no separate fractions domain. */
export function hardTopicQuestions<T extends Pick<Question, 'domain' | 'skill' | 'difficulty'>>(
  questions: T[],
  topic: HardTopic,
): T[] {
  return questions.filter((question) => {
    if (question.difficulty !== 3) return false;
    return topic === 'fractions'
      ? /\b(fractions?|rational expressions?)\b|бутархай/i.test(question.skill)
      : question.domain === topic;
  });
}
