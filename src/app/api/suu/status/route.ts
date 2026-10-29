// GET /api/suu/status — is Suu (our fine-tuned model) reachable right now, and which AI parts are on?
// For the demo and the team: open it before showing the app. No URLs, tokens or keys, only yes/no.
import { suuStatus } from '@/server/ai/suu-status';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await suuStatus(), { headers: { 'cache-control': 'no-store' } });
}
