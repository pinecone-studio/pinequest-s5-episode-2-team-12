import { expect, test } from 'bun:test';
import { hitPoi, screenToWorld, worldToScreen } from './viewport';

const view = { cx: 2, cy: 3, scale: 32 },
  size = { w: 640, h: 400 };
test('world ↔ screen round trips after pan and zoom', () => {
  for (const [x, y] of [
    [0, 0],
    [-12.5, 88.7],
    [2, 3],
  ]) {
    const p = worldToScreen(x, y, view, size);
    const w = screenToWorld(p.x, p.y, view, size);
    expect(w.x).toBeCloseTo(x, 10);
    expect(w.y).toBeCloseTo(y, 10);
  }
});
test('POI hit radius is 12 CSS pixels', () => {
  const poi = { x: 2, y: 3, kind: 'intersection' as const, rows: ['a', 'b'] };
  expect(hitPoi([poi], 332, 200, view, size)).toEqual(poi);
  expect(hitPoi([poi], 332.1, 200, view, size)).toBeUndefined();
});
