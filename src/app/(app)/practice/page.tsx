import Link from 'next/link';
import { PracticePlayer } from '@/features/practice/components/PracticePlayer';
import { listQuestions } from '@/features/practice/queries';
import { routes } from '@/lib/routes';

// Section C · C4
export default async function PracticePage() {
  const questions = await listQuestions();

  return (
    <div className="space-y-4">
      <Link
        href={routes.practiceAdaptive}
        className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-paper-2 px-4 text-sm font-bold text-ink hover:border-leaf"
      >
        🧠 Ухаалаг дасгал — түвшиндээ тохирсон бодлого
      </Link>
      <PracticePlayer questions={questions} />
    </div>
  );
}
