import { TutorChat } from '@/features/tutor/components/TutorChat';
import { getContext } from '@/features/tutor/queries';
import { getT } from '@/lib/i18n';
import type { TutorContextKind } from '@/types';

const KINDS: TutorContextKind[] = ['lesson', 'desmos', 'question', 'mistake', 'topic', 'general'];

// Section G · G4 · G5 — /tutor?kind=question&id=a1 opens a chat about that problem; no params = free chat.
export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawKind = one(sp.kind);
  const kind = KINDS.includes(rawKind as TutorContextKind) ? (rawKind as TutorContextKind) : 'general';
  const context = await getContext(kind, one(sp.id));
  const chosen = one(sp.chosen);
  const t = getT('tutor');

  return (
    <TutorChat
      context={chosen && context.problem ? { ...context, chosen } : context}
      starters={['s1', 's2', 's3', 's4', 's5'].map((k) => t(`starters.${k}`))}
    />
  );
}
