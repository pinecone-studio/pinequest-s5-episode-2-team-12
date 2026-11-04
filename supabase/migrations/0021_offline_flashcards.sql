-- «Шинэ үг» grades made offline. A review is applied to card_states only when its UUID is first
-- inserted here, so retried syncs never grade a card twice.
create table if not exists public.offline_card_reviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.offline_card_reviews enable row level security;
create policy "read own offline card reviews" on public.offline_card_reviews for select to authenticated using (auth.uid() = user_id);
create policy "insert own offline card reviews" on public.offline_card_reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own offline card reviews" on public.offline_card_reviews for delete to authenticated using (auth.uid() = user_id);
