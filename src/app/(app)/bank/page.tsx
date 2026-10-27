import { OfficialBank } from '@/features/practice/components/OfficialBank';
import { QuestionBank } from '@/features/practice/components/QuestionBank';
import { parseOfficialFilter } from '@/features/practice/lib/official';
import { listOfficialQuestions } from '@/features/practice/official-queries';
import { listQuestions } from '@/features/practice/queries';

// Section C · C2 — the official College Board questions when Supabase has them, else the sample bank.
export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseOfficialFilter(await searchParams);
  const official = await listOfficialQuestions(filter);
  if (official) return <OfficialBank data={official} filter={filter} />;

  const questions = await listQuestions();
  return <QuestionBank questions={questions} />;
}
