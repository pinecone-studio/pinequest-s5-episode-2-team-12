-- Answers stay on the server. Until now any signed-in (or anon) client could select questions.content,
-- answer and explanation included, so a duel or daily-challenge answer was one query away. Now only admins
-- read the table directly; students get questions through Server Actions (service role), which strip the
-- answer while a timed question is open and re-grade every submission.

drop policy if exists "reviewed questions are public" on public.questions;
drop policy if exists "admins read questions" on public.questions;
create policy "admins read questions" on public.questions
  for select using (public.is_admin());

revoke select on public.questions from anon;
