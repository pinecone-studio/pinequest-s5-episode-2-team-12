import { redirect } from 'next/navigation';
import { addFriendByCode } from '@/features/social/actions';
import { getSession } from '@/lib/session';

// Invite link: /friends/add/ABCD2345 → friend request (signed in) → back to /friends.
export default async function AddFriendPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession().catch(() => null);
  if (session?.kind === 'user') await addFriendByCode(code);
  redirect('/friends');
}
