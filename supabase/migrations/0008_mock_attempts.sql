-- D · full mock exams («Бүтэн тест»): the graded attempt, the adaptive route and the estimated score live on
-- the exams row (0003). Written only by Server Actions with the service-role client after the server grades
-- the answers and checks the module deadline; students read their own rows (policy from 0003).
--
-- `attempt` holds features/exam/lib/mock.ts MockAttempt: module question ids, graded answers, time per
-- question. Questions are sent to the browser without answers while a module is open.

alter table public.exams
  add column if not exists kind text not null default 'solo' check (kind in ('solo', 'group')),
  add column if not exists route text check (route in ('hard', 'easy')),
  add column if not exists attempt jsonb,
  add column if not exists score_est int check (score_est between 200 and 800),
  add column if not exists domain_scores jsonb,
  add column if not exists time_used_sec int check (time_used_sec >= 0),
  add column if not exists finished_at timestamptz,
  -- impossible timing (answers faster than anyone can read); hidden from leaderboards
  add column if not exists flagged boolean not null default false,
  -- phase 8: a group mock session everyone in it takes together
  add column if not exists group_session_id uuid;

create index if not exists exams_user_finished_idx
  on public.exams (user_id, finished_at desc)
  where finished_at is not null;
