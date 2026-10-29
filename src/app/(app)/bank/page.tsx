import { BankTopics } from '@/features/practice/components/BankTopics';
import { OfficialBank } from '@/features/practice/components/OfficialBank';
import { parseOfficialFilter } from '@/features/practice/lib/official';
import { realPracticeQuestions } from '@/features/practice/lib/topic-bank';
import { listOfficialHardQuestions, listOfficialQuestions } from '@/features/practice/official-queries';
import { listQuestionsWithSource } from '@/features/practice/queries';

// Section C · C2 — real hard questions by topic; the full official bank remains available.
export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Preserve the original official bank and its URL filters as an optional view.
  if (
    params.view === 'official' ||
    params.domain ||
    params.skill ||
    params.difficulty ||
    params.q ||
    params.page
  ) {
    const filter = parseOfficialFilter(params);
    const official = await listOfficialQuestions(filter);
    if (official) return <OfficialBank data={official} filter={filter} />;
  }

  const [practice, official] = await Promise.all([
    listQuestionsWithSource({ difficulty: 3 }),
    listOfficialHardQuestions(),
  ]);
  return (
    <BankTopics
      questions={realPracticeQuestions(practice)}
      officialQuestions={official ?? []}
      sourceUnavailable={practice.source === 'mock' && official === null}
    />
  );
}
