import type { OfficialQuestion } from './official';

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
