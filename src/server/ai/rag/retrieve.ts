// Server-only. RAG for Суу: before Суу writes a Desmos lesson (and before the chat answers), find the most similar
// solved problems in our library of checked lessons (examples.json, built by ai/rag/build-index.ts) and show them
// as worked examples. Fine-tuning taught Суу *how* to teach; retrieval hands it *the right method* for this problem.
//
// Two backends, same answer shape:
//   • local (default, offline): TF-IDF vectors with math-aware tokens + cosine similarity, built in memory.
//   • supabase (RAG_BACKEND=supabase): Gemini embeddings in Postgres pgvector (migration 0019, seeded by
//     ai/rag/embed.ts). Any failure there falls back to local, so a missing key or table never breaks a lesson.
import { getAdminDb } from '@/server/db';
import { serverEnv } from '@/server/env';
import LIBRARY from './examples.json';

export type Example = { id: string; technique: string; question: string; answer: string; lesson: string };
export type Hit = Example & { score: number };

const EXAMPLES = LIBRARY as Example[];
const BY_ID = new Map(EXAMPLES.map((e) => [e.id, e]));
/** Below this the "closest" example isn't really similar; better no example than a misleading one. */
export const MIN_SCORE = 0.2;

const STOP = new Set(
  (
    'the a an of to in is are be and or for what which value values if then that this with as by on at from it its ' +
    'following equation equations expression expressions shown below above given number numbers true has have'
  ).split(' '),
);

/** Words plus math shape tokens, so "x^2 - 5x + 6 = 0" and "y = 2x^2 + ..." look alike whatever the numbers. */
export function tokens(text: string): string[] {
  const t = text
    .toLowerCase()
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\frac/g, ' frac ')
    .replace(/\\sqrt|√/g, ' sqrt ')
    .replace(/\\le|\\ge|≤|≥|<=|>=|<|>/g, ' ineq ')
    .replace(/\\pi|π/g, ' pi ')
    .replace(/[$\\{}]/g, ' ');
  const out: string[] = [];
  for (const w of t.match(/[a-z]{2,}/g) ?? []) if (!STOP.has(w)) out.push(w);
  if (/\^\s*2|²/.test(t)) out.push('§sq');
  if (/\^\s*\(?[a-z]/.test(t)) out.push('§expvar');
  if (/%|percent/.test(t)) out.push('§pct');
  if (/\b[a-z]\s*\(\s*-?[\d.]+\s*\)/.test(t)) out.push('§fval');
  if (/\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)/.test(t)) out.push('§point');
  if (/\b[a-z]\s*\(\s*[a-z]\s*\)\s*=/.test(t)) out.push('§fdef');
  const eqs = (t.match(/=/g) ?? []).length;
  if (eqs >= 2) out.push('§system');
  if (eqs === 1) out.push('§eq');
  if (/\d\s*\(?\s*[a-z]\b/.test(t)) out.push('§linvar'); // 3x, 6(x + 4)
  if (/\b(?:solve|satisf|what is the value of [a-z]\b|what is [a-z]\b)/.test(t)) out.push('§solve');
  if (/\d+\s*,\s*\d+\s*,\s*\d+/.test(t)) out.push('§list');
  if (/\|/.test(t)) out.push('§table');
  return out;
}

type Vec = Map<string, number>;
let index: { idf: Map<string, number>; vecs: { ex: Example; v: Vec }[] } | null = null;

function tfidf(toks: string[], idf: Map<string, number>): Vec {
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  const v: Vec = new Map();
  let norm = 0;
  for (const [t, n] of tf) {
    const w = (1 + Math.log(n)) * (idf.get(t) ?? 0);
    if (w > 0) {
      v.set(t, w);
      norm += w * w;
    }
  }
  norm = Math.sqrt(norm) || 1;
  for (const [t, w] of v) v.set(t, w / norm);
  return v;
}

function build() {
  if (index) return index;
  const docs = EXAMPLES.map((ex) => ({ ex, toks: tokens(ex.question) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const idf = new Map([...df].map(([t, c]) => [t, Math.log((n + 1) / (c + 1)) + 1]));
  index = { idf, vecs: docs.map((d) => ({ ex: d.ex, v: tfidf(d.toks, idf) })) };
  return index;
}

/**
 * Local search: the k most similar library problems, at most `perTechnique` from one technique (variety helps
 * the chat; for Desmos lessons the top one or two usually share the technique anyway).
 */
export function searchLocal(question: string, k = 2, perTechnique = 2): Hit[] {
  const { idf, vecs } = build();
  const q = tfidf(tokens(question), idf);
  if (!q.size) return [];
  const scored = vecs
    .map(({ ex, v }) => {
      let s = 0;
      for (const [t, w] of q) s += w * (v.get(t) ?? 0);
      return { ...ex, score: s };
    })
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  const out: Hit[] = [];
  const per = new Map<string, number>();
  for (const h of scored) {
    if ((per.get(h.technique) ?? 0) >= perTechnique) continue;
    if (out.some((o) => o.question === h.question)) continue;
    out.push(h);
    per.set(h.technique, (per.get(h.technique) ?? 0) + 1);
    if (out.length >= k) break;
  }
  return out;
}

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
export const EMBED_DIM = 768;

/** Gemini embedding (768 numbers, length 1). Used for the pgvector backend and by ai/rag/embed.ts. */
export async function embed(
  text: string,
  task: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT',
  fetchImpl: typeof fetch = fetch,
): Promise<number[] | null> {
  const key = serverEnv().geminiApiKey;
  if (!key) return null;
  try {
    const res = await fetchImpl(EMBED_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 4000) }] },
        taskType: task,
        output_dimensionality: EMBED_DIM,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const values = ((await res.json()) as { embedding?: { values?: number[] } }).embedding?.values;
    if (!values?.length) return null;
    const norm = Math.sqrt(values.reduce((s, x) => s + x * x, 0)) || 1;
    return values.map((x) => x / norm);
  } catch {
    return null;
  }
}

async function searchSupabase(question: string, k: number, fetchImpl: typeof fetch): Promise<Hit[] | null> {
  const db = getAdminDb();
  if (!db) return null;
  const v = await embed(question, 'RETRIEVAL_QUERY', fetchImpl);
  if (!v) return null;
  const { data, error } = await db.rpc('match_rag_examples', { query_embedding: v, match_count: k * 3 });
  if (error || !Array.isArray(data)) return null;
  const hits: Hit[] = [];
  for (const row of data as { id: string; similarity: number }[]) {
    const ex = BY_ID.get(row.id);
    if (ex && !hits.some((h) => h.question === ex.question)) hits.push({ ...ex, score: row.similarity });
    if (hits.length >= k) break;
  }
  return hits;
}

/** How many examples go to the model (RAG_EXAMPLES, default 2; 0 turns RAG off). */
export function ragCount(): number {
  const n = Number(process.env.RAG_EXAMPLES ?? '2');
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.floor(n))) : 2;
}

/** The examples for this problem: pgvector when configured and working, otherwise the offline index. */
export async function similarExamples(question: string, k = ragCount(), fetchImpl: typeof fetch = fetch) {
  if (k <= 0 || !question.trim()) return { hits: [] as Hit[], backend: 'off' as const };
  if (process.env.RAG_BACKEND === 'supabase') {
    const hits = await searchSupabase(question, k, fetchImpl).catch(() => null);
    if (hits?.length) return { hits, backend: 'supabase' as const };
  }
  return { hits: searchLocal(question, k), backend: 'local' as const };
}

export const LIBRARY_SIZE = EXAMPLES.length;
export { EXAMPLES };
