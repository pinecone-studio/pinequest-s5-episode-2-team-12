// Section G · chat history and context for a lesson/question/mistake.
import { roadmapQuestionById } from '@/features/roadmap/content/bank';
import { topicById } from '@/features/roadmap/topics';
import { getDb } from '@/lib/supabase/server';
import { DESMOS } from '@/mocks/desmos';
import { QUESTIONS } from '@/mocks/questions';
import { ALL_NODES } from '@/mocks/stages';
import type { ChatMessage, TutorContext, TutorContextKind } from '@/types';

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('tutor_messages')
    .select('role, text, mode, created_at')
    .eq('thread_id', threadId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    role: r.role,
    text: r.text,
    mode: r.mode ?? undefined,
    at: Date.parse(r.created_at),
  }));
}

/** What Суу is helping with. Unknown ids fall back to a general topic (G5). */
export async function getContext(kind: TutorContextKind = 'general', id?: string): Promise<TutorContext> {
  const general: TutorContext = { kind: 'general', title: 'SAT Math' };
  if (!id) return general;
  if (kind === 'question' || kind === 'mistake') {
    // roadmap stops send their own (rm…) questions; the topic title is more useful to Суу than the CB skill
    const q = QUESTIONS.find((x) => x.id === id) ?? roadmapQuestionById(id);
    const title = (q?.topicId && topicById(q.topicId)?.title) || q?.skill;
    return q && title ? { kind, id, title, problem: q.prompt } : general;
  }
  if (kind === 'desmos') {
    const d = DESMOS.find((x) => x.id === id);
    return d ? { kind, id, title: d.title, problem: d.question } : general;
  }
  if (kind === 'lesson') {
    const n = ALL_NODES.find((x) => x.id === id);
    return n ? { kind, id, title: n.title } : general;
  }
  return general;
}
