-- Admin content tools: approve roadmap items and drafted cards, add official-bank items and word cards.
-- Same pattern as 0017: security definer + is_admin() inside, so the panel works from the admin's own session
-- (no service-role key). The bank table is called `questions` here; prepare-existing-project.ts maps it to
-- learning_questions on the legacy project.

-- ———————————————————— review ————————————————————
-- Upserts the whole item, so a bundled one (content/roadmap) gets its row on its first approval.
create or replace function public.admin_save_question(p_content jsonb, p_reviewed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id text := p_content ->> 'id';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_id is null or v_id !~ '^rm[a-z0-9-]+$' then raise exception 'invalid_input'; end if;
  insert into public.questions
    (id, domain, difficulty, topic_id, format, pool, reviewed, source, author, content, updated_at)
  values (
    v_id, p_content ->> 'domain', (p_content ->> 'difficulty')::int, (p_content ->> 'topicId')::int,
    p_content ->> 'format', coalesce(p_content ->> 'pool', 'stop'), p_reviewed, 'original',
    coalesce(p_content ->> 'author', 'admin'), (p_content - 'verify') || jsonb_build_object('reviewed', p_reviewed),
    now()
  )
  on conflict (id) do update set
    domain = excluded.domain, difficulty = excluded.difficulty, topic_id = excluded.topic_id,
    format = excluded.format, pool = excluded.pool, reviewed = excluded.reviewed,
    content = excluded.content, updated_at = now();
end;
$$;

create or replace function public.admin_review_card(p_key text, p_reviewed boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z0-9_-]+/[A-Za-z0-9_.-]+$' or char_length(p_key) > 64 then
    raise exception 'invalid_input';
  end if;
  if p_reviewed then
    insert into public.content_reviews (kind, item_id, reviewed_by) values ('card', p_key, auth.uid())
    on conflict (kind, item_id) do update set reviewed_by = excluded.reviewed_by, reviewed_at = now();
  else
    delete from public.content_reviews where kind = 'card' and item_id = p_key;
  end if;
end;
$$;

-- ———————————————————— word cards ————————————————————
-- Extra «Үгс» cards written by admins; /flashcards shows them after the bundled decks.
create table if not exists public.custom_cards (
  id uuid primary key default gen_random_uuid(),
  front text not null check (char_length(btrim(front)) between 1 and 80),
  back text not null check (char_length(btrim(back)) between 1 and 120),
  ex text check (char_length(ex) <= 300),
  hook text check (char_length(hook) <= 300),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.custom_cards enable row level security;
drop policy if exists "custom cards are public" on public.custom_cards;
create policy "custom cards are public" on public.custom_cards for select using (true);
revoke insert, update, delete, truncate on public.custom_cards from anon, authenticated;
create index if not exists custom_cards_created_by on public.custom_cards (created_by);

create or replace function public.admin_add_card(p_front text, p_back text, p_ex text default null, p_hook text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.custom_cards (front, back, ex, hook, created_by)
  values (btrim(p_front), btrim(p_back), nullif(btrim(coalesce(p_ex, '')), ''),
          nullif(btrim(coalesce(p_hook, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_delete_card(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.custom_cards where id = p_id;
  if not found then raise exception 'not_found'; end if;
  delete from public.card_states where card_id = 'custom/' || p_id;
end;
$$;

-- ———————————————————— official bank ————————————————————
-- Admin text is stored escaped: the bank renders question_html as HTML.
create or replace function public.html_text(p text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(replace(replace(coalesce(p, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;'), E'\n', '<br>');
$$;

create or replace function public.admin_add_sat_question(
  p_domain text, p_skill text, p_difficulty text, p_prompt text,
  p_choices text[], p_answer text, p_explanation text default ''
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id text := 'adm' || substr(md5(gen_random_uuid()::text), 1, 9);
  v_mcq boolean := coalesce(array_length(p_choices, 1), 0) > 0;
  v_accepted text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_domain not in ('Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry')
     or char_length(btrim(coalesce(p_skill, ''))) not between 1 and 120
     or p_difficulty not in ('Easy', 'Medium', 'Hard')
     or char_length(btrim(coalesce(p_prompt, ''))) not between 1 and 2000
     or char_length(coalesce(p_explanation, '')) > 3000 then
    raise exception 'invalid_input';
  end if;
  if v_mcq then
    if array_length(p_choices, 1) <> 4
       or exists (select 1 from unnest(p_choices) c where char_length(btrim(c)) not between 1 and 300)
       or p_answer not in ('A', 'B', 'C', 'D') then
      raise exception 'invalid_input';
    end if;
    v_accepted := '{}';
  else
    -- grid-in: every accepted value, separated by "|" (e.g. 3/4|.75)
    select array_agg(btrim(a)) into v_accepted
    from unnest(string_to_array(coalesce(p_answer, ''), '|')) a where btrim(a) <> '';
    if coalesce(array_length(v_accepted, 1), 0) = 0 or array_length(v_accepted, 1) > 10 then
      raise exception 'invalid_input';
    end if;
  end if;

  insert into public.sat_math_questions (
    id, domain, skill, difficulty, question_type, question_html, question_text, choices,
    correct_answer, accepted_answers, explanation_html, explanation_text, source
  ) values (
    v_id, p_domain, btrim(p_skill), p_difficulty,
    case when v_mcq then 'multiple_choice' else 'student_response' end,
    '<p>' || public.html_text(btrim(p_prompt)) || '</p>', btrim(p_prompt),
    case when v_mcq then (
      select jsonb_agg(jsonb_build_object('label', chr(64 + n::int),'html', public.html_text(btrim(c))) order by n)
      from unnest(p_choices) with ordinality as t(c, n)
    ) else '[]'::jsonb end,
    case when v_mcq then p_answer else v_accepted[1] end, v_accepted,
    nullif('<p>' || public.html_text(btrim(coalesce(p_explanation, ''))) || '</p>', '<p></p>'),
    nullif(btrim(coalesce(p_explanation, '')), ''), 'admin'
  );
  return v_id;
end;
$$;

-- only admin-written items can be deleted; the College Board bank stays intact
create or replace function public.admin_delete_sat_question(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.sat_math_questions where id = p_id and source = 'admin';
  if not found then raise exception 'not_found'; end if;
end;
$$;

revoke execute on function
  public.admin_save_question(jsonb, boolean), public.admin_review_card(text, boolean),
  public.admin_add_card(text, text, text, text), public.admin_delete_card(uuid),
  public.admin_add_sat_question(text, text, text, text, text[], text, text), public.admin_delete_sat_question(text)
from public, anon;
grant execute on function
  public.admin_save_question(jsonb, boolean), public.admin_review_card(text, boolean),
  public.admin_add_card(text, text, text, text), public.admin_delete_card(uuid),
  public.admin_add_sat_question(text, text, text, text, text[], text, text), public.admin_delete_sat_question(text)
to authenticated;

notify pgrst, 'reload schema';
