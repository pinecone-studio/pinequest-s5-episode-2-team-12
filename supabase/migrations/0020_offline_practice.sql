-- Dedicated official-bank practice history. Retries are idempotent by attempt UUID.
create table if not exists public.offline_question_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.sat_math_questions(id),
  answer text not null,
  correct boolean not null,
  attempted_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.offline_question_attempts enable row level security;
create policy "read own offline attempts" on public.offline_question_attempts for select to authenticated using (auth.uid() = user_id);
create policy "insert own offline attempts" on public.offline_question_attempts for insert to authenticated with check (auth.uid() = user_id);
create index offline_attempts_user_date on public.offline_question_attempts(user_id, attempted_at desc);
