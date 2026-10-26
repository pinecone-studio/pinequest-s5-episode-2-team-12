// The 26 stops of «Монголын аялал», in route order: west → Khangai → Gobi → east → north → Ulaanbaatar.
// Reorder freely; stop N teaches topic N (topics.ts). After moving a stop or editing lat/lng run
// `bun run roadmap:map` so the projected points in map/mongolia.generated.ts are rebuilt.
// Coordinates: Wikipedia (city centers), WGS84.
import type { Region, RegionId, Stop } from './types';

export const STOPS: Stop[] = [
  { no: 1, place: 'Өлгий', aimag: 'Баян-Өлгий', region: 'west', lat: 48.9683, lng: 89.9686 },
  { no: 2, place: 'Улаангом', aimag: 'Увс', region: 'west', lat: 49.9811, lng: 92.0667 },
  { no: 3, place: 'Ховд', aimag: 'Ховд', region: 'west', lat: 48.0042, lng: 91.6406 },
  { no: 4, place: 'Алтай', aimag: 'Говь-Алтай', region: 'west', lat: 46.3722, lng: 96.2581 },
  { no: 5, place: 'Улиастай', aimag: 'Завхан', region: 'west', lat: 47.7417, lng: 96.8444 },
  { no: 6, place: 'Мөрөн', aimag: 'Хөвсгөл', region: 'west', lat: 49.6322, lng: 100.1686 },
  { no: 7, place: 'Цэцэрлэг', aimag: 'Архангай', region: 'khangai', lat: 47.475, lng: 101.4542 },
  { no: 8, place: 'Баянхонгор', aimag: 'Баянхонгор', region: 'khangai', lat: 46.1917, lng: 100.7178 },
  {
    no: 9,
    place: 'Хархорин',
    aimag: 'Өвөрхангай (түүхэн нийслэл)',
    region: 'khangai',
    lat: 47.1972,
    lng: 102.8239,
  },
  { no: 10, place: 'Арвайхээр', aimag: 'Өвөрхангай', region: 'khangai', lat: 46.2661, lng: 102.7778 },
  { no: 11, place: 'Даланзадгад', aimag: 'Өмнөговь', region: 'gobi', lat: 43.57, lng: 104.4258 },
  { no: 12, place: 'Мандалговь', aimag: 'Дундговь', region: 'gobi', lat: 45.7667, lng: 106.2697 },
  { no: 13, place: 'Сайншанд', aimag: 'Дорноговь', region: 'gobi', lat: 44.8917, lng: 110.1367 },
  {
    no: 14,
    place: 'Замын-Үүд',
    aimag: 'Дорноговь (хилийн боомт)',
    region: 'gobi',
    lat: 43.7169,
    lng: 111.9056,
  },
  { no: 15, place: 'Чойр', aimag: 'Говьсүмбэр', region: 'gobi', lat: 46.3611, lng: 108.3611 },
  { no: 16, place: 'Баруун-Урт', aimag: 'Сүхбаатар', region: 'east', lat: 46.6814, lng: 113.2803 },
  { no: 17, place: 'Чойбалсан', aimag: 'Дорнод', region: 'east', lat: 48.0667, lng: 114.5333 },
  { no: 18, place: 'Чингис хот', aimag: 'Хэнтий', region: 'east', lat: 47.3233, lng: 110.6611 },
  {
    no: 19,
    place: 'Багануур',
    aimag: 'Улаанбаатар (дүүрэг)',
    region: 'east',
    lat: 47.7839,
    lng: 108.3722,
    offset: [18, -6],
  },
  { no: 20, place: 'Сүхбаатар', aimag: 'Сэлэнгэ', region: 'north', lat: 50.2364, lng: 106.2064 },
  { no: 21, place: 'Дархан', aimag: 'Дархан-Уул', region: 'north', lat: 49.4689, lng: 105.9575 },
  { no: 22, place: 'Эрдэнэт', aimag: 'Орхон', region: 'north', lat: 49.0278, lng: 104.0444 },
  { no: 23, place: 'Булган', aimag: 'Булган', region: 'north', lat: 48.8119, lng: 103.5336 },
  {
    no: 24,
    place: 'Зуунмод',
    aimag: 'Төв',
    region: 'central',
    lat: 47.7069,
    lng: 106.9494,
    offset: [-22, 16],
  },
  {
    no: 25,
    place: 'Налайх',
    aimag: 'Улаанбаатар (дүүрэг)',
    region: 'central',
    lat: 47.7631,
    lng: 107.2553,
    offset: [16, 14],
  },
  {
    no: 26,
    place: 'Улаанбаатар',
    aimag: 'Нийслэл — эцсийн зогсоол',
    region: 'central',
    lat: 47.9219,
    lng: 106.9153,
    offset: [-14, -18],
  },
];

export const REGIONS: Region[] = [
  { id: 'west', title: 'Баруун бүс', badge: 'roadmap-west' },
  { id: 'khangai', title: 'Хангайн бүс', badge: 'roadmap-khangai' },
  { id: 'gobi', title: 'Говийн бүс', badge: 'roadmap-gobi' },
  { id: 'east', title: 'Зүүн бүс', badge: 'roadmap-east' },
  { id: 'north', title: 'Хойд бүс', badge: 'roadmap-north' },
  { id: 'central', title: 'Төвийн бүс', badge: 'roadmap-central' },
];

/** Awarded with the celebration screen after the last stop. */
export const FINAL_BADGE = 'roadmap-final';

export function stopByNo(no: number): Stop | undefined {
  return STOPS.find((s) => s.no === no);
}

export function regionById(id: RegionId): Region {
  return REGIONS.find((r) => r.id === id)!;
}

export function stopsInRegion(id: RegionId): Stop[] {
  return STOPS.filter((s) => s.region === id);
}
