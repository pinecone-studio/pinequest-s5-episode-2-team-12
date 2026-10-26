import { ComingSoon } from '@/components/ComingSoon';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('common')('nav.shop') };

// Placeholder until phase 7 of docs/plans/2026-10-25-map-home-plan.md
export default function Page() {
  return <ComingSoon section="F" title={getT('common')('nav.shop')} tasks="7-р үе шат" />;
}
