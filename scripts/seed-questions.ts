// Uploads the question bank (src/mocks/questions.ts) to Supabase `questions`.
// Run: bun run seed:questions   (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)
// Safe to re-run: rows are upserted by id, so edited questions are updated and nothing is duplicated.
import { createClient } from '@supabase/supabase-js';
import { QUESTIONS } from '../src/mocks/questions';

type QuestionRow = {
  id: string;
  domain: (typeof QUESTIONS)[number]['domain'];
  difficulty: (typeof QUESTIONS)[number]['difficulty'];
  content: (typeof QUESTIONS)[number];
};

const DOMAINS = new Set(['alg', 'adv', 'psda', 'geo']);

function getSeedConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Writes need the server-only secret key; the public key can only read.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL болон SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна (.env.local).',
    );
  }
  return { url, key };
}

async function seedQuestions() {
  const { url, key } = getSeedConfig();
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const rows: QuestionRow[] = QUESTIONS.map((q) => ({
    id: q.id,
    domain: q.domain,
    difficulty: q.difficulty,
    content: q,
  }));

  // the same checks the table enforces, so a bad row fails here with a clear message
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) throw new Error('Question ID давхардсан байна.');
  for (const r of rows) {
    if (!DOMAINS.has(r.domain)) throw new Error(`${r.id}: domain буруу (${r.domain}).`);
    if (![1, 2, 3].includes(r.difficulty)) throw new Error(`${r.id}: difficulty 1–3 байх ёстой.`);
  }

  console.log(`Seed бэлэн: ${rows.length} асуулт.`);
  const { error } = await db.from('questions').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Questions seed алдаа: ${error.message}`);

  const { count, error: countError } = await db
    .from('questions')
    .select('id', { count: 'exact', head: true });
  if (countError) throw new Error(`Тоолж чадсангүй: ${countError.message}`);
  console.log(`Questions seed амжилттай! Supabase дээр одоо ${count} асуулт байна.`);
}

seedQuestions().catch((error: unknown) => {
  console.error('Questions seed амжилтгүй:', error);
  process.exitCode = 1;
});
