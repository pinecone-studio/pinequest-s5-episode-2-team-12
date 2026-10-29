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
const FRAME_ITEMS = ITEMS.filter((item) => item.kind === 'frame');
const SKIN_ITEMS = ITEMS.filter((item) => item.kind === 'skin');
const BANNER_ITEMS = ITEMS.filter((item) => item.kind === 'banner');
// Align each outfit's eye center to one shared face anchor. The sheet crops have
// different padding, and centering the full silhouette would let the tail move the face.
const OUTFIT_ART_ALIGNMENT: Record<string, readonly [number, number]> = {
  'outfit-school-suit': [4, -2],
  'outfit-school-bow': [12, -2],
  'outfit-deel-blue': [12, -1],
  'outfit-deel-red': [7, -2],
  'outfit-deel-green': [22, -2],
  'outfit-deel-gold': [3, 2],
  'outfit-knit-glasses': [10, 1],
  'outfit-scholar': [12, -2],
  'outfit-beret': [6, 1],
  'outfit-varsity': [21, 0],
  'outfit-winter-knit': [2, -3],
  'outfit-gardener': [3, -4],
  'outfit-graduate': [7, -4],
  'outfit-summer': [5, 0],
  'outfit-mint-hoodie': [21, -1],
  'outfit-denim': [9, 2],
  'outfit-heart': [8, 2],
  'outfit-stripes': [10, 2],
  'outfit-sherpa': [-1, 2],
  'outfit-tracksuit': [18, 2],
};
const ACCESSORY_ASSETS: Record<
  string,
  {
    src: string;
    slot: 'head' | 'eyes' | 'neck';
    height: number;
    top: number;
    previewWidth: number;
    previewTop: number;
  }
> = {
  'outfit-hat': {
    src: '/brand/shop-accessories/hat.png',
    slot: 'head',
    height: 24,
    top: -1,
    previewWidth: 38,
    previewTop: -1,
  },
  'outfit-scarf': {
    src: '/brand/shop-accessories/scarf.png',
    slot: 'neck',
    height: 34,
    top: 47,
    previewWidth: 39,
    previewTop: 40,
  },
  'outfit-glasses': {
    src: '/brand/shop-accessories/sunglasses.png',
    slot: 'eyes',
    height: 21,
    top: 27,
    previewWidth: 48,
    previewTop: 28,
  },
  'outfit-crown': {
    src: '/brand/shop-accessories/crown.png',
    slot: 'head',
    height: 24,
    top: -1,
    previewWidth: 48,
    previewTop: -1,
  },
};
const ACCESSORY_IDS = Object.keys(ACCESSORY_ASSETS);
const OUTFITS_WITH_GLASSES = new Set(['outfit-knit-glasses', 'outfit-scholar', 'outfit-summer']);
const OUTFITS_WITH_HEADWEAR = new Set([
  'outfit-deel-green',
  'outfit-beret',
  'outfit-varsity',
  'outfit-winter-knit',
  'outfit-gardener',
  'outfit-graduate',
  'outfit-summer',
]);
function unavailableAccessoryMessage(outfitId: string, accessoryId: string) {
  if (accessoryId === 'outfit-scarf' && outfitId === 'outfit-winter-knit') {
    return 'collection.tryOnAccessoryUnavailableWinter';
  }
  if (accessoryId === 'outfit-glasses' && OUTFITS_WITH_GLASSES.has(outfitId)) {
    return 'collection.tryOnAccessoryUnavailableGlasses';
  }
  if (
    (accessoryId === 'outfit-hat' || accessoryId === 'outfit-crown') &&
    OUTFITS_WITH_HEADWEAR.has(outfitId)
  ) {
    return 'collection.tryOnAccessoryUnavailableHeadwear';
  }
  return undefined;
}
type AccessoryFit = { height?: number; top?: number };
// Some complete outfits already include glasses, scarves, or hats. Fit add-ons
// over those details individually so they read as intentional layers.
const OUTFIT_ACCESSORY_FIT: Record<string, Record<string, AccessoryFit>> = {
  'outfit-deel-gold': { 'outfit-scarf': { height: 38, top: 45 } },
  'outfit-scholar': { 'outfit-scarf': { height: 37, top: 45 } },
  'outfit-beret': {
    'outfit-scarf': { height: 37, top: 45 },
    'outfit-hat': { height: 21, top: -2 },
    'outfit-crown': { height: 20, top: -2 },
  },
  'outfit-denim': { 'outfit-scarf': { height: 40, top: 45 } },
  'outfit-heart': { 'outfit-scarf': { height: 43, top: 45 } },
  'outfit-sherpa': { 'outfit-scarf': { height: 40, top: 45 } },
  'outfit-tracksuit': { 'outfit-scarf': { height: 39, top: 45 } },
  'outfit-deel-green': {
    'outfit-hat': { height: 20, top: 1 },
    'outfit-crown': { height: 20, top: 1 },
  },
  'outfit-knit-glasses': { 'outfit-glasses': { height: 24, top: 26 } },
  'outfit-varsity': {
    'outfit-hat': { height: 21, top: -3 },
    'outfit-crown': { height: 20, top: -3 },
  },
  'outfit-winter-knit': {
    'outfit-hat': { height: 21, top: 0 },
    'outfit-crown': { height: 20, top: 0 },
  },
  'outfit-gardener': {
    'outfit-hat': { height: 20, top: 1 },
    'outfit-crown': { height: 19, top: 3 },
  },
  'outfit-graduate': {
    'outfit-hat': { height: 20, top: -2 },
    'outfit-crown': { height: 20, top: -2 },
  },
  'outfit-summer': {
    'outfit-hat': { height: 20, top: 1 },
    'outfit-crown': { height: 20, top: 1 },
    'outfit-glasses': { height: 24, top: 26 },
  },
};

function MapPreview({ look, className }: { look: string; className: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: the baked Mongolia terrain image is a static shop preview
    <img
      src="/map/terrain-1024.webp"
      alt=""
      className={cn(
        'rounded-xl object-contain',
        look === 'winter' && 'saturate-[.25] brightness-125',
        look === 'night' && 'brightness-50 hue-rotate-[195deg]',
        className,
      )}
    />
  );
}

function Preview({ item, name, avatarId }: { item: ShopItem; name: string; avatarId?: string }) {
  if (item.art) return <MascotArt art={item.art} size={112} className="mx-auto" />;
  if (item.kind === 'frame') return <Avatar name={name} avatarId={avatarId} size={56} frame={item.id} />;
  if (item.kind === 'outfit') {
    const accessory = ACCESSORY_ASSETS[item.id];
    if (accessory) {
      return (
        <span className="relative mx-auto grid size-16 place-items-center">
          <Avatar name={name} avatarId={avatarId} size={52} />
          {/* biome-ignore lint/performance/noImgElement: generated transparent shop accessory layer */}
          <img
            src={accessory.src}
            alt=""
            className="absolute left-1/2 z-10 -translate-x-1/2 object-contain"
            style={{ top: accessory.previewTop, width: accessory.previewWidth }}
          />
        </span>
      );
    }
    return <Avatar name={name} avatarId={avatarId} size={44} outfit={item.id} />;
  }
  if (item.kind === 'banner')
    return <span className="block h-14 w-full rounded-xl" style={{ background: item.look }} />;
  if (item.kind === 'skin') return <MapPreview look={item.look ?? 'default'} className="h-14 w-full" />;
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
  const tryOnItems = ITEMS.filter((item) => item.kind === 'outfit' && item.art);
  const [tryOnId, setTryOnId] = useState(tryOnItems[0]?.id ?? null);
  const [tryOnAccessoryIds, setTryOnAccessoryIds] = useState<string[]>([]);
  const tryOnItem = tryOnItems.find((item) => item.id === tryOnId) ?? tryOnItems[0];
  const tryOnAccessories = ITEMS.filter((item) => tryOnAccessoryIds.includes(item.id));
  const [framePreviewId, setFramePreviewId] = useState(FRAME_ITEMS[0]?.id ?? null);
  const [skinPreviewId, setSkinPreviewId] = useState('skin-default');
  const [bannerPreviewId, setBannerPreviewId] = useState(BANNER_ITEMS[0]?.id ?? null);
  const framePreview = FRAME_ITEMS.find((item) => item.id === framePreviewId) ?? FRAME_ITEMS[0];
  const skinPreview =
    SKIN_ITEMS.find((item) => item.id === skinPreviewId) ??
    (skinPreviewId === 'skin-default'
      ? { id: 'skin-default', kind: 'skin' as const, price: 0, look: 'default' }
      : SKIN_ITEMS[0]);
  const bannerPreview = BANNER_ITEMS.find((item) => item.id === bannerPreviewId) ?? BANNER_ITEMS[0];

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
        <div className="flex min-w-44 items-center gap-3 rounded-2xl border border-[#BCD9CC] bg-[#F3F8F5] px-4 py-3 shadow-[0_8px_22px_rgba(14,54,43,0.10)]">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#DCEDE4] text-2xl"
          >
            💎
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[13px] font-semibold text-[#31594A]">{t('balance')}</span>
            <span
              className="font-display text-3xl font-bold leading-none tracking-tight text-[#123D31] tnum"
              data-testid="gem-balance"
            >
              {w.balance}
            </span>
          </span>
        </div>
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
          {g === 'outfit' && tryOnItem && (
            <div
              className="soft-card grid gap-3 p-4 sm:grid-cols-[300px_1fr] sm:items-center"
              aria-live="polite"
            >
              <div className="wardrobe-preview grid min-h-[260px] place-items-center rounded-2xl py-4">
                <div className="relative isolate z-0 h-[220px] w-[220px]">
                  <MascotArt
                    art={tryOnItem.art}
                    size={220}
                    alignment={OUTFIT_ART_ALIGNMENT[tryOnItem.id]}
                    className="absolute left-1/2 top-0 -translate-x-1/2"
                  />
                  {tryOnAccessories.map((accessory) => {
                    const layer = ACCESSORY_ASSETS[accessory.id];
                    if (!layer) return null;
                    const fit = OUTFIT_ACCESSORY_FIT[tryOnItem.id]?.[accessory.id];
                    return (
                      /* biome-ignore lint/performance/noImgElement: generated transparent accessory artwork */
                      <img
                        key={accessory.id}
                        src={layer.src}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 object-contain"
                        style={{
                          top: `${fit?.top ?? layer.top}%`,
                          height: `${fit?.height ?? layer.height}%`,
                          width: 'auto',
                          zIndex: layer.slot === 'eyes' ? 30 : layer.slot === 'head' ? 20 : 10,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2">{t('collection.preview')}</p>
                <h3 className="mt-1 text-xl font-bold text-ink">{t(`items.${tryOnItem.id}.name`)}</h3>
                <p className="mt-1 text-sm text-ink-2">{t(`items.${tryOnItem.id}.desc`)}</p>
              </div>
            </div>
          )}
          {g === 'frame' && framePreview && (
            <div className="soft-card flex items-center gap-4 p-4" aria-live="polite">
              <div className="grid size-28 shrink-0 place-items-center rounded-2xl bg-sage">
                <Avatar name={name} avatarId={avatarId} size={104} frame={framePreview.id} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2">{t('preview.frame')}</p>
                <h3 className="mt-1 text-lg font-bold text-ink">{t(`items.${framePreview.id}.name`)}</h3>
              </div>
            </div>
          )}
          {g === 'skin' && skinPreview && (
            <div
              className="soft-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
              aria-live="polite"
            >
              <div className="grid min-h-36 place-items-center overflow-hidden rounded-2xl bg-sage p-3">
                <MapPreview look={skinPreview.look ?? 'default'} className="h-32 w-full" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2">{t('preview.map')}</p>
                <h3 className="mt-1 text-lg font-bold text-ink">
                  {skinPreview.id === 'skin-default'
                    ? t('defaultMap.name')
                    : t(`items.${skinPreview.id}.name`)}
                </h3>
                <p className="mt-1 text-sm text-ink-2">
                  {skinPreview.id === 'skin-default'
                    ? t('defaultMap.desc')
                    : t(`items.${skinPreview.id}.desc`)}
                </p>
              </div>
            </div>
          )}
          {g === 'banner' && bannerPreview && (
            <div
              className="soft-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
              aria-live="polite"
            >
              <div className="grid min-h-36 place-items-center rounded-2xl bg-sage p-3">
                <span
                  className="block h-28 w-full rounded-2xl shadow-inner"
                  style={{ background: bannerPreview.look }}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2">{t('preview.banner')}</p>
                <h3 className="mt-1 text-lg font-bold text-ink">{t(`items.${bannerPreview.id}.name`)}</h3>
                <p className="mt-1 text-sm text-ink-2">{t(`items.${bannerPreview.id}.desc`)}</p>
              </div>
            </div>
          )}
          <ul
            className={cn(
              'grid gap-3',
              g === 'outfit' ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
            )}
          >
            {g === 'skin' && (
              <li className="soft-card wardrobe-card grid content-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setSkinPreviewId('skin-default')}
                    aria-label={t('preview.selectMap', { name: t('defaultMap.name') })}
                    aria-pressed={skinPreviewId === 'skin-default'}
                    className={cn(
                      'w-24 shrink-0 rounded-xl transition',
                      skinPreviewId === 'skin-default' && 'ring-2 ring-leaf ring-offset-2',
                    )}
                  >
                    <Preview
                      item={{ id: 'skin-default', kind: 'skin', price: 0, look: 'default' }}
                      name={name}
                    />
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{t('defaultMap.name')}</p>
                    <p className="text-[13px] text-ink-2">{t('defaultMap.desc')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="leaf">{!w.equipped.skin ? t('equipped') : t('defaultMap.free')}</Pill>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!w.equipped.skin || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await w.selectDefaultMap();
                        if (!result.ok) toast(t('failed'));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t('defaultMap.use')}
                  </Button>
                </div>
              </li>
            )}
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
                    {item.kind === 'outfit' && item.art ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTryOnId(item.id);
                          setTryOnAccessoryIds((selected) =>
                            selected.filter((id) => !unavailableAccessoryMessage(item.id, id)),
                          );
                        }}
                        aria-label={t('collection.tryOn', { name: nm })}
                        aria-pressed={tryOnItem?.id === item.id}
                        className={cn(
                          'shrink-0 wardrobe-preview w-full rounded-2xl py-5 transition',
                          tryOnItem?.id === item.id && 'ring-2 ring-leaf ring-offset-2',
                        )}
                      >
                        <Preview item={item} name={name} avatarId={avatarId} />
                      </button>
                    ) : item.kind === 'outfit' && ACCESSORY_IDS.includes(item.id) ? (
                      <button
                        type="button"
                        disabled={!!unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id)}
                        onClick={() =>
                          setTryOnAccessoryIds((selected) =>
                            selected.includes(item.id)
                              ? selected.filter((id) => id !== item.id)
                              : [
                                  ...selected.filter(
                                    (id) =>
                                      !(
                                        (item.id === 'outfit-hat' || item.id === 'outfit-crown') &&
                                        (id === 'outfit-hat' || id === 'outfit-crown')
                                      ),
                                  ),
                                  item.id,
                                ],
                          )
                        }
                        aria-label={t(
                          unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id) ??
                            'collection.tryOnAccessory',
                          { name: nm },
                        )}
                        aria-pressed={tryOnAccessoryIds.includes(item.id)}
                        className={cn(
                          'shrink-0 wardrobe-preview w-full rounded-2xl py-5 transition disabled:cursor-not-allowed disabled:opacity-50',
                          tryOnAccessoryIds.includes(item.id) && 'ring-2 ring-leaf ring-offset-2',
                        )}
                      >
                        <Preview item={item} name={name} avatarId={avatarId} />
                      </button>
                    ) : item.kind === 'frame' || item.kind === 'skin' || item.kind === 'banner' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (item.kind === 'frame') setFramePreviewId(item.id);
                          if (item.kind === 'skin') setSkinPreviewId(item.id);
                          if (item.kind === 'banner') setBannerPreviewId(item.id);
                        }}
                        aria-label={t(
                          item.kind === 'frame'
                            ? 'preview.selectFrame'
                            : item.kind === 'skin'
                              ? 'preview.selectMap'
                              : 'preview.selectBanner',
                          { name: nm },
                        )}
                        aria-pressed={
                          (item.kind === 'frame' && framePreviewId === item.id) ||
                          (item.kind === 'skin' && skinPreviewId === item.id) ||
                          (item.kind === 'banner' && bannerPreviewId === item.id)
                        }
                        className={cn(
                          'shrink-0 w-24 rounded-xl transition',
                          ((item.kind === 'frame' && framePreviewId === item.id) ||
                            (item.kind === 'skin' && skinPreviewId === item.id) ||
                            (item.kind === 'banner' && bannerPreviewId === item.id)) &&
                            'ring-2 ring-leaf ring-offset-2',
                        )}
                      >
                        <Preview item={item} name={name} avatarId={avatarId} />
                      </button>
                    ) : (
                      <div
                        className={cn(
                          'shrink-0',
                          item.kind === 'outfit' ? 'wardrobe-preview w-full rounded-2xl py-5' : 'w-24',
                        )}
                      >
                        <Preview item={item} name={name} avatarId={avatarId} />
                      </div>
                    )}
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
