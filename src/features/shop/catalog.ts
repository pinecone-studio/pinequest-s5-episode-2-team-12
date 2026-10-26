// Everything in the shop and how gems are earned — one place to tune the economy. Prices in gems (💎),
// earned only by studying: there are no real-money purchases.
export type Slot = 'frame' | 'outfit' | 'skin' | 'banner';
export type ItemKind = 'consumable' | Slot;

export type ShopItem = {
  id: string;
  kind: ItemKind;
  price: number;
  /** Consumables: how many one purchase adds. */
  qty?: number;
  /** Cosmetic look: a CSS color/gradient (frames, banners), an emoji (outfits), a map-skin key. */
  look?: string;
};

export const ITEMS: ShopItem[] = [
  { id: 'streak-freeze', kind: 'consumable', price: 30, qty: 1 },
  { id: 'hints-3', kind: 'consumable', price: 40, qty: 3 },

  { id: 'frame-gold', kind: 'frame', price: 80, look: 'linear-gradient(135deg, #fde68a, #d97706)' },
  { id: 'frame-lime', kind: 'frame', price: 80, look: 'linear-gradient(135deg, #bef264, #16a34a)' },
  { id: 'frame-sky', kind: 'frame', price: 80, look: 'linear-gradient(135deg, #7dd3fc, #4f46e5)' },

  { id: 'outfit-hat', kind: 'outfit', price: 120, look: '🎩' },
  { id: 'outfit-scarf', kind: 'outfit', price: 120, look: '🧣' },
  { id: 'outfit-glasses', kind: 'outfit', price: 120, look: '🕶️' },
  { id: 'outfit-crown', kind: 'outfit', price: 200, look: '👑' },

  { id: 'skin-winter', kind: 'skin', price: 300, look: 'winter' },
  { id: 'skin-night', kind: 'skin', price: 300, look: 'night' },

  { id: 'banner-steppe', kind: 'banner', price: 60, look: 'linear-gradient(120deg, #a3e635, #15803d)' },
  { id: 'banner-sunset', kind: 'banner', price: 60, look: 'linear-gradient(120deg, #fb923c, #be185d)' },
  { id: 'banner-night', kind: 'banner', price: 60, look: 'linear-gradient(120deg, #312e81, #0f172a)' },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

/** Gems per achievement. Modest on purpose: a cosmetic takes about a week of steady study. */
export const EARN = {
  stopPass: 5,
  perStar: 2,
  region: 20,
  daily: 3,
  mock: 15,
  streak: { 7: 10, 30: 40 } as Record<number, number>,
};
