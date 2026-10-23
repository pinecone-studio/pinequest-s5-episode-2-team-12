import type { Poi } from './graph';

export type View = { cx: number; cy: number; scale: number };
export type Size = { w: number; h: number };
export function worldToScreen(x: number, y: number, view: View, size: Size) {
  return { x: size.w / 2 + (x - view.cx) * view.scale, y: size.h / 2 - (y - view.cy) * view.scale };
}
export function screenToWorld(x: number, y: number, view: View, size: Size) {
  return { x: view.cx + (x - size.w / 2) / view.scale, y: view.cy - (y - size.h / 2) / view.scale };
}
/** Nearest POI in CSS pixels, independent of devicePixelRatio. */
export function hitPoi(pois: Poi[], x: number, y: number, view: View, size: Size, radius = 12) {
  let best: Poi | undefined;
  let distance = radius;
  for (const poi of pois) {
    const p = worldToScreen(poi.x, poi.y, view, size);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= radius && (!best || d < distance)) {
      best = poi;
      distance = d;
    }
  }
  return best;
}
