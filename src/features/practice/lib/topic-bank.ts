import type { Question } from '@/types';
import type { OfficialFilter, OfficialPage, OfficialQuestion } from './official';

/** All pages are required: a failed later page must never become a misleading partial count. */
export async function collectOfficialHardQuestions(
  readPage: (filter: OfficialFilter, pageSize: number) => Promise<OfficialPage | null>,
): Promise<OfficialQuestion[] | null> {
  const questions: OfficialQuestion[] = [];
  let pageCount = 1;
  for (let page = 1; page <= pageCount; page++) {
    const result = await readPage({ difficulty: 3, page }, 500);
    if (!result) return null;
    questions.push(...result.questions.filter((question) => question.difficulty === 3));
    pageCount = result.pageCount;
  }
  return [...new Map(questions.map((question) => [question.id, question])).values()];
}

export function officialSolveIssue(question: OfficialQuestion): string | null {
  if (question.format === 'unsupported') return 'Энэ асуултын хэлбэр одоогоор дэмжигдээгүй.';
  if (!question.promptHtml.trim()) return 'Асуултын өгөгдөл дутуу байна.';
  if (
    question.format === 'mcq' &&
    (!question.choices.length || !question.choices.some((choice) => choice.label === question.answer))
  ) {
    return 'Хариултын сонголт эсвэл зөв хариултын өгөгдөл дутуу байна.';
  }
  if (question.format === 'spr' && !question.accepted.length) return 'Зөв хариултын өгөгдөл дутуу байна.';
  return null;
}

/** Sample fallbacks stay available in legacy practice, but never masquerade as real bank items here. */
export function realPracticeQuestions(bank: {
  questions: Question[];
  source: 'supabase' | 'mock';
}): Question[] {
  return bank.source === 'supabase' ? bank.questions.filter((question) => question.difficulty === 3) : [];
}
