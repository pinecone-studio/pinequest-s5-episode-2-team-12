import { notFound } from 'next/navigation';
import { LessonRunner } from '@/features/desmos/components/lesson-runner';
import { getDesmosLesson, listDesmosLessons } from '@/features/desmos/queries';

export default async function DesmosLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await getDesmosLesson(id);
  if (!lesson) notFound();
  const lessons = await listDesmosLessons();
  const next = lessons.find((item) => item.no === lesson.no + 1);
  return <LessonRunner key={id} lesson={lesson} next={next} />;
}
