-- Allow names in any language, spaces, emojis, and symbols. Passwords remain in auth.users.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or (char_length(username) between 1 and 40 and btrim(username) <> '' and username !~ '[[:cntrl:]]'));
drop index if exists public.profiles_username_unique;
create unique index profiles_username_unique on public.profiles (lower(normalize(btrim(username), NFC))) where username is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 40),
    nullif(normalize(trim(new.raw_user_meta_data ->> 'username'), NFC), '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
notify pgrst, 'reload schema';
