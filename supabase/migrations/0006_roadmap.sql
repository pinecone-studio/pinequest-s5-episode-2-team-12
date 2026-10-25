-- A · «Монголын аялал» (SAT Math roadmap) + the XP/badge/league objects F already queries.
--
-- Writes to every table below go through Server Actions with the service-role client
-- (src/server/db.ts) after the server re-checks the answers. Students can only read their own rows.

-- ———————————————————— roles ————————————————————
alter table public.profiles
  add column if not exists role text not null default 'student' check (role in ('student', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- "own profile" lets a student update their row; this keeps them from promoting themselves.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.role <> 'student' then
    raise exception 'role can only be set by an admin';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role can only be changed by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_role();

-- ———————————————————— questions ————————————————————
-- The roadmap reuses the question bank. Existing practice rows keep working (topic_id null).
alter table public.questions
  add column if not exists topic_id int check (topic_id between 1 and 26),
  add column if not exists format text check (format in ('mcq', 'spr')),
  add column if not exists pool text check (pool in ('stop', 'placement')),
  add column if not exists reviewed boolean not null default false,
  add column if not exists source text not null default 'original' check (source = 'original'),
  add column if not exists author text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz;

-- the practice bank was written and checked before this flag existed
update public.questions set reviewed = true where topic_id is null and reviewed = false;

create index if not exists questions_roadmap on public.questions (topic_id, pool, reviewed);

drop policy if exists "questions are public" on public.questions;
create policy "reviewed questions are public" on public.questions
  for select using (reviewed or public.is_admin());
create policy "admins edit questions" on public.questions
  for update using (public.is_admin()) with check (public.is_admin());

-- ———————————————————— placement ————————————————————
create table if not exists public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  skipped boolean not null default false,
  module2 text check (module2 in ('easy', 'hard')),
  -- [{ qid, answer, correct, timeMs }]
  answers jsonb not null default '[]'::jsonb,
  score numeric(5, 4) not null default 0 check (score between 0 and 1),
  level text not null check (level in ('weak', 'mid', 'strong')),
  -- { "1": "weak" | "ok" | "strong", … }
  mastery jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz not null default now()
);

create index if not exists placement_attempts_user on public.placement_attempts (user_id, finished_at desc);

-- ———————————————————— roadmap progress ————————————————————
create table if not exists public.roadmap_progress (
  user_id uuid primary key references auth.users on delete cascade,
  level text not null default 'mid' check (level in ('weak', 'mid', 'strong')),
  -- effective mastery: placement, updated by retakes for unfinished stops
  mastery jsonb not null default '{}'::jsonb,
  -- 27 = every stop done
  current_stop int not null default 1 check (current_stop between 1 and 27),
  regions_done text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_stops (
  user_id uuid not null references auth.users on delete cascade,
  stop_no int not null check (stop_no between 1 and 26),
  status text not null default 'current' check (status in ('current', 'completed', 'tested-out')),
  best numeric(5, 4) not null default 0 check (best between 0 and 1),
  stars int not null default 0 check (stars between 0 and 3),
  attempts int not null default 0 check (attempts >= 0),
  tested_out boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, stop_no)
);

-- a later, weaker attempt never lowers what a stop already reached
create or replace function public.preserve_roadmap_stop()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.best := greatest(old.best, new.best);
  new.stars := greatest(old.stars, new.stars);
  new.attempts := greatest(old.attempts, new.attempts);
  new.completed_at := coalesce(old.completed_at, new.completed_at);
  new.tested_out := old.tested_out or (new.tested_out and old.completed_at is null);
  if old.status in ('completed', 'tested-out') then
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists preserve_roadmap_stop_trigger on public.roadmap_stops;
create trigger preserve_roadmap_stop_trigger
before update on public.roadmap_stops
for each row execute function public.preserve_roadmap_stop();

-- ———————————————————— attempts ————————————————————
create table if not exists public.problem_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  question_id text not null,
  context text not null check (context in ('placement', 'stop', 'testout')),
  stop_no int check (stop_no between 1 and 26),
  topic_id int check (topic_id between 1 and 26),
  answer text not null check (char_length(answer) <= 200),
  correct boolean not null,
  time_ms int not null default 0 check (time_ms >= 0),
  hint_used boolean not null default false,
  at timestamptz not null default now()
);

create index if not exists problem_attempts_user_topic on public.problem_attempts (user_id, topic_id, at desc);

-- ———————————————————— badges, quests (queried by features/progress) ————————————————————
create table if not exists public.user_badges (
  user_id uuid not null references auth.users on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.quest_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  quest_id text not null,
  date date not null,
  progress int not null default 0 check (progress >= 0),
  completed boolean not null default false,
  unique (user_id, quest_id, date)
);

-- ———————————————————— weekly league ————————————————————
-- ISO week in Asia/Ulaanbaatar, e.g. 2026-W43. Shows only display name and weekly XP.
create or replace view public.league_rows as
select
  to_char(e.at at time zone 'Asia/Ulaanbaatar', 'IYYY-"W"IW') as week_id,
  e.user_id,
  coalesce(nullif(p.name, ''), 'Сурагч') as name,
  sum(e.amount)::int as xp
from public.xp_events e
left join public.profiles p on p.id = e.user_id
group by 1, 2, 3;

grant select on public.league_rows to authenticated;

-- ———————————————————— RLS ————————————————————
alter table public.placement_attempts enable row level security;
alter table public.roadmap_progress enable row level security;
alter table public.roadmap_stops enable row level security;
alter table public.problem_attempts enable row level security;
alter table public.user_badges enable row level security;
alter table public.quest_progress enable row level security;

create policy "own placement" on public.placement_attempts for select using (auth.uid() = user_id);
create policy "own roadmap" on public.roadmap_progress for select using (auth.uid() = user_id);
create policy "own roadmap stops" on public.roadmap_stops for select using (auth.uid() = user_id);
create policy "own attempts" on public.problem_attempts for select using (auth.uid() = user_id);
create policy "own badges" on public.user_badges for select using (auth.uid() = user_id);
create policy "own quests" on public.quest_progress for select using (auth.uid() = user_id);
