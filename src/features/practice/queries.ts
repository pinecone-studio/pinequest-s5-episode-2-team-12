// Section C · reads.
import { getDb } from '@/lib/supabase/server';
import { QUESTIONS } from '@/mocks/questions';
import { getQuestionsDb } from '@/server/db';
import type { Question, QuestionFilter } from '@/types';
import { filterQuestions } from './lib/filter-questions';

export async function listQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
  const db = await getQuestionsDb();

  if (!db) {
    return filterQuestions(QUESTIONS, filter);
  }

  let query = db.from('questions').select('content').eq('reviewed', true);

  if (filter.domain) {
    query = query.eq('domain', filter.domain);
  }

  if (filter.difficulty) {
    query = query.eq('difficulty', filter.difficulty);
  }

  const { data, error } = await query;

  if (error) throw error;

  return filterQuestions(
    (data ?? []).map((row) => row.content as Question),
    filter,
  );
}

export async function getQuestion(id: string): Promise<Question | null> {
  const db = await getQuestionsDb();

  if (!db) {
    return QUESTIONS.find((question) => question.id === id) ?? null;
  }

  const { data, error } = await db
    .from('questions')
    .select('content')
    .eq('id', id)
    .eq('reviewed', true)
    .maybeSingle();

  if (error) throw error;

  return (data?.content as Question) ?? null;
}

export async function getSaved(userId: string): Promise<string[]> {
  const db = await getDb();

  if (!db) return [];

  const { data, error } = await db.from('saved_questions').select('question_id').eq('user_id', userId);

  if (error) throw error;

  return (data ?? []).map((row) => row.question_id as string);
}
