import { adminUserId } from '@/features/roadmap/admin';
import { QuestionReview } from '@/features/roadmap/components/QuestionReview';
import { AUTHORED, PLACEMENT } from '@/features/roadmap/content/bank';
import type { RoadmapQuestion } from '@/features/roadmap/content/schema';
import { getT } from '@/lib/i18n';
import { getDb } from '@/lib/supabase/server';

export const metadata = { title: getT('roadmap')('pages.admin.title') };

// Section A · review of the original roadmap questions. Admins (profiles.role = 'admin') approve or edit;
// without Supabase the page is a read-only view of content/roadmap.
export default async function AdminQuestionsPage() {
  const t = getT('roadmap');
  const who = await adminUserId();
  let questions: RoadmapQuestion[] = [...AUTHORED, ...PLACEMENT];
  if ('id' in who) {
    const db = await getDb();
    const { data } = (await db?.from('questions').select('content').not('topic_id', 'is', null)) ?? {
      data: null,
    };
    if (data?.length) questions = data.map((r) => r.content as RoadmapQuestion);
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
