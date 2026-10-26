-- Phase 8: friends, async duels, group mocks, leaderboards — with the safety rules for minors:
--  · others see only display name, avatar and level (public_profiles); never email, phone, school, location
--  · no free-text chat: reactions are a fixed enum
--  · block hides both ways everywhere; reports go to admins
--  · privacy: hide_public (no aimag/national boards), friends_only (only friends see you) — 0007
--  · flagged (impossible-timing) attempts never reach a board
-- All writes go through Server Actions (service role) after the server checks the rules.

-- ———————————————————— identity ————————————————————
create or replace function public.make_friend_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

alter table public.profiles
  add column if not exists friend_code text unique default public.make_friend_code();
update public.profiles set friend_code = public.make_friend_code() where friend_code is null;

-- what any signed-in student may see of another one: name, avatar, total XP (the app turns XP into the
-- level with src/lib/level.ts, so the formula lives in one place)
create or replace view public.public_profiles
with (security_invoker = false) as
select
  p.id,
  coalesce(nullif(p.name, ''), 'Сурагч') as name,
  p.avatar_id,
  coalesce((select sum(e.amount) from public.xp_events e where e.user_id = p.id), 0)::bigint as xp
from public.profiles p;
grant select on public.public_profiles to authenticated;

-- ———————————————————— friends, blocks, reports ————————————————————
create table if not exists public.friendships (
  user_a uuid not null references auth.users on delete cascade,
  user_b uuid not null references auth.users on delete cascade,
  requested_by uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users on delete cascade,
  target uuid not null references auth.users on delete cascade,
  context text not null check (context in ('profile', 'friend', 'leaderboard', 'duel', 'group')),
  reason text not null check (reason in ('name', 'avatar', 'cheating', 'harassment', 'other')),
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

-- ———————————————————— duels (async v1; `mode` reserves live/Realtime) ————————————————————
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references auth.users on delete cascade,
  opponent uuid not null references auth.users on delete cascade,
  topic_id int check (topic_id between 1 and 26),
  size int not null check (size in (5, 10)),
  question_ids text[] not null,
  time_limit_ms int not null,
  mode text not null default 'async' check (mode in ('async', 'live')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (challenger <> opponent)
);

create table if not exists public.duel_runs (
  duel_id uuid not null references public.duels on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  started_at timestamptz not null default now(),
  served_at timestamptz not null default now(),
  answers jsonb not null default '[]'::jsonb,
  finished_at timestamptz,
  correct int not null default 0,
  time_ms int not null default 0,
  flagged boolean not null default false,
  primary key (duel_id, user_id)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid references public.duels on delete cascade,
  group_session_id uuid,
  from_user uuid not null references auth.users on delete cascade,
  to_user uuid not null references auth.users on delete cascade,
  code text not null check (code in ('gg', 'wow', 'nice', 'again', 'fire', 'clap')),
  at timestamptz not null default now()
);

-- ———————————————————— group mock ————————————————————
create table if not exists public.group_sessions (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references auth.users on delete cascade,
  starts_at timestamptz not null,
  closes_at timestamptz not null,
  module1 text[] not null,
  module2 text[] not null,
  created_at timestamptz not null default now(),
  check (closes_at > starts_at)
);
create table if not exists public.group_members (
  session_id uuid not null references public.group_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  invited_by uuid references auth.users on delete set null,
  joined_at timestamptz,
  primary key (session_id, user_id)
);

-- ———————————————————— RLS: read your own; everything else through the server ————————————————————
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.duels enable row level security;
alter table public.duel_runs enable row level security;
alter table public.reactions enable row level security;
alter table public.group_sessions enable row level security;
alter table public.group_members enable row level security;

create policy "own friendships" on public.friendships for select using (auth.uid() in (user_a, user_b));
create policy "own blocks" on public.blocks for select using (auth.uid() = blocker);
create policy "own reports" on public.reports for select using (auth.uid() = reporter);
create policy "own duels" on public.duels for select using (auth.uid() in (challenger, opponent));
-- a run (answers!) is readable by its owner; the opponent sees results only through the server once revealed
create policy "own runs" on public.duel_runs for select using (auth.uid() = user_id);
create policy "own reactions" on public.reactions for select using (auth.uid() in (from_user, to_user));
create policy "member sessions" on public.group_sessions for select using (
  auth.uid() = host or exists (select 1 from public.group_members m where m.session_id = id and m.user_id = auth.uid())
);
create policy "member rows" on public.group_members for select using (auth.uid() = user_id);

-- ———————————————————— leaderboards ————————————————————
-- scope: friends | aimag | national · metric: xp_week | xp_all | daily | mock
-- Applies hide_public, friends_only, blocks both ways and flagged attempts; the caller is always listed.
create or replace function public.leaderboard(p_scope text, p_metric text, p_limit int default 50)
returns table (rank bigint, user_id uuid, name text, avatar_id text, xp bigint, value bigint, me boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select p.id, p.aimag from public.profiles p where p.id = auth.uid()),
  friends as (
    select case when f.user_a = (select id from me) then f.user_b else f.user_a end as id
    from public.friendships f
    where f.status = 'accepted' and (select id from me) in (f.user_a, f.user_b)
  ),
  blocked as (
    select b.blocked as id from public.blocks b where b.blocker = (select id from me)
    union select b.blocker from public.blocks b where b.blocked = (select id from me)
  ),
  vals as (
    select e.user_id as id, sum(e.amount)::bigint as v, 0::bigint as t
    from public.xp_events e
    where p_metric = 'xp_all'
       or (p_metric = 'xp_week' and to_char(e.at at time zone 'Asia/Ulaanbaatar', 'IYYY-"W"IW')
                                  = to_char(now() at time zone 'Asia/Ulaanbaatar', 'IYYY-"W"IW'))
    group by e.user_id
    having p_metric in ('xp_all', 'xp_week')
    union all
    select d.user_id, d.score::bigint, d.time_ms::bigint
    from public.daily_attempts d
    where p_metric = 'daily' and not d.flagged and d.finished_at is not null
      and d.day = (now() at time zone 'Asia/Ulaanbaatar')::date
    union all
    select x.user_id, max(x.score_est)::bigint, 0
    from public.exams x
    where p_metric = 'mock' and not x.flagged and x.finished_at is not null
    group by x.user_id
  ),
  listed as (
    select v.id, v.v, v.t, pp.name, pp.avatar_id, pp.xp
    from vals v
    join public.profiles p on p.id = v.id
    join public.public_profiles pp on pp.id = v.id
    where v.id = (select id from me)
       or (
         v.id not in (select id from blocked)
         and case p_scope
               when 'friends' then v.id in (select id from friends)
               when 'aimag' then p.aimag is not null and p.aimag = (select aimag from me)
                                 and not p.hide_public and (not p.friends_only or v.id in (select id from friends))
               else not p.hide_public and (not p.friends_only or v.id in (select id from friends))
             end
       )
  )
  select rank() over (order by l.v desc, l.t asc) as rank, l.id, l.name, l.avatar_id, l.xp, l.v, l.id = (select id from me)
  from listed l
  order by 1, l.name
  limit greatest(1, least(p_limit, 200));
$$;
revoke all on function public.leaderboard(text, text, int) from public, anon;
grant execute on function public.leaderboard(text, text, int) to authenticated;
