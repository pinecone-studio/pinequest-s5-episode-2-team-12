import { PracticePlayer } from '@/features/practice/components/PracticePlayer';
import { listQuestions } from '@/features/practice/queries';

// Section C · C4
export default async function PracticePage() {
  const questions = await listQuestions();

  return <PracticePlayer questions={questions} />;
}
