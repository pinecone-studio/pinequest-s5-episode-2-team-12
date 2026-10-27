// Imports roadmap questions from JSON or CSV, validates them and upserts them into Supabase `questions`.
//   bun run roadmap:import                       # validate + upload everything under content/roadmap
//   bun run roadmap:import -- path/to/file.csv   # validate + upload one JSON/CSV file
//   … --dry-run                                  # validate only, print a summary
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local) unless --dry-run.
// Re-running is safe: rows are upserted by id. An existing row keeps its `reviewed` flag unless --reset-review.
//
// CSV columns: id,topicId,domain,skill,difficulty,format,pool,prompt,mn,choiceA,choiceB,choiceC,choiceD,
//              answer,explain,hint,desmosRows,desmosTip,verifyValue,verifyVar,verifyEq,author,createdAt
//   answer: choice letter A–D for mcq, or accepted answers separated by "|" for spr; desmosRows by "|".
import { createClient } from '@supabase/supabase-js';
import { type RoadmapQuestion, validateBank } from '../../src/features/roadmap/content/schema';

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, newlines inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export function csvToQuestion(r: Record<string, string>): unknown {
  const mcq = r.format === 'mcq';
  const q: Record<string, unknown> = {
    id: r.id,
    topicId: Number(r.topicId),
    domain: r.domain,
    skill: r.skill,
    difficulty: Number(r.difficulty),
    format: r.format,
    pool: r.pool || 'stop',
    prompt: r.prompt,
    mn: r.mn,
    answer: mcq ? 'ABCD'.indexOf(r.answer.toUpperCase()) : r.answer.split('|').map((s) => s.trim()),
    explain: r.explain,
    hint: r.hint,
    source: 'original',
    reviewed: false,
    author: r.author || 'import',
    createdAt: r.createdAt || new Date().toISOString().slice(0, 10),
  };
  if (mcq) q.choices = [r.choiceA, r.choiceB, r.choiceC, r.choiceD];
  if (r.desmosTip) q.desmos = { rows: r.desmosRows ? r.desmosRows.split('|') : [], tip: r.desmosTip };
  if (r.verifyValue) q.verify = { value: r.verifyValue };
  else if (r.verifyEq) q.verify = { sub: { var: r.verifyVar || 'x', eq: r.verifyEq } };
  return q;
}

async function loadFile(path: string): Promise<unknown[]> {
  const text = await Bun.file(path).text();
  if (path.endsWith('.csv')) return parseCsv(text).map(csvToQuestion);
  const json = JSON.parse(text);
  if (!Array.isArray(json)) throw new Error(`${path}: expected a JSON array`);
  return json;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const resetReview = args.includes('--reset-review');
  const files = args.filter((a) => !a.startsWith('--'));
  const paths = files.length
    ? files
    : (await Array.fromAsync(new Bun.Glob('content/roadmap/*/{questions,placement}.json').scan('.'))).sort();

  const items = (await Promise.all(paths.map(loadFile))).flat();
  const problems = validateBank(items);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    console.error(`✗ ${problems.length} problems in ${items.length} questions — nothing uploaded.`);
    process.exitCode = 1;
    return;
  }
  const qs = items as RoadmapQuestion[];
  const byTopic = new Map<number, number>();
  for (const q of qs) byTopic.set(q.topicId, (byTopic.get(q.topicId) ?? 0) + 1);
  console.log(`✓ ${qs.length} valid questions from ${paths.length} file(s), ${byTopic.size} topics.`);
  if (dry) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL болон SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна.');
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // keep the review decision of rows that already exist
  const { data: existing, error: readError } = await db
    .from(process.env.SUPABASE_QUESTIONS_TABLE === 'learning_questions' ? 'learning_questions' : 'questions')
    .select('id, reviewed')
    .in(
      'id',
      qs.map((q) => q.id),
    );
  if (readError) throw new Error(`read: ${readError.message}`);
  const reviewed = new Map((existing ?? []).map((r) => [r.id as string, r.reviewed as boolean]));

  const rows = qs.map((q) => {
    const keep = !resetReview && reviewed.has(q.id) ? reviewed.get(q.id)! : q.reviewed;
    const { verify: _verify, ...content } = q;
    return {
      id: q.id,
      domain: q.domain,
      difficulty: q.difficulty,
      topic_id: q.topicId,
      format: q.format,
      pool: q.pool,
      reviewed: keep,
      source: q.source,
      author: q.author,
      created_at: q.createdAt,
      updated_at: new Date().toISOString(),
      content: { ...content, reviewed: keep },
    };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db
      .from(
        process.env.SUPABASE_QUESTIONS_TABLE === 'learning_questions' ? 'learning_questions' : 'questions',
      )
      .upsert(rows.slice(i, i + 200), { onConflict: 'id' });
    if (error) throw new Error(`upsert: ${error.message}`);
  }
  console.log(`✓ uploaded ${rows.length} questions.`);
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error('✗ import failed:', e);
    process.exitCode = 1;
  });
}
