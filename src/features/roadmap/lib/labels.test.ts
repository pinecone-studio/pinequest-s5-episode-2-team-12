import { describe, expect, test } from 'bun:test';
import { clusterPins, LABEL_H, labelWidth, PIN, placeLabels } from './labels';

const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('clusterPins', () => {
  test('groups pins within the radius around the first pin', () => {
    const r = clusterPins(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 10, y: 0 },
        { id: 3, x: 200, y: 0 },
      ],
      30,
    );
    expect(r.singles).toEqual([3]);
    expect(r.clusters).toEqual([{ ids: [1, 2], x: 5, y: 0 }]);
  });

  test('kept pins (the current stop) never join a cluster', () => {
    const r = clusterPins(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 10, y: 0 },
        { id: 3, x: 12, y: 4 },
      ],
      30,
      new Set([2]),
    );
    expect(r.singles).toContain(2);
    expect(r.clusters).toEqual([{ ids: [1, 3], x: 6, y: 2 }]);
  });

  test('a lone pin is a single', () => {
    expect(clusterPins([{ id: 7, x: 0, y: 0 }], 30)).toEqual({ singles: [7], clusters: [] });
  });
});

describe('placeLabels', () => {
  test('a lone label sits right below its pin', () => {
    const m = placeLabels([{ id: 1, x: 100, y: 100, w: 60 }], [{ id: 1, x: 100, y: 100 }]);
    expect(m.get(1)?.box).toEqual({ x: 70, y: 104, w: 60, h: LABEL_H });
    expect(m.get(1)?.leader).toBeUndefined();
  });

  test('crowded labels never overlap each other or other pins, and far ones get a leader line', () => {
    // a tight cluster like Ulaanbaatar / Nalaikh / Zuunmod / Baganuur
    const pins = [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 112, y: 104 },
      { id: 3, x: 96, y: 116 },
      { id: 4, x: 120, y: 118 },
      { id: 5, x: 106, y: 90 },
    ];
    const m = placeLabels(
      pins.map((p) => ({ ...p, w: 70 })),
      pins,
    );
    const boxes = [...m.values()].map((p) => p.box);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
    for (const [id, p] of m)
      for (const pin of pins)
        if (pin.id !== id)
          expect(overlap(p.box, { x: pin.x + PIN.x, y: pin.y + PIN.y, w: PIN.w, h: PIN.h })).toBe(false);
    expect([...m.values()].some((p) => p.leader)).toBe(true);
    expect(m.size).toBeGreaterThanOrEqual(4);
  });

  test('forced labels always appear, even with no free slot', () => {
    const pins = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      x: 100 + (i % 6) * 8,
      y: 100 + Math.floor(i / 6) * 8,
    }));
    const m = placeLabels(
      pins.map((p) => ({ ...p, w: 90 })),
      pins,
      new Set([30]),
    );
    expect(m.has(30)).toBe(true);
  });

  test('labelWidth grows with the text', () => {
    expect(labelWidth('Улаанбаатар')).toBeGreaterThan(labelWidth('Ховд'));
  });
});

test('labels avoid obstacles such as a neighbour’s star chip', () => {
  const pins = [{ id: 1, x: 100, y: 100 }];
  const chip = { x: 70, y: 100, w: 60, h: 30 }; // covers the slot below the pin
  const m = placeLabels([{ id: 1, x: 100, y: 100, w: 60 }], pins, new Set(), [chip]);
  const box = m.get(1)?.box;
  expect(box).toBeDefined();
  expect(box && overlap(box, chip)).toBe(false);
});
