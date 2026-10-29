// Everything in the shop and how gems are earned — one place to tune the economy. Prices in gems (💎),
// earned only by studying: there are no real-money purchases.
export type Slot = 'frame' | 'outfit' | 'skin' | 'banner';
export type AccessorySlot = 'head' | 'eyes' | 'neck';
export type EquipmentSlot = Slot | AccessorySlot;
export type ItemKind = 'consumable' | Slot;

export type ShopItem = {
  id: string;
  kind: ItemKind;
  price: number;
  /** Consumables: how many one purchase adds. */
  qty?: number;
  /** Cosmetic look: a CSS color/gradient (frames, banners), an emoji (outfits), a map-skin key. */
  look?: string;
  /** Accessories layer over an equipped outfit instead of replacing it. */
  accessorySlot?: AccessorySlot;
  /** Display window into the supplied outfit artwork; x, y, width, height. */
  art?: readonly [number, number, number, number];
};

const OUTFIT_BUILT_IN_ACCESSORIES: Partial<Record<string, readonly AccessorySlot[]>> = {
  'outfit-deel-green': ['head'],
  'outfit-knit-glasses': ['eyes'],
  'outfit-beret': ['head'],
  'outfit-varsity': ['head'],
  'outfit-winter-knit': ['head', 'neck'],
  'outfit-gardener': ['head'],
  'outfit-graduate': ['head'],
  'outfit-summer': ['head', 'eyes'],
};

export function outfitHasAccessory(outfitId: string | undefined, slot: AccessorySlot): boolean {
  return Boolean(outfitId && OUTFIT_BUILT_IN_ACCESSORIES[outfitId]?.includes(slot));
}

export const ITEMS: ShopItem[] = [
  { id: 'streak-freeze', kind: 'consumable', price: 30, qty: 1 },
  { id: 'hints-3', kind: 'consumable', price: 40, qty: 3 },

  { id: 'frame-gold', kind: 'frame', price: 80, look: 'linear-gradient(135deg, #fde68a, #d97706)' },
  { id: 'frame-lime', kind: 'frame', price: 80, look: 'linear-gradient(135deg, #bef264, #16a34a)' },
  { id: 'frame-sky', kind: 'frame', price: 80, look: 'linear-gradient(135deg, #7dd3fc, #4f46e5)' },

  { id: 'outfit-school-suit', kind: 'outfit', price: 120, art: [40, 0, 250, 300] },
  { id: 'outfit-school-bow', kind: 'outfit', price: 120, art: [300, 0, 270, 300] },
  { id: 'outfit-deel-blue', kind: 'outfit', price: 180, art: [585, 0, 245, 300] },
  { id: 'outfit-deel-red', kind: 'outfit', price: 180, art: [850, 0, 255, 300] },
  { id: 'outfit-deel-green', kind: 'outfit', price: 220, art: [1120, 0, 282, 300] },
  { id: 'outfit-deel-gold', kind: 'outfit', price: 180, art: [40, 300, 250, 292] },
  { id: 'outfit-knit-glasses', kind: 'outfit', price: 140, art: [300, 300, 270, 292] },
  { id: 'outfit-scholar', kind: 'outfit', price: 140, art: [585, 300, 245, 292] },
  { id: 'outfit-beret', kind: 'outfit', price: 140, art: [850, 300, 255, 292] },
  { id: 'outfit-varsity', kind: 'outfit', price: 140, art: [1120, 300, 282, 292] },
  { id: 'outfit-winter-knit', kind: 'outfit', price: 140, art: [40, 592, 250, 280] },
  { id: 'outfit-gardener', kind: 'outfit', price: 160, art: [300, 592, 270, 280] },
  { id: 'outfit-graduate', kind: 'outfit', price: 220, art: [585, 592, 245, 280] },
  { id: 'outfit-summer', kind: 'outfit', price: 160, art: [850, 592, 255, 280] },
  { id: 'outfit-mint-hoodie', kind: 'outfit', price: 120, art: [1120, 592, 282, 280] },
  { id: 'outfit-denim', kind: 'outfit', price: 120, art: [40, 872, 250, 250] },
  { id: 'outfit-heart', kind: 'outfit', price: 120, art: [300, 872, 270, 250] },
  { id: 'outfit-stripes', kind: 'outfit', price: 120, art: [585, 872, 245, 250] },
  { id: 'outfit-sherpa', kind: 'outfit', price: 140, art: [850, 872, 255, 250] },
  { id: 'outfit-tracksuit', kind: 'outfit', price: 140, art: [1120, 872, 282, 250] },

  { id: 'outfit-hat', kind: 'outfit', price: 120, look: '🎩', accessorySlot: 'head' },
  { id: 'outfit-scarf', kind: 'outfit', price: 120, look: '🧣', accessorySlot: 'neck' },
  { id: 'outfit-glasses', kind: 'outfit', price: 120, look: '🕶️', accessorySlot: 'eyes' },
  { id: 'outfit-crown', kind: 'outfit', price: 200, look: '👑', accessorySlot: 'head' },

  { id: 'skin-winter', kind: 'skin', price: 300, look: 'winter' },
  { id: 'skin-night', kind: 'skin', price: 300, look: 'night' },

  { id: 'banner-steppe', kind: 'banner', price: 60, look: 'linear-gradient(120deg, #a3e635, #15803d)' },
  { id: 'banner-sunset', kind: 'banner', price: 60, look: 'linear-gradient(120deg, #fb923c, #be185d)' },
  { id: 'banner-night', kind: 'banner', price: 60, look: 'linear-gradient(120deg, #312e81, #0f172a)' },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export function equipmentSlot(item: ShopItem): EquipmentSlot {
  if (item.accessorySlot) return item.accessorySlot;
  return item.kind === 'consumable' ? 'outfit' : item.kind;
}

/** Gems per achievement. Modest on purpose: a cosmetic takes about a week of steady study. */
export const EARN = {
  stopPass: 5,
  perStar: 2,
  region: 20,
  daily: 3,
  mock: 15,
  streak: { 7: 10, 30: 40 } as Record<number, number>,
};
