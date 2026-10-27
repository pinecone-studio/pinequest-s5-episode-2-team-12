-- Official SAT Math questions from the College Board SAT Suite question bank (1,925 items), shown on /bank.
-- Loaded once from Documents/sat_supabase (fetch_questions.py → build.py → upload.py); re-running is safe.
-- Practice-only content: anyone may read it (answers included), only the service role writes.

create table if not exists public.sat_math_questions (
  id               text primary key,                    -- College Board question ID, e.g. 'eccbf957'
  domain           text not null,                       -- 'Algebra', 'Advanced Math', …
  skill            text not null,
  difficulty       text not null check (difficulty in ('Easy','Medium','Hard')),
  score_band       smallint,
  question_type    text not null,                       -- 'multiple_choice' | 'student_response'
  question_html    text not null,                       -- MathML / inline SVG / images
  question_text    text,                                -- plain text for search
  choices          jsonb not null default '[]'::jsonb,  -- [{"label":"A","html":"…"}]
  correct_answer   text,
  accepted_answers text[] not null default '{}',
  explanation_html text,
  explanation_text text,
  source           text,                                -- 'digital' | 'legacy' item format
  created_at       timestamptz not null default now()
);

-- Sort keys for the bank (official domain order, Easy → Hard).
alter table public.sat_math_questions
  add column if not exists domain_rank smallint generated always as (
    case domain when 'Algebra' then 1 when 'Advanced Math' then 2
      when 'Problem-Solving and Data Analysis' then 3 else 4 end) stored,
  add column if not exists difficulty_rank smallint generated always as (
    case difficulty when 'Easy' then 1 when 'Medium' then 2 else 3 end) stored;

-- A few College Board skill names arrive with a trailing space.
update public.sat_math_questions set skill = trim(skill) where skill <> trim(skill);

create index if not exists sat_math_questions_domain_idx on public.sat_math_questions (domain);
create index if not exists sat_math_questions_skill_idx on public.sat_math_questions (skill);
create index if not exists sat_math_questions_difficulty_idx on public.sat_math_questions (difficulty);
create index if not exists sat_math_questions_order_idx
  on public.sat_math_questions (domain_rank, skill, difficulty_rank, id);

alter table public.sat_math_questions enable row level security;
drop policy if exists "Questions are readable by everyone" on public.sat_math_questions;
create policy "Questions are readable by everyone"
  on public.sat_math_questions for select using (true);
