import { loadShell } from '@/components/shell/load-shell';
import { PageHeader } from '@/components/ui/PageHeader';
import { type AccountInfo, SettingsForm } from '@/features/settings/components/SettingsForm';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('settings')('title') };

export default async function SettingsPage() {
  const t = getT('settings');
  const [{ settings, demo }, session] = await Promise.all([loadShell(), getSession().catch(() => null)]);
  const account: AccountInfo =
    session?.kind === 'user'
      ? session.anonymous
        ? { kind: 'anonymous' }
        : { kind: 'user', email: session.email }
      : { kind: 'demo' };
  return (
    <div className="workspace-page max-w-4xl">
      <PageHeader title={t('title')} icon="settings" />
      <SettingsForm initial={settings} demo={demo} account={account} />
    </div>
  );
}
