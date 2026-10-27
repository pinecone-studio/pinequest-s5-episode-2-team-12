// Desmos Академи · /desmos/ai. POST { question, answer? } → a step-by-step Desmos lesson.
// 1. The 6 pitch questions get their hand-written sample lesson (labelled «Жишээ хичээл»). With the model off,
//    keyword matches count too (demo); with it on, only the exact sample question does.
// 2. Otherwise Suu writes the lesson live (OLLAMA_URL), checked by parseModelLesson before it is sent.
// 3. Model off or every try failed the checks → { lesson: null } and the page says so.
import { z } from 'zod';
import { findLesson } from '@/features/tutor/lib/desmos-lessons';
import { modelDesmosLesson } from '@/server/ai/desmos-lesson';
import { hasOllama } from '@/server/ai/ollama-client';

/** A laptop model needs ~10–30 s per lesson; hosts like Vercel cut functions at their default limit. */
export const maxDuration = 60;

const Body = z.object({
  question: z.string().trim().min(3).max(600),
  answer: z.string().trim().max(40).optional(),
});

/** Same short pause as the tutor, so a sample lesson doesn't appear instantly. */
const SAMPLE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 900;

export type DesmosLessonResponse =
  | {
      lesson: NonNullable<ReturnType<typeof findLesson>>;
      source: 'sample' | 'model';
      answerFrom?: 'student' | 'model';
      technique?: string | null;
    }
  | { lesson: null; source: 'none'; reason: 'off' | 'failed' };

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'bad_request' }, { status: 400 });
  const { question, answer } = parsed.data;

  // With the model on, only the 6 sample questions themselves get a sample; everything else goes to Suu.
  const modelOn = hasOllama('desmos');
  const sample = findLesson(question, { exact: modelOn });
  if (sample) {
    await new Promise((r) => setTimeout(r, SAMPLE_DELAY_MS));
    return Response.json({ lesson: sample, source: 'sample' } satisfies DesmosLessonResponse);
  }

  if (!modelOn) {
    return Response.json({ lesson: null, source: 'none', reason: 'off' } satisfies DesmosLessonResponse);
  }
  const res = await modelDesmosLesson(question, answer || undefined);
  if (!res) {
    return Response.json({ lesson: null, source: 'none', reason: 'failed' } satisfies DesmosLessonResponse);
  }
  return Response.json({
    lesson: res.lesson,
    source: 'model',
    answerFrom: res.answerFrom,
    technique: res.technique,
  } satisfies DesmosLessonResponse);
}
