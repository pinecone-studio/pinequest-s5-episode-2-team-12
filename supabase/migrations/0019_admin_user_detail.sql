-- /admin/users/[id]: everything about one student in one call. Same pattern as 0017: security definer and
-- is_admin() inside, so only an admin's session gets anything back.
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'not_found'; end if;

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'anonymous', coalesce(u.is_anonymous, false),
        'email_confirmed', u.email_confirmed_at is not null,
        'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'username', p.username, 'name', coalesce(p.name, ''), 'role', coalesce(p.role, 'student'),
        'avatar_id', p.avatar_id, 'aimag', p.aimag, 'school', p.school, 'onboarded', coalesce(p.onboarded, false),
        'sat_exp', p.sat_exp, 'last_math_score', p.last_math_score, 'target', p.target,
        'exam_date', p.exam_date, 'confidence', p.confidence, 'desmos', p.desmos,
        'study_minutes', p.study_minutes, 'start', p.start, 'friend_code', p.friend_code,
        'hide_public', coalesce(p.hide_public, false), 'friends_only', coalesce(p.friends_only, false)
      )
      from auth.users u left join public.profiles p on p.id = u.id
      where u.id = p_user
    ),
    -- statsFromXp (features/progress/lib/stats.ts) turns these into level and streak, as the student sees them
    'xp_rows', (
      select coalesce(jsonb_agg(jsonb_build_object('amount', e.amount, 'at', e.at)), '[]'::jsonb)
      from (select amount, at from public.xp_events where user_id = p_user order by at desc limit 5000) e
    ),
    'freezes', (
      select coalesce(sum(qty), 0) from public.inventory where user_id = p_user and item_id = 'streak-freeze'
    ),
    'gems', (select coalesce(sum(amount), 0) from public.gem_events where user_id = p_user),
    'answers', (
      select jsonb_build_object(
        'total', count(*), 'correct', count(*) filter (where ok),
        'week', count(*) filter (where t > now() - interval '7 days')
      )
      from (
        select correct as ok, at as t from public.problem_attempts where user_id = p_user
        union all
        select is_correct, created_at from public.attempts where user_id = p_user
      ) a
    ),
    'roadmap', (
      select jsonb_build_object(
        'level', rp.level, 'current_stop', rp.current_stop,
        'done', (select count(*) from public.roadmap_stops s
                 where s.user_id = p_user and s.completed_at is not null),
        'stars', (select coalesce(sum(s.stars), 0) from public.roadmap_stops s where s.user_id = p_user)
      )
      from (select 1) one
      left join public.roadmap_progress rp on rp.user_id = p_user
    ),
    'mocks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'score', coalesce(x.score_est, x.score), 'finished_at', x.finished_at
      ) order by x.finished_at desc), '[]'::jsonb)
      from (select * from public.exams where user_id = p_user and finished_at is not null
            order by finished_at desc limit 10) x
    ),
    'counts', jsonb_build_object(
      'cards', (select count(*) from public.card_states where user_id = p_user),
      'mistakes_open', (select count(*) from public.mistakes where user_id = p_user and not resolved),
      'friends', (select count(*) from public.friendships
                  where status = 'accepted' and p_user in (user_a, user_b)),
      'badges', (select count(*) from public.user_badges where user_id = p_user),
      'ai_week', (select count(*) from public.ai_usage
                  where user_id = p_user and created_at > now() - interval '7 days'),
      'reports_made', (select count(*) from public.reports where reporter = p_user)
    ),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'reason', r.reason, 'context', r.context, 'resolved', r.resolved, 'created_at', r.created_at,
        'reporter_name', coalesce(nullif(rp.name, ''), rp.username, '')
      ) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reports where target = p_user order by created_at desc limit 20) r
      left join public.profiles rp on rp.id = r.reporter
    ),
    'recent_xp', (
      select coalesce(jsonb_agg(jsonb_build_object('amount', e.amount, 'reason', e.reason, 'at', e.at)
                                order by e.at desc), '[]'::jsonb)
      from (select amount, reason, at from public.xp_events where user_id = p_user order by at desc limit 15) e
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

notify pgrst, 'reload schema';
