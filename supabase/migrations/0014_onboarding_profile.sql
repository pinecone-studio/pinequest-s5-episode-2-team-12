-- Additional study preferences. Existing profile RLS limits students to their own row.
alter table public.profiles
  add column if not exists last_math_score integer check (last_math_score between 200 and 800 and last_math_score % 10 = 0),
  add column if not exists study_minutes integer not null default 30 check (study_minutes in (15, 30, 45, 60));
