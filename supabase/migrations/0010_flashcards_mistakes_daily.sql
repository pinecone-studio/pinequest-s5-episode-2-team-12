-- Phase 6: SM-2 flashcards, the mistake notebook and the daily challenge. All writes go through Server
-- Actions (service role) after the server grades; students read their own rows.

-- ———————————————————— flashcards: SM-2 on the existing card_states (0002) ————————————————————
-- `box` stays for the old /cards screens; /flashcards reads the SM-2 columns (lib/sm2.ts, fromLeitner()).
alter table public.card_states
  add column if not exists reps int not null default 0 check (reps >= 0),
  add column if not exists interval_days int not null default 0 check (interval_days between 0 and 365),
  add column if not exists ease numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  add column if not exists lapses int not null default 0 check (lapses >= 0),
  -- first review, so only FLASH.newPerDay new cards are introduced per day
  add column if not exists first_seen_at timestamptz;

-- admins approve drafted flashcards (content/cards JSON ships with reviewed: false)
create table if not exists public.content_reviews (
  kind text not null check (kind in ('card')),
  item_id text not null check (char_length(item_id) <= 64),
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz not null default now(),
  primary key (kind, item_id)
);
alter table public.content_reviews enable row level security;
create policy "content reviews are public" on public.content_reviews for select using (true);

-- ———————————————————— mistake notebook ————————————————————
-- Every wrong answer (stop, placement, mock, daily, duel) lands here once per question; reviewing it uses SM-2.
create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  question_id text not null,
  chosen text not null default '' check (char_length(chosen) <= 200),
  source text not null check (source in ('stop', 'placement', 'testout', 'mock', 'daily', 'duel', 'practice')),
  created_at timestamptz not null default now(),
  last_wrong_at timestamptz not null default now(),
  resolved boolean not null default false,
  box int not null default 0,
  reps int not null default 0,
  interval_days int not null default 0,
  ease numeric(4, 2) not null default 2.5,
  lapses int not null default 0,
  due_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create index if not exists mistakes_due on public.mistakes (user_id, resolved, due_at);
alter table public.mistakes enable row level security;
create policy "own mistakes" on public.mistakes for select using (auth.uid() = user_id);

-- ———————————————————— daily challenge ————————————————————
-- The same 5 questions for everyone on a day (picked from the date in code). One attempt per student per day;
-- questions are served one at a time and timed by the server (served_at → answered).
create table if not exists public.daily_attempts (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  question_ids text[] not null,
  answers jsonb not null default '[]'::jsonb,
  current int not null default 0 check (current between 0 and 5),
  served_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  correct int not null default 0 check (correct between 0 and 5),
  score int not null default 0 check (score >= 0),
  time_ms int not null default 0 check (time_ms >= 0),
  flagged boolean not null default false,
  primary key (user_id, day)
);
create index if not exists daily_attempts_board on public.daily_attempts (day, score desc) where finished_at is not null;
alter table public.daily_attempts enable row level security;
create policy "own daily attempts" on public.daily_attempts for select using (auth.uid() = user_id);
