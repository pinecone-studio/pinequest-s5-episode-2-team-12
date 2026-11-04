// Section G · the tutor chat. Who answers, in order:
//   1. pitch questions → a hand-written sample answer (labelled), see scripted.ts
//   2. Suu (our fine-tuned model on Ollama) when OLLAMA_SKILLS allows its 'chat' skill
//   3. Gemini (GEMINI_API_KEY) for free chat — with the facts the server checked: the bank problem, a code-graded
//      verdict on the student's answer, the Desmos lesson Suu drew in the side panel (src/server/ai/gemini-chat.ts)
//   4. otherwise a demo reply that says so (`demo: true`)
// A typed equation in free chat is also solved by code (lib/equation-graph.ts, the same solver that draws the
// graph next to the chat): a model reply is used only when it states that answer, otherwise the solver's steps.
// Suu still writes every Desmos lesson (/api/desmos/lesson). Keys and model URLs stay on the server.
import { z } from 'zod';
import { equationReply, replyAgrees } from '@/features/tutor/lib/equation-graph';
import { geminiTutorReply, hasGeminiChat, verdictFor } from '@/server/ai/gemini-chat';
import { hasOllama } from '@/server/ai/ollama-client';
import { withVerdict } from '@/server/ai/verdict';
import { ollamaReply } from '@/server/tutor/ollama';
import { scriptedReply } from '@/server/tutor/scripted';

export const maxDuration = 60;

const Body = z.object({
  mode: z.enum(['hint', 'explain', 'desmos', 'similar', 'translate']).default('hint'),
  message: z.string().min(1).max(2000),
  /** Free chat: send the student's text as is, without the quick-action request phrase. */
  raw: z.boolean().default(false),
  context: z
    .object({
      kind: z.enum(['lesson', 'desmos', 'question', 'mistake', 'topic', 'general']),
      id: z.string().max(100).optional(),
    })
    .optional(),
  /** The student answered or unlocked the answer, so the correct answer may be said. */
  revealed: z.boolean().default(false),
  /** Earlier turns of this chat (the browser keeps them), oldest first. */
  history: z
    .array(z.object({ role: z.enum(['user', 'suu']), text: z.string().max(2000) }))
    .max(12)
    .default([]),
  /** What the Desmos side panel shows (visible steps only). */
  panel: z
    .object({
      technique: z.string().max(60).optional(),
      step: z.number().int().min(0).max(20),
      steps: z
        .array(z.object({ text: z.string().max(600), latex: z.array(z.string().max(200)).max(12) }))
        .max(12),
    })
    .optional(),
});

/** Short pause so a sample answer appears like a normal reply instead of instantly. */
const SAMPLE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 900;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'bad_request' }, { status: 400 });
  const { mode, message, raw } = parsed.data;

  // Pitch demo: fixed questions get a hand-written answer, labelled as a sample (see scripted.ts).
  const sample = scriptedReply(message);
  if (sample) {
    await new Promise((r) => setTimeout(r, SAMPLE_DELAY_MS));
    return Response.json({ text: sample.text, lesson: sample.lesson, sample: true });
  }

  const solved = raw && !parsed.data.context ? equationReply(message) : null;
  const agrees = (text: string) => !solved || replyAgrees(text, solved.roots);
  const hint = solved?.roots
    ? `\n\n(Кодоор шалгасан хариу: ${solved.roots.map((x) => `x = ${x}`).join(', ')})`
    : '';

  if (hasOllama('chat')) {
    // the server grades the answer with code; Suu (v3 data) is trained to follow the verdict line
    const text = await ollamaReply(mode, withVerdict(message + hint, verdictFor(parsed.data)), fetch, raw);
    if (text && agrees(text)) return Response.json({ text, demo: false, model: 'suu' });
  }
  if (hasGeminiChat()) {
    const text = await geminiTutorReply({ ...parsed.data, message: message + hint });
    if (text && agrees(text)) return Response.json({ text, demo: false, model: 'gemini' });
  }
  if (solved) return Response.json({ text: solved.text, demo: false, model: 'solver' });
  return Response.json({ text: demoReply(mode), demo: true });
}
