import { getDb } from '@/lib/supabase/server';
export async function GET() {
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  return Response.json({ owner: user?.id ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
