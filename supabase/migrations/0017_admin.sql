-- Admin panel (/admin). Every admin_* function is security definer and checks public.is_admin() itself, so the
-- panel runs on the signed-in admin's own session — no service-role key needed, and a student calling these
-- RPCs directly gets 'forbidden'. Admins are promoted by another admin (Users page) or once by hand in SQL.
-- Also closes holes the security advisor flagged: the two views were writable/readable by anon.

-- ———————————————————— hardening ————————————————————
-- public_profiles is a simple (auto-updatable) view running as its owner: anon could update/delete profiles
-- through it. Both views are read-only and for signed-in students only, as 0006/0012 intended.
revoke all on public.public_profiles, public.league_rows from anon, authenticated;
grant select on public.public_profiles, public.league_rows to authenticated;

-- a trigger function; firing it needs no EXECUTE grant
revoke execute on function public.handle_new_user() from public, anon, authenticated;
alter function public.parse_num(text) set search_path = '';

-- ———————————————————— read ————————————————————
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  with activity as (
    select user_id, created_at as t from public.attempts
    union all select user_id, at from public.problem_attempts
    union all select user_id, at from public.xp_events
    union all select user_id, created_at from public.ai_usage
  ),
  days as (select generate_series(today - 13, today, interval '1 day')::date as d)
  select jsonb_build_object(
    'users', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
    'guests', (select count(*) from auth.users where coalesce(is_anonymous, false)),
    'admins', (select count(*) from public.profiles where role = 'admin'),
    'onboarded', (select count(*) from public.profiles where onboarded),
    'new_7d', (select count(*) from auth.users
               where not coalesce(is_anonymous, false) and created_at > now() - interval '7 days'),
    'active_1d', (select count(distinct user_id) from activity where t > now() - interval '1 day'),
    'active_7d', (select count(distinct user_id) from activity where t > now() - interval '7 days'),
    'answers_7d', (select count(*) from public.attempts where created_at > now() - interval '7 days')
                + (select count(*) from public.problem_attempts where at > now() - interval '7 days'),
    'mocks', (select count(*) from public.exams where finished_at is not null),
    'ai_7d', (select count(*) from public.ai_usage where created_at > now() - interval '7 days'),
    'xp_total', (select coalesce(sum(amount), 0) from public.xp_events),
    'open_reports', (select count(*) from public.reports where not resolved),
    'new_feedback', (select count(*) from public.tutor_feedback where status = 'new'),
    'pending_review', (select count(*) from public.questions where not reviewed),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', days.d,
        'signups', (select count(*) from auth.users u
                    where not coalesce(u.is_anonymous, false)
                      and (u.created_at at time zone 'Asia/Ulaanbaatar')::date = days.d),
        'active', (select count(distinct a.user_id) from activity a
                   where (a.t at time zone 'Asia/Ulaanbaatar')::date = days.d)
      ) order by days.d), '[]'::jsonb)
      from days
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_users(p_search text default '', p_limit int default 200)
returns table (
  id uuid, email text, username text, name text, role text, onboarded boolean, anonymous boolean,
  created_at timestamptz, last_sign_in_at timestamptz, xp bigint, gems bigint, reports bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare q text := '%' || lower(coalesce(trim(p_search), '')) || '%';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, p.username, coalesce(p.name, ''), coalesce(p.role, 'student'),
           coalesce(p.onboarded, false), coalesce(u.is_anonymous, false), u.created_at, u.last_sign_in_at,
           (select coalesce(sum(e.amount), 0) from public.xp_events e where e.user_id = u.id)::bigint,
           (select coalesce(sum(g.amount), 0) from public.gem_events g where g.user_id = u.id)::bigint,
           (select count(*) from public.reports r where r.target = u.id and not r.resolved)
    from auth.users u
    left join public.profiles p on p.id = u.id
    where q = '%%'
       or lower(coalesce(u.email, '')) like q
       or lower(coalesce(p.username, '')) like q
       or lower(coalesce(p.name, '')) like q
    order by (coalesce(p.role, 'student') = 'admin') desc, u.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

create or replace function public.admin_reports(p_open_only boolean default true)
returns table (
  id uuid, created_at timestamptz, context text, reason text, resolved boolean,
  reporter uuid, reporter_name text, target uuid, target_name text, target_email text, target_open bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.id, r.created_at, r.context, r.reason, r.resolved,
           r.reporter, coalesce(nullif(rp.name, ''), rp.username, ''),
           r.target, coalesce(nullif(tp.name, ''), tp.username, ''), tu.email::text,
           (select count(*) from public.reports x where x.target = r.target and not x.resolved)
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter
    left join public.profiles tp on tp.id = r.target
    left join auth.users tu on tu.id = r.target
    where not p_open_only or not r.resolved
    order by r.resolved, r.created_at desc
    limit 300;
end;
$$;

create or replace function public.admin_feedback(p_status text default 'new')
returns table (
  id uuid, created_at timestamptz, user_name text, mode text, context_kind text, prompt text, reply text,
  rating text, correction text, model text, status text, review_note text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select f.id, f.created_at, coalesce(nullif(p.name, ''), p.username, ''), f.mode, f.context_kind,
           f.prompt, f.reply, f.rating, f.correction, f.model, f.status, f.review_note
    from public.tutor_feedback f
    left join public.profiles p on p.id = f.user_id
    where p_status is null or p_status = 'all' or f.status = p_status
    order by f.created_at desc
    limit 300;
end;
$$;

-- ———————————————————— write ————————————————————
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('student', 'admin') then raise exception 'invalid_role'; end if;
  -- the last way back in would be SQL by hand
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'self_demote'; end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.admin_grant_gems(p_user uuid, p_amount int, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_amount is null or p_amount = 0 or p_amount not between -1000 and 1000 then
    raise exception 'invalid_amount';
  end if;
  insert into public.gem_events (user_id, amount, reason, key)
  values (p_user, p_amount, left('admin:' || coalesce(trim(p_note), ''), 40),
          'admin:' || auth.uid() || ':' || gen_random_uuid());
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_resolved boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.reports set resolved = p_resolved where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.admin_review_feedback(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('new', 'approved', 'rejected') then raise exception 'invalid_status'; end if;
  update public.tutor_feedback
     set status = p_status,
         review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
         reviewed_at = case when p_status = 'new' then null else now() end
   where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- signed-in users only; the is_admin() check inside decides the rest
revoke execute on function
  public.admin_overview(), public.admin_users(text, int), public.admin_reports(boolean),
  public.admin_feedback(text), public.admin_set_role(uuid, text), public.admin_grant_gems(uuid, int, text),
  public.admin_resolve_report(uuid, boolean), public.admin_review_feedback(uuid, text, text)
from public, anon;
grant execute on function
  public.admin_overview(), public.admin_users(text, int), public.admin_reports(boolean),
  public.admin_feedback(text), public.admin_set_role(uuid, text), public.admin_grant_gems(uuid, int, text),
  public.admin_resolve_report(uuid, boolean), public.admin_review_feedback(uuid, text, text)
to authenticated;

notify pgrst, 'reload schema';
