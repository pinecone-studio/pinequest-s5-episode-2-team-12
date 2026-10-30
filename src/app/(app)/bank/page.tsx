import { BankTopics } from '@/features/practice/components/BankTopics';
import { OfficialBank } from '@/features/practice/components/OfficialBank';
import { parseOfficialFilter } from '@/features/practice/lib/official';
import { countOfficialQuestionsByDomain, listOfficialQuestions } from '@/features/practice/official-queries';

// Section C · C2 — the official bank split into its four domains; each card opens that domain's pages.
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

  const counts = await countOfficialQuestionsByDomain();
  return <BankTopics counts={counts} />;
}
