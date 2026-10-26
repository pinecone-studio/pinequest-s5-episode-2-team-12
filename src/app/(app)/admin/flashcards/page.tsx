import { FlashcardAdmin } from '@/features/flashcards/components/FlashcardAdmin';
import { listReviewedCards } from '@/features/flashcards/queries';
import { adminUserId } from '@/features/roadmap/admin';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('flashcards')('admin.title') };

// Section E · admins approve drafted flashcards (content/cards JSON ships with reviewed: false).
export default async function FlashcardAdminPage() {
  const [who, reviewed] = await Promise.all([adminUserId(), listReviewedCards().catch(() => [])]);
  return <FlashcardAdmin canEdit={!('reason' in who)} reviewed={reviewed} />;
}
