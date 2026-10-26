-- Shell · profile settings (time zone, privacy, preset avatar, home aimag) and a profile row for every new account.
--
-- "own profile" (0001) lets a student write their own row, so nothing economic or role-like lives here:
-- gems get their own ledger, and protect_profile_role (0006) still guards `role`.

alter table public.profiles
  add column if not exists tz text not null default 'Asia/Ulaanbaatar' check (char_length(tz) <= 64),
  -- preset avatar id (no photo uploads: most students are minors)
  add column if not exists avatar_id text check (avatar_id is null or avatar_id ~ '^[a-z0-9-]{1,32}$'),
  add column if not exists aimag text check (aimag is null or char_length(aimag) <= 40),
  add column if not exists school text check (school is null or char_length(school) <= 60),
  -- privacy: leave the national and aimag leaderboards / be visible to friends only
  add column if not exists hide_public boolean not null default false,
  add column if not exists friends_only boolean not null default false;

alter table public.profiles
  add constraint profiles_name_length check (char_length(name) <= 40) not valid;

-- Every new auth user (email, Google, anonymous demo) gets a profile row. Google sends the display name in
-- raw_user_meta_data; nothing else from the provider (email, photo) is copied into public tables.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
