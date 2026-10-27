// Section C · reads for the official SAT question bank (Supabase `sat_math_questions`, readable by everyone).
import { getDb } from '@/lib/supabase/server';
import {
  cleanSearch,
  difficultyName,
  mapOfficialRow,
  OFFICIAL_COLUMNS,
  OFFICIAL_DOMAINS,
  OFFICIAL_PAGE_SIZE,
  OFFICIAL_TABLE,
  type OfficialFilter,
  type OfficialPage,
  type OfficialRow,
} from './lib/official';

/** One page of official questions, or null when Supabase or the table is unavailable (→ the mock bank). */
export async function listOfficialQuestions(filter: OfficialFilter): Promise<OfficialPage | null> {
  const db = await getDb();
  if (!db) return null;

  const from = (filter.page - 1) * OFFICIAL_PAGE_SIZE;
  let query = db
    .from(OFFICIAL_TABLE)
    .select(OFFICIAL_COLUMNS, { count: 'exact' })
    .order('domain_rank')
    .order('skill')
    .order('difficulty_rank')
    .order('id')
    .range(from, from + OFFICIAL_PAGE_SIZE - 1);

  if (filter.domain) query = query.eq('domain', OFFICIAL_DOMAINS[filter.domain]);
  if (filter.skill) query = query.eq('skill', filter.skill);
  if (filter.difficulty) query = query.eq('difficulty', difficultyName(filter.difficulty));
  const search = filter.search ? cleanSearch(filter.search) : '';
  if (search) query = query.ilike('question_text', `%${search}%`);

  const { data, error, count } = await query;
  if (error) {
    console.error('[bank] official questions unavailable:', error.message);
    return null;
  }

  const total = count ?? 0;
  const bankTotal = await countOfficialQuestions(db, filter, total);
  return {
    bankTotal,
    questions: ((data ?? []) as OfficialRow[]).map(mapOfficialRow),
    total,
    page: filter.page,
    pageCount: Math.max(1, Math.ceil(total / OFFICIAL_PAGE_SIZE)),
  };
}

/** Size of the whole bank for the header (skips the extra query when nothing is filtered). */
async function countOfficialQuestions(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  filter: OfficialFilter,
  filteredTotal: number,
): Promise<number> {
  if (!filter.domain && !filter.skill && !filter.difficulty && !filter.search) return filteredTotal;
  const { count } = await db.from(OFFICIAL_TABLE).select('id', { count: 'exact', head: true });
  return count ?? filteredTotal;
}
