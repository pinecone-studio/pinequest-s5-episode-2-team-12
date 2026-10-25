import { ComingSoon } from '@/components/ComingSoon';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('common')('nav.flashcards') };

// Placeholder until phase 6 of docs/plans/2026-10-25-map-home-plan.md
export default function Page() {
  return <ComingSoon section="E" title={getT('common')('nav.flashcards')} tasks="6-р үе шат" />;
}
