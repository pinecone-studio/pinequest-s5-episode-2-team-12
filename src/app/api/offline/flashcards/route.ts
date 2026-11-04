import { z } from 'zod';
import { applyGrade, isCardKey } from '@/features/flashcards/grade';
import { GRADES, type Grade } from '@/lib/sm2';
import { getDb } from '@/lib/supabase/server';

const schema = z.object({
  reviews: z
    .array(
      z.object({
        id: z.string().uuid(),
        key: z.string().min(1).max(80),
        grade: z.enum(GRADES as [Grade, ...Grade[]]),
        at: z.number().int().positive(),
        owner: z.string().uuid(),
      }),
    )
    .min(1)
    .max(200),
});

// Replays offline «Шинэ үг» grades in the order they were made. Returns every id that is now settled
// (applied, already applied, or for a card that no longer exists) so the browser can drop it.
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return new Response(null, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const now = Date.now();
  const reviews = parsed.data.reviews
    .filter((r) => r.owner === user.id)
    .map((r) => ({ ...r, at: Math.min(r.at, now) }))
    .sort((a, b) => a.at - b.at);
  const settled: string[] = [];
  for (const r of reviews) {
    if (!(await isCardKey(db, r.key))) {
      settled.push(r.id);
      continue;
    }
    const inserted = await db
      .from('offline_card_reviews')
      .upsert(
        {
          id: r.id,
          user_id: user.id,
          card_id: r.key,
          grade: r.grade,
          reviewed_at: new Date(r.at).toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('id');
    if (inserted.error) return Response.json({ ids: settled }, { status: settled.length ? 200 : 503 });
    if (inserted.data.length && !(await applyGrade(db, user.id, r.key, r.grade, r.at))) {
      // recorded but not applied: remove the marker so the next sync retries it
      await db.from('offline_card_reviews').delete().eq('id', r.id);
      break;
    }
    settled.push(r.id);
  }
  return Response.json({ ids: settled });
}
