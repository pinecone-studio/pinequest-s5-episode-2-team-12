import { adminUserId } from '@/features/roadmap/admin';
import { QuestionReview } from '@/features/roadmap/components/QuestionReview';
import { AUTHORED, PLACEMENT } from '@/features/roadmap/content/bank';
import type { RoadmapQuestion } from '@/features/roadmap/content/schema';
import { getT } from '@/lib/i18n';
import { getDb } from '@/lib/supabase/server';
import { getQuestionsTable } from '@/server/db';

export const metadata = { title: getT('roadmap')('pages.admin.title') };

// Section A · review of the original roadmap questions. Admins (profiles.role = 'admin') approve or edit;
// without Supabase the page is a read-only view of content/roadmap.
export default async function AdminQuestionsPage() {
  const t = getT('roadmap');
  const who = await adminUserId();
  let questions: RoadmapQuestion[] = [...AUTHORED, ...PLACEMENT];
  if ('id' in who) {
    // stored rows (edited / approved) replace their bundled copy; questions never saved stay as bundled drafts
    const db = await getDb();
    const { data } = (await db
      ?.from(getQuestionsTable())
      .select('content')
      .in(
        'id',
        questions.map((q) => q.id),
      )) ?? { data: null };
    const saved = new Map(
      (data ?? []).map((r) => [(r.content as RoadmapQuestion).id, r.content as RoadmapQuestion]),
    );
    questions = questions.map((q) => saved.get(q.id) ?? q);
  }
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">{t('pages.admin.title')}</h1>
        <p className="mt-2 text-sm text-ink-2">{t('admin.lead')}</p>
      </header>
      {'reason' in who && who.reason === 'forbidden' ? (
        <p className="soft-card p-6 text-ink-2">{t('admin.forbidden')}</p>
      ) : (
        <>
          {'reason' in who && (
            <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">{t('admin.readOnly')}</p>
          )}
          <QuestionReview questions={questions} readOnly={'reason' in who} />
        </>
      )}
    </div>
  );
}
