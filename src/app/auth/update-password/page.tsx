import { AuthPanel } from '@/features/auth/components/AuthPanel';
import { RecoveryForm } from '@/features/auth/components/RecoveryForm';
import { hasSupabase } from '@/lib/env';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';
export const metadata = { title: getT('auth')('recovery.updateTitle') };
export default async function UpdatePasswordPage() {
  const session = await getSession();
  return (
    <AuthPanel>
      <RecoveryForm
        mode="update"
        configured={hasSupabase()}
        allowed={session?.kind === 'user' && !session.anonymous}
      />
    </AuthPanel>
  );
}
