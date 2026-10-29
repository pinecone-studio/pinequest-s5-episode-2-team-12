'use client';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { MascotArt } from '@/components/brand/MascotArt';
import { Button } from '@/components/ui/Button';
// /shop: the gem balance, how gems are earned, and the catalog by group. Buying asks for a confirmation and
// goes through the wallet (purchase_item on the server, idempotent by key); cosmetics can be equipped.
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { ACCESSORY_ASSETS } from '../accessories';
import { EARN, equipmentSlot, ITEMS, type ItemKind, outfitHasAccessory, type ShopItem } from '../catalog';
import { loadLocalWallet, saveLocalWallet } from '../lib/local-wallet';
import { useWallet } from '../lib/use-wallet';
import { earn, balance as walletBalance } from '../lib/wallet';
import type { ServerWallet } from '../queries';

const GROUPS: ItemKind[] = ['outfit', 'consumable', 'frame', 'skin'];
const FRAME_ITEMS = ITEMS.filter((item) => item.kind === 'frame');
const SKIN_ITEMS = ITEMS.filter((item) => item.kind === 'skin');
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
const ACCESSORY_IDS = Object.keys(ACCESSORY_ASSETS);
function unavailableAccessoryMessage(outfitId: string, accessoryId: string) {
  const slot = ACCESSORY_ASSETS[accessoryId]?.slot;
  if (!slot || !outfitHasAccessory(outfitId, slot)) return undefined;
  if (slot === 'head') return 'collection.tryOnAccessoryUnavailableHeadwear';
  if (slot === 'eyes') return 'collection.tryOnAccessoryUnavailableGlasses';
  if (outfitId === 'outfit-winter-knit') return 'collection.tryOnAccessoryUnavailableWinter';
  return undefined;
}
type AccessoryFit = { height?: number; top?: number };
const OUTFIT_ACCESSORY_FIT: Record<string, Record<string, AccessoryFit>> = {
  'outfit-deel-gold': { 'outfit-scarf': { height: 38, top: 41 } },
  'outfit-scholar': { 'outfit-scarf': { height: 37, top: 41 } },
  'outfit-beret': {
    'outfit-scarf': { height: 37, top: 41 },
    'outfit-hat': { height: 21, top: -2 },
    'outfit-crown': { height: 20, top: -2 },
  },
  'outfit-denim': { 'outfit-scarf': { height: 40, top: 41 } },
  'outfit-heart': { 'outfit-scarf': { height: 43, top: 41 } },
  'outfit-sherpa': { 'outfit-scarf': { height: 40, top: 41 } },
  'outfit-tracksuit': { 'outfit-scarf': { height: 39, top: 41 } },
  'outfit-deel-green': {
    'outfit-hat': { height: 20, top: 1 },
    'outfit-crown': { height: 20, top: 1 },
  },
  'outfit-knit-glasses': { 'outfit-glasses': { height: 24, top: 23 } },
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
    'outfit-glasses': { height: 24, top: 23 },
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
  if (item.art) return <MascotArt art={item.art} size={88} className="mx-auto" />;
  if (item.kind === 'frame') return <Avatar name={name} avatarId={avatarId} size={56} frame={item.id} />;
  if (item.kind === 'outfit') {
    const accessory = ACCESSORY_ASSETS[item.id];
    if (accessory) {
      return (
        <span className="relative mx-auto grid h-[100px] w-[100px] place-items-center">
          <MascotArt size={88} />
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
  preview = false,
}: {
  demo: boolean;
  wallet: ServerWallet | null;
  name: string;
  avatarId?: string;
  preview?: boolean;
}) {
  const t = useT('shop');
  const w = useWallet(demo, server);
  useEffect(() => {
    if (!demo || !preview) return;
    const localWallet = loadLocalWallet();
    const grantKey = 'shop-preview-gems-100000';
    const alreadyGranted = localWallet.events.some((event) => event.key === grantKey);
    const grantAmount = Math.max(0, 100_000 - walletBalance(localWallet));
    if (!alreadyGranted && grantAmount > 0) {
      saveLocalWallet(earn(localWallet, grantAmount, 'local-gift', grantKey));
    }
  }, [demo, preview]);
  const earningsRef = useRef<HTMLDetailsElement>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const tryOnItems = ITEMS.filter((item) => item.kind === 'outfit' && item.art);
  const [tryOnId, setTryOnId] = useState(tryOnItems[0]?.id ?? null);
  const [tryOnAccessoryIds, setTryOnAccessoryIds] = useState<string[]>([]);
  const tryOnItem = tryOnItems.find((item) => item.id === tryOnId) ?? tryOnItems[0];
  const tryOnAccessories = ITEMS.filter((item) => tryOnAccessoryIds.includes(item.id));
  const equipIfOwned = (item: ShopItem) => {
    if (
      item.kind !== 'consumable' &&
      !(item.accessorySlot && outfitHasAccessory(w.equipped.outfit, item.accessorySlot)) &&
      (w.owned[item.id] ?? 0) > 0 &&
      w.equipped[equipmentSlot(item)] !== item.id
    ) {
      void w.equip(item.id);
    }
  };
  const selectOutfit = (id: string) => {
    setTryOnId(id);
    const item = ITEMS.find((candidate) => candidate.id === id);
    if (item) equipIfOwned(item);
    setTryOnAccessoryIds((selected) =>
      selected.filter((accessoryId) => !unavailableAccessoryMessage(id, accessoryId)),
    );
  };
  const [framePreviewId, setFramePreviewId] = useState(FRAME_ITEMS[0]?.id ?? null);
  const [skinPreviewId, setSkinPreviewId] = useState('skin-default');
  const framePreview = FRAME_ITEMS.find((item) => item.id === framePreviewId) ?? FRAME_ITEMS[0];
  const skinPreview =
    SKIN_ITEMS.find((item) => item.id === skinPreviewId) ??
    (skinPreviewId === 'skin-default'
      ? { id: 'skin-default', kind: 'skin' as const, price: 0, look: 'default' }
      : SKIN_ITEMS[0]);
  const buy = async (item: ShopItem) => {
    setBusy(true);
    try {
      const r = await w.buy(item.id);
      if (
        r.ok &&
        item.kind !== 'consumable' &&
        !(item.accessorySlot && outfitHasAccessory(w.equipped.outfit, item.accessorySlot))
      ) {
        await w.equip(item.id);
      }
      toast(r.ok ? t('bought') : r.reason === 'insufficient' ? t('insufficient') : t('failed'));
    } catch {
      toast(t('failed'));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const explainEarning = () => {
    const details = earningsRef.current;
    if (details) details.open = true;
    details?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(t('insufficient'));
  };

  return (
    <div className="workspace-page max-w-6xl shop-page">
      <div className="shop-catalog-flow">
        <section
          className="shop-hero relative overflow-hidden rounded-[28px] border p-6 sm:p-9"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 86% 48%, rgba(205,172,75,.28), transparent 48%), linear-gradient(105deg, #07271d 0%, #0c3b2a 58%, #28533a 100%)',
          }}
          aria-label={t('title')}
        >
          <div className="shop-hero-glow pointer-events-none absolute -right-10 -top-16 size-64 rounded-full blur-3xl" />
          {/* biome-ignore lint/performance/noImgElement: transparent terrain art is a decorative shop backdrop */}
          <img
            src="/map/terrain-1024.webp"
            alt=""
            aria-hidden="true"
            className="shop-terrain pointer-events-none absolute right-0 top-1/2 w-[58%] max-w-[720px] -translate-y-1/2 object-contain"
            style={{ filter: 'saturate(1.2) brightness(.92)' }}
          />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-[#d8efc2]">
                  ✦ {t('hero.eyebrow')}
                </span>
                <div className="shop-hero-balance flex items-center gap-2 rounded-2xl border border-white/20 bg-[#062b20]/65 px-3 py-2.5 text-white shadow-lg backdrop-blur-md sm:absolute sm:right-6 sm:top-6">
                  <span aria-hidden="true">💎</span>
                  <span className="text-xs font-semibold text-white/75">{t('balance')}</span>
                  <strong data-testid="gem-balance" className="font-display text-xl leading-none">
                    {w.balance}
                  </strong>
                </div>
              </div>
              <h1 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {t('title')}
              </h1>
              <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-[#d8efc2] sm:text-3xl">
                {t('hero.title')}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#e2eee6]/85 sm:text-base">
                {t('hero.desc')}
              </p>
            </div>
          </div>
        </section>

        <div className="shop-tools flex flex-col gap-3 rounded-2xl border border-[#d9e4da] bg-[#fbfcf8]/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex gap-1 overflow-x-auto" aria-label={t('browse.label')}>
            {GROUPS.map((g) => (
              <a
                key={g}
                href={`#shop-${g}`}
                className="shop-category-link shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition"
              >
                {t(`groups.${g}`)}
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <label className="shop-search flex min-w-40 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm sm:flex-none">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">{t('browse.search')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('browse.search')}
                className="w-full bg-transparent text-ink outline-none placeholder:text-[#829187] sm:w-36"
              />
            </label>
          </div>
        </div>

        <details ref={earningsRef} className="soft-card p-5">
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
          <section key={g} className="shop-section grid gap-3" aria-labelledby={`shop-${g}`}>
            <h2 id={`shop-${g}`} className="shop-section-title font-bold text-[17px] text-ink">
              {t(`groups.${g}`)}
            </h2>
            {g === 'outfit' && <p className="text-sm text-ink-2">{t('collection.lead')}</p>}
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
            <ul
              className={cn(
                'grid gap-3',
                g === 'outfit' ? 'grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
              {g === 'skin' && (
                <li className="soft-card wardrobe-card grid content-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setSkinPreviewId('skin-default');
                        const result = await w.selectDefaultMap();
                        if (!result.ok) toast(t('failed'));
                      }}
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
              {ITEMS.filter(
                (i) =>
                  i.kind === g &&
                  (!search ||
                    `${t(`items.${i.id}.name`)} ${t(`items.${i.id}.desc`)}`
                      .toLocaleLowerCase()
                      .includes(search.toLocaleLowerCase())),
              ).map((item) => {
                const owned = w.owned[item.id] ?? 0;
                const isOn = item.kind !== 'consumable' && w.equipped[equipmentSlot(item)] === item.id;
                const cosmeticOwned = item.kind !== 'consumable' && owned > 0;
                const unavailable = item.accessorySlot
                  ? unavailableAccessoryMessage(w.equipped.outfit ?? '', item.id)
                  : undefined;
                const nm = t(`items.${item.id}.name`);
                return (
                  <li
                    key={item.id}
                    data-outfit-selected={
                      item.kind === 'outfit' && item.art && tryOnItem?.id === item.id ? 'true' : undefined
                    }
                    className={cn(
                      'soft-card wardrobe-card grid content-between gap-4 p-4',
                      item.kind === 'outfit' && item.art && 'shop-outfit-card',
                    )}
                  >
                    <div
                      className={cn(
                        'gap-3',
                        item.kind === 'outfit' ? 'grid text-center' : 'flex items-start',
                      )}
                    >
                      {item.kind === 'outfit' && item.art ? (
                        <button
                          type="button"
                          onClick={() => selectOutfit(item.id)}
                          aria-label={t('collection.tryOn', { name: nm })}
                          aria-pressed={tryOnItem?.id === item.id}
                          className={cn(
                            'shrink-0 wardrobe-preview w-full rounded-2xl py-2 transition',
                            tryOnItem?.id === item.id && 'ring-2 ring-leaf ring-offset-2',
                          )}
                        >
                          <Preview item={item} name={name} avatarId={avatarId} />
                          <span className="shop-outfit-choice-label">
                            {tryOnItem?.id === item.id
                              ? t('collection.selectedOutfit')
                              : t('collection.selectOutfit')}
                          </span>
                        </button>
                      ) : item.kind === 'outfit' && ACCESSORY_IDS.includes(item.id) ? (
                        <button
                          type="button"
                          onClick={() =>
                            (() => {
                              const unavailable = unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id);
                              if (unavailable) {
                                toast(t(unavailable));
                                return;
                              }
                              equipIfOwned(item);
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
                              );
                            })()
                          }
                          title={
                            unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id)
                              ? t(unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id)!)
                              : undefined
                          }
                          aria-label={t(
                            unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id) ??
                              'collection.tryOnAccessory',
                            { name: nm },
                          )}
                          aria-pressed={tryOnAccessoryIds.includes(item.id)}
                          className={cn(
                            'shrink-0 wardrobe-preview w-full rounded-2xl py-5 transition',
                            unavailableAccessoryMessage(tryOnItem?.id ?? '', item.id) && 'opacity-60',
                            tryOnAccessoryIds.includes(item.id) && 'ring-2 ring-leaf ring-offset-2',
                          )}
                        >
                          <Preview item={item} name={name} avatarId={avatarId} />
                        </button>
                      ) : item.kind === 'frame' || item.kind === 'skin' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.kind === 'frame') setFramePreviewId(item.id);
                            if (item.kind === 'skin') setSkinPreviewId(item.id);
                            equipIfOwned(item);
                          }}
                          aria-label={t(item.kind === 'frame' ? 'preview.selectFrame' : 'preview.selectMap', {
                            name: nm,
                          })}
                          aria-pressed={
                            (item.kind === 'frame' && framePreviewId === item.id) ||
                            (item.kind === 'skin' && skinPreviewId === item.id)
                          }
                          className={cn(
                            'shrink-0 w-24 rounded-xl transition',
                            ((item.kind === 'frame' && framePreviewId === item.id) ||
                              (item.kind === 'skin' && skinPreviewId === item.id)) &&
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
                        {item.kind === 'outfit' && item.art && (
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-pressed={tryOnItem?.id === item.id}
                            onClick={() => selectOutfit(item.id)}
                          >
                            {tryOnItem?.id === item.id
                              ? t('collection.selectedOutfit')
                              : t('collection.selectOutfit')}
                          </Button>
                        )}
                        {cosmeticOwned ? (
                          <>
                            <Pill tone="leaf">{isOn ? t('equipped') : t('owned')}</Pill>
                            <Button
                              size="sm"
                              variant={isOn ? 'ghost' : 'secondary'}
                              disabled={Boolean(unavailable)}
                              title={unavailable ? t(unavailable) : undefined}
                              onClick={() => w.equip(item.id)}
                            >
                              {isOn ? t('unequip') : t('equip')}
                            </Button>
                            {unavailable && <span className="text-[12px] text-ink-3">{t(unavailable)}</span>}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              w.balance < item.price ? explainEarning() : setConfirming(item.id)
                            }
                            disabled={busy}
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
            {g === 'outfit' && tryOnItem && (
              <aside className="shop-dressing-room" aria-live="polite" aria-label={t('collection.preview')}>
                <div className="shop-dressing-topline">
                  <div>
                    <p className="shop-dressing-eyebrow">✦ {t('collection.preview')}</p>
                    <h2 className="shop-dressing-title">{t('collection.tryOnTitle')}</h2>
                  </div>
                  <span className="shop-gem-chip">💎 {w.balance}</span>
                </div>
                <div className="shop-cat-stage">
                  <div className="shop-cat-orbit shop-cat-orbit-one" />
                  <div className="shop-cat-orbit shop-cat-orbit-two" />
                  <span className="shop-cat-spark shop-cat-spark-one">✦</span>
                  <span className="shop-cat-spark shop-cat-spark-two">✧</span>
                  <div className="relative isolate z-10 h-[390px] w-[350px] max-w-full">
                    {tryOnItem.art && (
                      <MascotArt
                        art={tryOnItem.art}
                        size={350}
                        alignment={OUTFIT_ART_ALIGNMENT[tryOnItem.id]}
                        className="absolute left-1/2 top-0 -translate-x-1/2"
                      />
                    )}
                    {tryOnAccessories.map((accessory) => {
                      const layer = ACCESSORY_ASSETS[accessory.id];
                      if (!layer || !tryOnItem) return null;
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
                <div className="shop-dressing-caption">
                  <span className="shop-dressing-tag">{t('collection.tryOnTitle')}</span>
                  <h3>{t(`items.${tryOnItem.id}.name`)}</h3>
                  <p>{t(`items.${tryOnItem.id}.desc`)}</p>
                </div>
                {tryOnAccessoryIds.length > 0 && (
                  <button
                    type="button"
                    className="shop-clear-accessories"
                    onClick={() => setTryOnAccessoryIds([])}
                  >
                    {t('collection.clearAccessories')}
                  </button>
                )}
                <p className="shop-dressing-hint">{t('collection.dressingHint')}</p>
              </aside>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
