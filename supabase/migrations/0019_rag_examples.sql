-- RAG for Суу (src/server/ai/rag/retrieve.ts, RAG_BACKEND=supabase): Gemini embeddings of the checked Desmos
-- lessons in examples.json, searched with pgvector. Only the server (service role) reads it; students never do.
-- Seed: bun ai/rag/embed.ts. Without rows (or without this migration) the server uses its offline index.
create extension if not exists vector with schema extensions;

create table if not exists public.rag_examples (
  id text primary key,
  technique text not null,
  question text not null,
  embedding extensions.vector(768) not null,
  updated_at timestamptz not null default now()
);
alter table public.rag_examples enable row level security; -- no policies: service role only

create index if not exists rag_examples_embedding_idx
  on public.rag_examples using hnsw (embedding extensions.vector_cosine_ops);

-- The closest examples to a query embedding (cosine similarity, 1 = same direction).
create or replace function public.match_rag_examples(query_embedding extensions.vector(768), match_count int default 6)
returns table (id text, technique text, similarity float)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.technique, 1 - (e.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.rag_examples e
  order by e.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_rag_examples(extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_rag_examples(extensions.vector, int) to service_role;
