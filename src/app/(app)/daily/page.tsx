import { ComingSoon } from '@/components/ComingSoon';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('common')('nav.daily') };

// Placeholder until phase 6 of docs/plans/2026-10-25-map-home-plan.md
export default function Page() {
  return <ComingSoon section="C" title={getT('common')('nav.daily')} tasks="6-р үе шат" />;
}
