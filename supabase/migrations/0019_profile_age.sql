alter table public.profiles
  add column if not exists age integer check (age between 1 and 120);
