// Seeds Supabase pgvector (migration 0019) with Gemini embeddings of the RAG library (examples.json).
// Needs, in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY.
// Then set RAG_BACKEND=supabase on the server. Safe to re-run (upsert by id).
//
//   bun ai/rag/embed.ts
import { createClient } from '@supabase/supabase-js';
import LIBRARY from '../../src/server/ai/rag/examples.json';
import { EMBED_DIM } from '../../src/server/ai/rag/retrieve';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const key = process.env.GEMINI_API_KEY;
if (!url || !service || !key)
  throw new Error('set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY');

const MODEL = 'models/gemini-embedding-001';
const BATCH = 50;
const db = createClient(url, service, { auth: { persistSession: false } });
const rows = LIBRARY as { id: string; technique: string; question: string }[];

const unit = (v: number[]) => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};

for (let i = 0; i < rows.length; i += BATCH) {
  const part = rows.slice(i, i + BATCH);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${MODEL}:batchEmbedContents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      requests: part.map((r) => ({
        model: MODEL,
        content: { parts: [{ text: r.question }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        output_dimensionality: EMBED_DIM,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const { embeddings } = (await res.json()) as { embeddings: { values: number[] }[] };
  const { error } = await db.from('rag_examples').upsert(
    part.map((r, j) => ({
      id: r.id,
      technique: r.technique,
      question: r.question,
      embedding: unit(embeddings[j].values),
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) throw new Error(`Supabase: ${error.message}`);
  console.log(`${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
}
console.log('done — set RAG_BACKEND=supabase on the server');
