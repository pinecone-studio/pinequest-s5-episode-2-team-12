import { z } from 'zod';
import {
  mapOfficialRow,
  OFFICIAL_COLUMNS,
  OFFICIAL_TABLE,
  type OfficialRow,
} from '@/features/practice/lib/official';
import { checkGridInAnswer } from '@/lib/check-answer';
import { getDb } from '@/lib/supabase/server';

const schema = z.object({
  attempts: z
    .array(
      z.object({
        id: z.string().uuid(),
        questionId: z.string().min(1).max(100),
        answer: z.string().max(200),
        at: z.string().datetime(),
        owner: z.string().uuid(),
      }),
    )
    .min(1)
    .max(100),
});
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return new Response(null, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const attempts = parsed.data.attempts.filter((a) => a.owner === user.id);
  if (!attempts.length) return Response.json({ ids: [] });
  const { data, error } = await db
    .from(OFFICIAL_TABLE)
    .select(OFFICIAL_COLUMNS)
    .in('id', [...new Set(attempts.map((a) => a.questionId))]);
  if (error) return new Response(null, { status: 503 });
  const questions = new Map(
    ((data ?? []) as OfficialRow[]).map((row) => {
      const q = mapOfficialRow(row);
      return [q.id, q] as const;
    }),
  );
  const rows = attempts.flatMap((a) => {
    const q = questions.get(a.questionId);
    return q
      ? [
          {
            id: a.id,
            user_id: user.id,
            question_id: q.id,
            answer: a.answer,
            attempted_at: a.at,
            correct: q.format === 'mcq' ? a.answer === q.answer : checkGridInAnswer(a.answer, q.accepted),
          },
        ]
      : [];
  });
  if (rows.length) {
    const result = await db
      .from('offline_question_attempts')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) return new Response(null, { status: 503 });
  }
  return Response.json({ ids: rows.map((row) => row.id) });
}
