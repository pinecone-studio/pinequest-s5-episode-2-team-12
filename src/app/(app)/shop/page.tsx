import { loadShell } from '@/components/shell/load-shell';
import { getProfile } from '@/features/home/queries';
import { ShopView } from '@/features/shop/components/ShopView';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('shop')('title') };

// Section F · shop: spend gems on streak freezes, hints and cosmetics. No real-money purchases.
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [shell, profile, params] = await Promise.all([loadShell(), getProfile(), searchParams]);
  const preview = params.preview === '1';
  return (
    <ShopView
      demo={shell.demo}
      wallet={shell.wallet}
      name={profile.name}
      avatarId={profile.avatarId}
      preview={preview}
    />
  );
}
