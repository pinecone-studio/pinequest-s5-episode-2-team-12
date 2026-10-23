import { AcademyHome } from '@/features/desmos/components/academy-home';
import { listDesmosLessons, listHacks } from '@/features/desmos/queries';

export default async function DesmosPage() {
  const [lessons, hacks] = await Promise.all([listDesmosLessons(), listHacks()]);
  return <AcademyHome lessons={lessons} hacks={hacks} />;
}
