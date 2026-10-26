import { describe, expect, test } from 'bun:test';
import { MAP } from '../map/mongolia.generated';
import { STOPS } from '../stops';
import { centerOn, clampView, declutter, fitView, isoMatrix, routeSegments, toScreen, zoomAt } from './iso';

describe('isoMatrix', () => {
  test('every corner of the map lands inside the computed box', () => {
    const m = isoMatrix(1000, 500);
    for (const p of [
      [0, 0],
      [1000, 0],
      [0, 500],
      [1000, 500],
    ] as [number, number][]) {
      const [x, y] = toScreen(m, p);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(m.width);
      expect(y).toBeLessThanOrEqual(m.height);
    }
  });

  test('squashes the map vertically (it reads as tilted)', () => {
    const m = isoMatrix(1000, 500);
    expect(m.height).toBeLessThan(m.width * 0.6);
  });

  test('flat tilt is the identity plus padding', () => {
    const m = isoMatrix(100, 50, { angle: 0, squash: 1, depth: 0 }, 0);
    expect(toScreen(m, [10, 20])).toEqual([10, 20]);
  });

  test('stops project west to east in roughly the right order', () => {
    const m = isoMatrix(MAP.width, MAP.height);
    const x = (no: number) => toScreen(m, MAP.points[no])[0];
    expect(x(1)).toBeLessThan(x(5)); // Өлгий west of Улиастай
    expect(x(26)).toBeLessThan(x(17)); // Улаанбаатар west of Чойбалсан
  });
});

test('routeSegments: one segment per leg, each starting and ending on its stops', () => {
  const pts: [number, number][] = [
    [0, 0],
    [10, 0],
    [20, 10],
  ];
  const segs = routeSegments(pts);
  expect(segs).toHaveLength(2);
  expect(segs[0].startsWith('M0 0C')).toBe(true);
  expect(segs[0].endsWith(' 10 0')).toBe(true);
  expect(segs[1].endsWith(' 20 10')).toBe(true);
});

test('declutter keeps higher-priority labels and drops overlapping ones', () => {
  const shown = declutter([
    { id: 1, x: 100, y: 100, w: 60, h: 18 },
    { id: 2, x: 120, y: 105, w: 60, h: 18 }, // overlaps 1
    { id: 3, x: 300, y: 100, w: 60, h: 18 },
  ]);
  expect([...shown]).toEqual([1, 3]);
});

describe('generated map', () => {
  test('has a point for every stop and 22 regions (21 aimags + capital)', () => {
    expect(
      Object.keys(MAP.points)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(STOPS.map((s) => s.no));
    expect(MAP.aimags).toHaveLength(22);
    expect(MAP.outline.length).toBeGreaterThan(100);
  });
});

describe('viewport', () => {
  const box = { w: 400, h: 300 };
  const content = { w: 800, h: 400 };

  test('fitView fits and centers', () => {
    const v = fitView(box, content, 0);
    expect(v.scale).toBe(0.5);
    expect(v.x).toBe(0);
    expect(v.y).toBe(50);
  });

  test('zoomAt keeps the anchor point fixed', () => {
    const v = { scale: 1, x: 0, y: 0 };
    const z = zoomAt(v, 2, 100, 100, 0.1, 10);
    // content point under (100,100) was (100,100); after zoom it must still be under it
    expect((100 - z.x) / z.scale).toBeCloseTo(100);
    expect(z.scale).toBe(2);
  });

  test('zoomAt respects limits', () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 100, 0, 0, 0.5, 3).scale).toBe(3);
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0.01, 0, 0, 0.5, 3).scale).toBe(0.5);
  });

  test('clampView keeps part of the map on screen', () => {
    const v = clampView({ scale: 1, x: 5000, y: -5000 }, box, content);
    expect(v.x).toBeLessThan(box.w);
    expect(v.y + content.h).toBeGreaterThan(0);
  });

  test('centerOn puts the point in the middle', () => {
    const v = centerOn([100, 50], box, 2);
    expect(100 * v.scale + v.x).toBe(200);
    expect(50 * v.scale + v.y).toBe(150);
  });
});
