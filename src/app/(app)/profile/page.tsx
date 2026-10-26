import { ComingSoon } from '@/components/ComingSoon';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('common')('shell.profile') };

// Placeholder until phase 5 of docs/plans/2026-10-25-map-home-plan.md
export default function Page() {
  return <ComingSoon section="F" title={getT('common')('shell.profile')} tasks="5-р үе шат" />;
}
