-- Passwords and email addresses stay in auth.users; only the public handle belongs in profiles.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,23}$');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 40),
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
notify pgrst, 'reload schema';
