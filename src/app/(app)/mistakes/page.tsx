import { MistakesView } from '@/features/mistakes/components/MistakesView';
import { listNotebook } from '@/features/mistakes/notebook-queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('mistakes')('pages.mistakes.title') };

// Section D · D5 · D6 — mistake notebook with spaced review.
export default async function MistakesPage() {
  const session = await getSession().catch(() => null);
  const userId = session?.kind === 'user' ? session.userId : null;
  const server = userId
    ? await listNotebook(userId).catch(() => ({ entries: [], states: {} }))
    : { entries: [], states: {} };
  return <MistakesView demo={!userId} server={server} />;
}
