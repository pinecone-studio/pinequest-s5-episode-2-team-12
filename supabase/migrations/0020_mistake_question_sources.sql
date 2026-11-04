-- Extend the existing notebook; official and practice IDs must never collide.
alter table public.mistakes
  add column if not exists question_source text not null default 'practice'
  check (question_source in ('practice', 'official'));
alter table public.mistakes drop constraint if exists mistakes_user_id_question_id_key;
create unique index if not exists mistakes_user_question_source
  on public.mistakes (user_id, question_id, question_source);

-- Reads remain per-user. Only trusted server code may write a graded result.
alter table public.mistakes enable row level security;
revoke insert, update, delete on public.mistakes from anon, authenticated;
grant select on public.mistakes to authenticated;
grant all on public.mistakes to service_role;
