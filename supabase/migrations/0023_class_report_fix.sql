-- Fix for 0022: class_report read public.attempts, which no migration creates, so the teacher's class page
-- failed with «relation does not exist». It now reads the tables the app really writes answers to.
-- Safe to run whether or not 0022 already ran (create or replace).

-- one row per student, for the class's teacher only
create or replace function public.class_report(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with members as (
    select m.user_id, m.joined_at from public.class_members m where m.class_id = p_class
  ),
  -- every graded answer the app records: roadmap problems and question-bank practice
  answers as (
    select pa.user_id, pa.correct as ok, pa.at as t
    from public.problem_attempts pa where pa.user_id in (select user_id from members)
    union all
    -- question bank / practice answers (migration 0020). There is no public.attempts table in our migrations.
    select oa.user_id, oa.correct, oa.attempted_at
    from public.offline_question_attempts oa where oa.user_id in (select user_id from members)
  )
  select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]'::jsonb) into result
  from (
    select
      m.user_id as id,
      coalesce(nullif(p.name, ''), p.username, 'Сурагч') as name,
      p.username,
      m.joined_at,
      (select count(*) from answers a where a.user_id = m.user_id) as answers,
      (select count(*) from answers a where a.user_id = m.user_id and a.ok) as correct,
      (select count(*) from answers a where a.user_id = m.user_id and a.t > now() - interval '7 days') as week,
      (select max(a.t) from answers a where a.user_id = m.user_id) as last_active,
      (select count(*) from public.mistakes x where x.user_id = m.user_id and not x.resolved) as open_mistakes,
      (
        -- the 3 roadmap topics with the lowest accuracy (at least 3 answers each)
        select coalesce(jsonb_agg(w.topic_id order by w.acc, w.topic_id), '[]'::jsonb)
        from (
          select pa.topic_id, avg(pa.correct::int) as acc
          from public.problem_attempts pa
          where pa.user_id = m.user_id and pa.topic_id is not null
          group by pa.topic_id
          having count(*) >= 3
          order by avg(pa.correct::int), pa.topic_id
          limit 3
        ) w
      ) as weak_topics
    from members m
    left join public.profiles p on p.id = m.user_id
  ) s;
  return result;
end $$;

notify pgrst, 'reload schema';
