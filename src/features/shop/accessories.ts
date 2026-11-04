import type { AccessorySlot } from './catalog';

export type AccessoryAsset = {
  src: string;
  slot: AccessorySlot;
  height: number;
  top: number;
  previewWidth: number;
  previewTop: number;
  aspect: number;
};

export const ACCESSORY_ASSETS: Record<string, AccessoryAsset> = {
  'outfit-hat': {
    src: '/brand/shop-accessories/hat.png',
    slot: 'head',
    height: 24,
    top: -1,
    previewWidth: 45,
    previewTop: -5,
    aspect: 1402 / 1122,
  },
  'outfit-scarf': {
    src: '/brand/shop-accessories/scarf.png',
    slot: 'neck',
    height: 34,
    top: 43,
    previewWidth: 38,
    previewTop: 90,
    aspect: 1479 / 1063,
  },
  'outfit-glasses': {
    src: '/brand/shop-accessories/sunglasses.png',
    slot: 'eyes',
    height: 21,
    top: 24,
    previewWidth: 58,
    previewTop: 48,
    aspect: 2009 / 783,
  },
  'outfit-crown': {
    src: '/brand/shop-accessories/crown.png',
    slot: 'head',
    height: 24,
    top: -1,
    previewWidth: 53,
    previewTop: -10,
    aspect: 1774 / 887,
  },
};
