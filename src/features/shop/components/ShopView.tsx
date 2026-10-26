'use client';
import { useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { MascotArt } from '@/components/brand/MascotArt';
import { Button } from '@/components/ui/Button';
// /shop: the gem balance, how gems are earned, and the catalog by group. Buying asks for a confirmation and
// goes through the wallet (purchase_item on the server, idempotent by key); cosmetics can be equipped.
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { EARN, ITEMS, type ItemKind, type ShopItem } from '../catalog';
import { useWallet } from '../lib/use-wallet';
import type { ServerWallet } from '../queries';

const GROUPS: ItemKind[] = ['outfit', 'consumable', 'frame', 'skin', 'banner'];

function Preview({ item, name, avatarId }: { item: ShopItem; name: string; avatarId?: string }) {
  if (item.art) return <MascotArt art={item.art} size={112} className="mx-auto" />;
  if (item.kind === 'frame') return <Avatar name={name} avatarId={avatarId} size={56} frame={item.id} />;
  if (item.kind === 'outfit') return <Avatar name={name} avatarId={avatarId} size={44} outfit={item.id} />;
  if (item.kind === 'banner')
    return <span className="block h-14 w-full rounded-xl" style={{ background: item.look }} />;
  if (item.kind === 'skin')
    return (
      // biome-ignore lint/performance/noImgElement: tiny static preview of the baked terrain
      <img
        src="/map/terrain-1024.webp"
        alt=""
        className={cn(
          'h-14 w-full rounded-xl object-cover',
          item.look === 'winter' ? 'saturate-[.25] brightness-125' : 'brightness-50 hue-rotate-[195deg]',
        )}
      />
    );
  return (
    <span className="grid size-14 place-items-center rounded-2xl bg-sage text-2xl">
      {item.id === 'streak-freeze' ? '🧊' : '💡'}
    </span>
  );
}

export function ShopView({
  demo,
  wallet: server,
  name,
  avatarId,
}: {
  demo: boolean;
  wallet: ServerWallet | null;
  name: string;
  avatarId?: string;
}) {
  const t = useT('shop');
  const w = useWallet(demo, server);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const buy = async (item: ShopItem) => {
    setBusy(true);
    const r = await w.buy(item.id);
    setBusy(false);
    setConfirming(null);
    toast(r.ok ? t('bought') : r.reason === 'insufficient' ? t('insufficient') : t('failed'));
  };

  return (
    <div className="workspace-page max-w-6xl">
      <PageHeader title={t('title')} description={t('lead')} icon="shop">
        <p className="rounded-2xl border border-line bg-sage px-5 py-3 text-right">
          <span className="block text-[12px] text-ink-3">{t('balance')}</span>
          <span className="font-display text-3xl font-bold text-ink tnum" data-testid="gem-balance">
            {w.balance}
          </span>
        </p>
      </PageHeader>

      <details className="soft-card p-5">
        <summary className="cursor-pointer font-bold text-ink">{t('earn.title')}</summary>
        <ul className="mt-3 grid gap-1 text-[14px] text-ink-2">
          <li>{t('earn.stop', { n: EARN.stopPass, s: EARN.perStar })}</li>
          <li>{t('earn.region', { n: EARN.region })}</li>
          <li>{t('earn.daily', { n: EARN.daily })}</li>
          <li>{t('earn.mock', { n: EARN.mock })}</li>
          <li>{t('earn.streak', { a: EARN.streak[7], b: EARN.streak[30] })}</li>
        </ul>
      </details>

      {GROUPS.map((g) => (
        <section key={g} className="grid gap-3" aria-labelledby={`shop-${g}`}>
          <h2 id={`shop-${g}`} className="font-bold text-[17px] text-ink">
            {t(`groups.${g}`)}
          </h2>
          {g === 'outfit' && <p className="text-sm text-ink-2">{t('collection.lead')}</p>}
          <ul
            className={cn(
              'grid gap-3',
              g === 'outfit' ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
            )}
          >
            {ITEMS.filter((i) => i.kind === g).map((item) => {
              const owned = w.owned[item.id] ?? 0;
              const isOn = item.kind !== 'consumable' && w.equipped[item.kind] === item.id;
              const cosmeticOwned = item.kind !== 'consumable' && owned > 0;
              const nm = t(`items.${item.id}.name`);
              return (
                <li key={item.id} className="soft-card wardrobe-card grid content-between gap-4 p-4">
                  <div
                    className={cn('gap-3', item.kind === 'outfit' ? 'grid text-center' : 'flex items-start')}
                  >
                    <div
                      className={cn(
                        'shrink-0',
                        item.kind === 'outfit' ? 'wardrobe-preview w-full rounded-2xl py-5' : 'w-24',
                      )}
                    >
                      <Preview item={item} name={name} avatarId={avatarId} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{nm}</p>
                      <p className="text-[13px] text-ink-2">{t(`items.${item.id}.desc`)}</p>
                      {item.kind === 'consumable' && owned > 0 && (
                        <p className="mt-1 text-[12px] text-ink-3">{t('qty', { n: owned })}</p>
                      )}
                    </div>
                  </div>
                  {confirming === item.id ? (
                    <div
                      className="grid gap-2 rounded-2xl bg-paper-2 p-3"
                      role="group"
                      aria-label={t('confirm', { name: nm, price: item.price })}
                    >
                      <p className="text-[13px] font-semibold text-ink">
                        {t('confirm', { name: nm, price: item.price })}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => buy(item)} disabled={busy}>
                          {t('yes')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          {t('no')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {cosmeticOwned ? (
                        <>
                          <Pill tone="leaf">{isOn ? t('equipped') : t('owned')}</Pill>
                          <Button
                            size="sm"
                            variant={isOn ? 'ghost' : 'secondary'}
                            onClick={() => w.equip(item.id)}
                          >
                            {isOn ? t('unequip') : t('equip')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setConfirming(item.id)}
                          disabled={w.balance < item.price}
                          aria-label={`${t('buy')}: ${nm}, ${item.price} 💎`}
                        >
                          {t('buy')} · {item.price} 💎
                        </Button>
                      )}
                      {!cosmeticOwned && w.balance < item.price && (
                        <span className="text-[12px] text-ink-3">{t('insufficient')}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
