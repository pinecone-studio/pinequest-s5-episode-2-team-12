// Isometric tilt of the flat (projected) map, and pan/zoom math for the map viewport. Pure functions.

export type Pt = [number, number];
export type Tilt = {
  /** degrees, rotation in the map plane */ angle: number /** vertical squash 0..1 */;
  squash: number /** extrusion depth, px */;
  depth: number;
};

export const TILT: Tilt = { angle: -3, squash: 0.62, depth: 24 };

/** Affine matrix (SVG order a b c d e f) that tilts a w×h map and shifts it to start at (pad, pad). */
export type Iso = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  width: number;
  height: number;
};

export function isoMatrix(w: number, h: number, tilt: Tilt = TILT, pad = 8): Iso {
  const r = (tilt.angle * Math.PI) / 180;
  const a = Math.cos(r);
  const b = tilt.squash * Math.sin(r);
  const c = -Math.sin(r);
  const d = tilt.squash * Math.cos(r);
  const corners: Pt[] = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => [a * x + c * y, b * x + d * y]);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    a,
    b,
    c,
    d,
    e: pad - minX,
    f: pad - minY,
    width: Math.ceil(Math.max(...xs) - minX + pad * 2),
    height: Math.ceil(Math.max(...ys) - minY + pad * 2 + tilt.depth),
  };
}

export function toScreen(m: Iso, [x, y]: Pt): Pt {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export const svgMatrix = (m: Iso) =>
  `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((n) => +n.toFixed(5)).join(' ')})`;

/**
 * One smooth cubic segment per pair of consecutive points (Catmull-Rom → Bézier), so each leg of the route
 * can be colored on its own (done / current / upcoming) while the whole path stays smooth.
 */
export function routeSegments(pts: readonly Pt[], tension = 0.5): string[] {
  const f = (n: number) => +n.toFixed(1);
  const out: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    out.push(
      `M${f(p1[0])} ${f(p1[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`,
    );
  }
  return out;
}

export type LabelBox = { id: number; x: number; y: number; w: number; h: number };

/**
 * Greedy declutter: walk labels in priority order and keep each one that does not overlap a kept label.
 * Boxes are in screen px (centered on x, top at y). Returns the ids to show.
 */
export function declutter(boxes: readonly LabelBox[], pad = 3): Set<number> {
  const kept: LabelBox[] = [];
  for (const b of boxes) {
    const hit = kept.some(
      (k) => Math.abs(k.x - b.x) * 2 < k.w + b.w + pad * 2 && b.y < k.y + k.h + pad && k.y < b.y + b.h + pad,
    );
    if (!hit) kept.push(b);
  }
  return new Set(kept.map((k) => k.id));
}

/* ———— viewport ———— */

/** Content is drawn at (x, y) with `scale`; screen = content * scale + offset. */
export type View = { scale: number; x: number; y: number };
export type Size = { w: number; h: number };

export const ZOOM = { min: 0.5, max: 4, step: 1.25 };

/** Scale and offset that fit the whole content into the box, centered. */
export function fitView(box: Size, content: Size, margin = 12): View {
  const scale = Math.min((box.w - margin * 2) / content.w, (box.h - margin * 2) / content.h);
  const s = Math.max(0.05, scale);
  return { scale: s, x: (box.w - content.w * s) / 2, y: (box.h - content.h * s) / 2 };
}

/** Keep at least `keep` px of content inside the box so the map can't be dragged away. */
export function clampView(v: View, box: Size, content: Size, keep = 80): View {
  const cw = content.w * v.scale;
  const ch = content.h * v.scale;
  const x = Math.min(box.w - keep, Math.max(keep - cw, v.x));
  const y = Math.min(box.h - keep, Math.max(keep - ch, v.y));
  return { ...v, x, y };
}

/** Zoom by `factor` keeping the screen point (cx, cy) fixed. `minScale` is usually the fit scale × ZOOM.min. */
export function zoomAt(
  v: View,
  factor: number,
  cx: number,
  cy: number,
  minScale: number,
  maxScale: number,
): View {
  const scale = Math.min(maxScale, Math.max(minScale, v.scale * factor));
  const k = scale / v.scale;
  return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
}

/** Put content point p at the center of the box at the given scale. */
export function centerOn(p: Pt, box: Size, scale: number): View {
  return { scale, x: box.w / 2 - p[0] * scale, y: box.h / 2 - p[1] * scale };
}
