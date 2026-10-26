import { DeckHub } from '@/features/cards/DeckHub';
import { loadHub } from '@/features/cards/queries';

export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  return <DeckHub {...(await loadHub())} initialKind="word" />;
}
