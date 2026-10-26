import { loadShell } from '@/components/shell/load-shell';
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
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <h1 className="font-display font-bold text-[28px] text-ink">{t('title')}</h1>
      <SettingsForm initial={settings} demo={demo} account={account} />
    </div>
  );
}
