// Pin clustering and label placement for the map, in screen px. Pure functions (labels.test.ts).
//
// Pins are drawn with their tip at (x, y); the pin body occupies PIN (relative to the tip). Labels try a few
// slots around their pin in order — right below, beside, above — and then leader-line callouts further out,
// like the reference map. Higher-priority labels (the current stop first) claim space first.

export type ScreenPin = { id: number; x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

/** Pin body around its tip: 30 wide, 42 tall, tip at the bottom middle. */
export const PIN: Box = { x: -15, y: -42, w: 30, h: 42 };
export const LABEL_H = 20;

const overlaps = (a: Box, b: Box, pad = 2) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

const pinBox = (p: ScreenPin): Box => ({ x: p.x + PIN.x, y: p.y + PIN.y, w: PIN.w, h: PIN.h });

export type Cluster = { ids: number[]; x: number; y: number };

/**
 * Greedy screen-space clustering: pins closer than `radius` px join the first pin of their group. Pins in
 * `keep` (the current stop) always stay single. `order` decides who seeds a group (earlier = seed).
 */
export function clusterPins(
  pins: readonly ScreenPin[],
  radius: number,
  keep: ReadonlySet<number> = new Set(),
): { singles: number[]; clusters: Cluster[] } {
  const used = new Set<number>();
  const singles: number[] = [];
  const clusters: Cluster[] = [];
  for (const p of pins) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    if (keep.has(p.id)) {
      singles.push(p.id);
      continue;
    }
    const group = [p];
    for (const q of pins) {
      if (used.has(q.id) || keep.has(q.id)) continue;
      if (Math.hypot(q.x - p.x, q.y - p.y) < radius) {
        group.push(q);
        used.add(q.id);
      }
    }
    if (group.length === 1) singles.push(p.id);
    else
      clusters.push({
        ids: group.map((g) => g.id),
        x: group.reduce((s, g) => s + g.x, 0) / group.length,
        y: group.reduce((s, g) => s + g.y, 0) / group.length,
      });
  }
  return { singles, clusters };
}

export type LabelIn = ScreenPin & { w: number };
export type Placed = {
  id: number;
  /** Label box, screen px. */
  box: Box;
  /** Present for callouts: line from the pin tip area to the label. */
  leader?: { x1: number; y1: number; x2: number; y2: number };
};

/** Label slots relative to the pin tip, in order of preference. `far` slots get a leader line. */
function slots(p: LabelIn): { box: Box; far: boolean }[] {
  const { w } = p;
  const h = LABEL_H;
  const near = [
    { x: -w / 2, y: 4 }, // below the tip
    { x: 17, y: -32 }, // right of the pin head
    { x: -17 - w, y: -32 }, // left of the pin head
    { x: -w / 2, y: -46 - h }, // above the pin
  ];
  const far = [
    { x: 46, y: -86 },
    { x: -46 - w, y: -86 },
    { x: 46, y: 30 },
    { x: -46 - w, y: 30 },
    { x: -w / 2, y: 46 },
    { x: -w / 2, y: -110 },
    { x: 84, y: -40 },
    { x: -84 - w, y: -40 },
  ];
  return [
    ...near.map((o) => ({ box: { x: p.x + o.x, y: p.y + o.y, w, h }, far: false })),
    ...far.map((o) => ({ box: { x: p.x + o.x, y: p.y + o.y, w, h }, far: true })),
  ];
}

/** Point on the box edge nearest to (x, y) — where a leader line meets the label. */
function edgePoint(b: Box, x: number, y: number) {
  return {
    x: Math.min(b.x + b.w, Math.max(b.x, x)),
    y: Math.min(b.y + b.h, Math.max(b.y, y)),
  };
}

/** The hover card above a pin (StopCard in .roadmap-float), relative to the tip. */
export const FLOAT: Box = { x: -104, y: -178, w: 208, h: 122 };

/** Star / «Давсан» chip next to a finished pin's head, relative to the tip. */
export const CHIP: Box = { x: 12, y: -51, w: 46, h: 16 };

/**
 * Places labels in the given order (priority first). A label avoids other labels, every pin except its
 * own, and `obstacles` (pin chips); ids in `force` take their first slot even when crowded. Labels with no
 * free slot are left out.
 */
export function placeLabels(
  items: readonly LabelIn[],
  pins: readonly ScreenPin[],
  force: ReadonlySet<number> = new Set(),
  obstacles: readonly Box[] = [],
  /** Allow leader-line callouts (off on phones, where long lines clutter the small map). */
  callouts = true,
): Map<number, Placed> {
  const out = new Map<number, Placed>();
  const taken: Box[] = [...obstacles];
  const pinBoxes = pins.map((p) => ({ id: p.id, box: pinBox(p) }));
  for (const item of items) {
    const candidates = slots(item).filter((c) => callouts || !c.far);
    const free = candidates.find(
      (c) =>
        !taken.some((t) => overlaps(t, c.box)) &&
        !pinBoxes.some((pb) => pb.id !== item.id && overlaps(pb.box, c.box)),
    );
    const pick = free ?? (force.has(item.id) ? candidates[0] : undefined);
    if (!pick) continue;
    taken.push(pick.box);
    const placed: Placed = { id: item.id, box: pick.box };
    if (pick.far) {
      const head = { x: item.x, y: item.y - 26 };
      const end = edgePoint(pick.box, head.x, head.y);
      placed.leader = { x1: head.x, y1: head.y, x2: end.x, y2: end.y };
    }
    out.set(item.id, placed);
  }
  return out;
}

/** Rough label width for the 11.5px bold UI font: Cyrillic averages ~7.1px per letter, plus padding. */
export function labelWidth(text: string): number {
  return Math.round(text.length * 7.1 + 18);
}
