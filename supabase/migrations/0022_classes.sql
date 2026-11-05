-- Teacher classes: a teacher (any signed-in user) makes a class and shares its 6-letter code; students join with
-- the code; the teacher sees each student's progress. Students see nothing about each other.
-- Everything goes through security-definer functions that check who is asking, like the admin panel (0017).

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create index if not exists class_members_user on public.class_members (user_id);
create index if not exists classes_teacher on public.classes (teacher_id);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

-- reads only; every write is a function below
create policy "teacher reads own classes" on public.classes for select using (auth.uid() = teacher_id);
create policy "member reads own memberships" on public.class_members for select using (auth.uid() = user_id);

-- 6 letters/digits without look-alikes (0/O, 1/I/L), unique
create or replace function public.make_class_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where join_code = code);
  end loop;
  return code;
end $$;

create or replace function public.create_class(p_name text)
returns table (id uuid, name text, join_code text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if char_length(trim(p_name)) not between 1 and 60 then raise exception 'bad_name'; end if;
  if (select count(*) from public.classes c where c.teacher_id = auth.uid()) >= 20 then
    raise exception 'too_many_classes';
  end if;
  return query
    insert into public.classes as c (teacher_id, name, join_code)
    values (auth.uid(), trim(p_name), public.make_class_code())
    returning c.id, c.name, c.join_code;
end $$;

create or replace function public.join_class(p_code text)
returns table (id uuid, name text)
language plpgsql volatile security definer set search_path = '' as $$
declare cls public.classes;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into cls from public.classes c where c.join_code = upper(trim(p_code));
  if cls.id is null then raise exception 'not_found'; end if;
  if cls.teacher_id = auth.uid() then raise exception 'own_class'; end if;
  if (select count(*) from public.class_members m where m.class_id = cls.id) >= 200 then
    raise exception 'class_full';
  end if;
  insert into public.class_members (class_id, user_id) values (cls.id, auth.uid()) on conflict do nothing;
  return query select cls.id, cls.name;
end $$;

create or replace function public.leave_class(p_class uuid)
returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.class_members where class_id = p_class and user_id = auth.uid();
$$;

-- the teacher removes a student
create or replace function public.remove_class_member(p_class uuid, p_user uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.class_members where class_id = p_class and user_id = p_user;
end $$;

-- classes the caller teaches or belongs to
create or replace function public.my_classes()
returns table (id uuid, name text, join_code text, teacher boolean, members bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, case when c.teacher_id = auth.uid() then c.join_code end,
         c.teacher_id = auth.uid(),
         (select count(*) from public.class_members m where m.class_id = c.id)
  from public.classes c
  where c.teacher_id = auth.uid()
     or exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = auth.uid())
  order by c.created_at desc;
$$;

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
  -- every graded answer: roadmap problems and the practice/bank attempts (same sources as admin_user_detail)
  answers as (
    select pa.user_id, pa.correct as ok, pa.at as t
    from public.problem_attempts pa where pa.user_id in (select user_id from members)
    union all
    select a.user_id, a.is_correct, a.created_at
    from public.attempts a where a.user_id in (select user_id from members)
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

-- signed-in users only (guests have no classes); the code maker is internal
revoke execute on function public.make_class_code() from public, anon, authenticated;
revoke execute on function
  public.create_class(text), public.join_class(text), public.leave_class(uuid),
  public.remove_class_member(uuid, uuid), public.my_classes(), public.class_report(uuid)
from public, anon;
grant execute on function
  public.create_class(text), public.join_class(text), public.leave_class(uuid),
  public.remove_class_member(uuid, uuid), public.my_classes(), public.class_report(uuid)
to authenticated;
notify pgrst, 'reload schema';
