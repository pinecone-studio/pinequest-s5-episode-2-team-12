import { AdaptivePractice } from '@/features/practice/components/AdaptivePractice';
import { listQuestions } from '@/features/practice/queries';

// Section C · adaptive practice: the next question is picked by the student's Elo rating per domain.
export default async function AdaptivePracticePage() {
  const questions = await listQuestions();
  return <AdaptivePractice pool={questions} />;
}
