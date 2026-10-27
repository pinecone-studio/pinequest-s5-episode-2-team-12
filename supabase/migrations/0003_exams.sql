
-- Section D1: Exam timer and module flow.
-- Exam creation and transitions use authenticated RPC functions.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  phase text not null default 'intro'
    check (phase in (
      'intro', 'module1', 'break', 'module2', 'results'
    )),

  module int not null default 0
    check (module between 0 and 2),

  modules jsonb not null default '[]'::jsonb,

  started_at timestamptz,
  ends_at timestamptz,
  score int,

  created_at timestamptz not null default now()
);

create index if not exists exams_user_id_idx
  on public.exams (user_id, created_at desc);

alter table public.exams enable row level security;

create policy "Users can view own exams"
  on public.exams
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.exams
  from anon, authenticated;

-- Create an exam with a validated first module.
create or replace function public.create_exam(
  p_question_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_exam_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_question_ids is null
    or jsonb_typeof(p_question_ids) <> 'array'
    or jsonb_array_length(p_question_ids) <> 22
    or exists (
      select 1
      from jsonb_array_elements(p_question_ids) as item(value)
      where jsonb_typeof(item.value) <> 'string'
    )
    or (
      select count(distinct value)
      from jsonb_array_elements_text(p_question_ids)
    ) <> 22
  then
    raise exception 'Exactly 22 unique question IDs are required';
  end if;

  insert into public.exams (
    user_id, phase, module, modules
  )
  values (
    current_user_id,
    'intro',
    0,
    jsonb_build_array(
      jsonb_build_object(
        'no', 1,
        'questionIds', p_question_ids,
        'minutes', 35
      )
    )
  )
  returning id into new_exam_id;

  return new_exam_id;
end;
$$;

revoke all on function public.create_exam(jsonb) from public;
revoke all on function public.create_exam(jsonb) from anon;
grant execute on function public.create_exam(jsonb)
  to authenticated;

-- Transition an exam, checking the expected phase.
create or replace function public.transition_exam(
  p_exam_id uuid,
  p_event text,
  p_expected_phase text
)
returns public.exams
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_exam public.exams%rowtype;
  exam_clock timestamptz;
  next_phase text;
  next_module integer;
  next_ends_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_event is null
    or p_event not in ('START', 'SUBMIT', 'TIME_UP')
  then
    raise exception 'Invalid exam event';
  end if;

  if p_expected_phase is null
    or p_expected_phase not in (
      'intro', 'module1', 'break', 'module2', 'results'
    )
  then
    raise exception 'Invalid expected phase';
  end if;

  select *
  into current_exam
  from public.exams
  where id = p_exam_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Exam not found';
  end if;

  exam_clock := clock_timestamp();

  -- Recover every expired phase using original deadlines.
  loop
    exit when current_exam.phase in ('intro', 'results');
    exit when current_exam.ends_at is null;
    exit when exam_clock < current_exam.ends_at;

    if current_exam.phase = 'module1' then
      next_phase := 'break';
      next_module := 1;
      next_ends_at :=
        current_exam.ends_at + interval '10 minutes';

    elsif current_exam.phase = 'break' then
      next_phase := 'module2';
      next_module := 2;
      next_ends_at :=
        current_exam.ends_at + interval '35 minutes';

    elsif current_exam.phase = 'module2' then
      next_phase := 'results';
      next_module := 2;
      next_ends_at := null;

    else
      exit;
    end if;

    update public.exams
    set phase = next_phase,
        module = next_module,
        ends_at = next_ends_at
    where id = p_exam_id
    returning * into current_exam;
  end loop;

  -- A stale request must not affect a newer phase.
  if current_exam.phase <> p_expected_phase then
    return current_exam;
  end if;

  if p_event = 'START'
    and current_exam.phase = 'intro'
  then
    update public.exams
    set phase = 'module1',
        module = 1,
        started_at = exam_clock,
        ends_at = exam_clock + interval '35 minutes'
    where id = p_exam_id
    returning * into current_exam;

  elsif p_event = 'SUBMIT'
    and current_exam.phase = 'module1'
  then
    update public.exams
    set phase = 'break',
        module = 1,
        ends_at = exam_clock + interval '10 minutes'
    where id = p_exam_id
    returning * into current_exam;

  elsif p_event = 'SUBMIT'
    and current_exam.phase = 'module2'
  then
    update public.exams
    set phase = 'results',
        module = 2,
        ends_at = null
    where id = p_exam_id
    returning * into current_exam;
  end if;

  return current_exam;
end;
$$;

revoke all on function public.transition_exam(
  uuid, text, text
) from public;

revoke all on function public.transition_exam(
  uuid, text, text
) from anon;

grant execute on function public.transition_exam(
  uuid, text, text
) to authenticated;
