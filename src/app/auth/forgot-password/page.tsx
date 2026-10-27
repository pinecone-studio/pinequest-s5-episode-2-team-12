import { AuthPanel } from '@/features/auth/components/AuthPanel';
import { RecoveryForm } from '@/features/auth/components/RecoveryForm';
import { callbackFailure } from '@/features/auth/lib/errors';
import { hasSupabase } from '@/lib/env';
import { getT } from '@/lib/i18n';
export const metadata = { title: getT('auth')('recovery.title') };
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuthPanel>
      <RecoveryForm mode="request" configured={hasSupabase()} initialError={callbackFailure(params.error)} />
    </AuthPanel>
  );
}
