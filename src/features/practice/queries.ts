// Section C · reads.
import { getDb } from '@/lib/supabase/server';
import { QUESTIONS } from '@/mocks/questions';
import { getQuestionsDb, getQuestionsTable } from '@/server/db';
import type { Question, QuestionFilter } from '@/types';
import { filterQuestions } from './lib/filter-questions';

/** Logged once per error message so a misconfigured project doesn't flood the dev console. */
const warned = new Set<string>();
function warnBank(error: { message: string }) {
  if (warned.has(error.message)) return;
  warned.add(error.message);
  console.warn(
    `[practice] questions table unreadable (${error.message}); showing sample questions. ` +
      'Set SUPABASE_SERVICE_ROLE_KEY and, on the legacy project, SUPABASE_QUESTIONS_TABLE=learning_questions.',
  );
}

export async function listQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
  return (await listQuestionsWithSource(filter)).questions;
}

export async function listQuestionsWithSource(
  filter: QuestionFilter = {},
): Promise<{ questions: Question[]; source: 'supabase' | 'mock' }> {
  const db = await getQuestionsDb();

  if (!db) {
    return { questions: filterQuestions(QUESTIONS, filter), source: 'mock' };
  }

  let query = db.from(getQuestionsTable()).select('content').eq('reviewed', true);

  if (filter.domain) {
    query = query.eq('domain', filter.domain);
  }

  if (filter.difficulty) {
    query = query.eq('difficulty', filter.difficulty);
  }

  const { data, error } = await query;

  // e.g. no service-role key (the table is admin-only since 0009) or a legacy table without `content`
  if (error) {
    warnBank(error);
    return { questions: filterQuestions(QUESTIONS, filter), source: 'mock' };
  }

  return {
    questions: filterQuestions(
      (data ?? []).map((row) => row.content as Question),
      filter,
    ),
    source: 'supabase',
  };
}

export async function getQuestion(id: string): Promise<Question | null> {
  const db = await getQuestionsDb();

  if (!db) {
    return QUESTIONS.find((question) => question.id === id) ?? null;
  }

  const { data, error } = await db
    .from(getQuestionsTable())
    .select('content')
    .eq('id', id)
    .eq('reviewed', true)
    .maybeSingle();

  if (error) {
    warnBank(error);
    return QUESTIONS.find((question) => question.id === id) ?? null;
  }

  return (data?.content as Question) ?? null;
}

export async function getSaved(userId: string): Promise<string[]> {
  const db = await getDb();

  if (!db) return [];

  const { data, error } = await db.from('saved_questions').select('question_id').eq('user_id', userId);

  // No migration creates saved_questions yet; treat a missing table as "nothing saved".
  if (error) return [];

  return (data ?? []).map((row) => row.question_id as string);
}
