import { ComingSoon } from '@/components/ComingSoon';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('common')('nav.friends') };

// Placeholder until phase 8 of docs/plans/2026-10-25-map-home-plan.md
export default function Page() {
  return <ComingSoon section="F" title={getT('common')('nav.friends')} tasks="8-р үе шат" />;
}
