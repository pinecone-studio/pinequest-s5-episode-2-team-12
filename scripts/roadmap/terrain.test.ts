import { describe, expect, test } from 'bun:test';
import { BIOME, biomeColor, fillRings, grain, hillshade, type RGB, terrarium } from './terrain';

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const nearest = (c: RGB) =>
  (Object.entries(BIOME) as [string, RGB][]).sort((a, b) => dist(c, a[1]) - dist(c, b[1]))[0][0];

describe('terrain', () => {
  test('terrarium decoding', () => {
    expect(terrarium(128, 0, 0)).toBe(0);
    expect(terrarium(133, 120, 128)).toBeCloseTo(1400.5, 5); // 5*256 + 120 + .5
  });

  test('biomes land where they are in Mongolia', () => {
    expect(nearest(biomeColor(4100, 48.9, 87.9, 0.4))).toBe('snow'); // Tavan Bogd, Altai
    expect(nearest(biomeColor(1100, 43.6, 104.4, 0.05))).toMatch(/gobi|gravel/); // Dalanzadgad
    expect(nearest(biomeColor(1800, 50.3, 100.4, 0.3))).toMatch(/taiga|forestSteppe/); // Khövsgöl hills
    expect(nearest(biomeColor(1300, 47.9, 106.9, 0.1))).toMatch(/steppe|lushSteppe|forestSteppe/); // UB
    expect(nearest(biomeColor(700, 47.5, 115, 0.02))).toMatch(/steppe|lushSteppe/); // eastern steppe
  });

  test('hillshade lights north-west slopes and darkens south-east ones', () => {
    const flat = hillshade(0, 0);
    // terrain rising to the south-east faces the north-west sun
    expect(hillshade(0.6, 0.6)).toBeGreaterThan(flat);
    expect(hillshade(-0.6, -0.6)).toBeLessThan(flat);
    expect(flat).toBeCloseTo(Math.sin(Math.PI / 4), 5);
  });

  test('fillRings fills the inside of a square and holes by even-odd', () => {
    const square: [number, number][] = [
      [1, 1],
      [9, 1],
      [9, 9],
      [1, 9],
    ];
    const hole: [number, number][] = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
    ];
    const m = fillRings([square, hole], 10, 10);
    expect(m[0]).toBe(0);
    expect(m[2 * 10 + 2]).toBe(1);
    expect(m[5 * 10 + 5]).toBe(0);
    expect(m.reduce((a, b) => a + b, 0)).toBe(64 - 4);
  });

  test('grain is deterministic and in range', () => {
    expect(grain(3, 4)).toBe(grain(3, 4));
    for (let i = 0; i < 100; i++) {
      const g = grain(i, i * 7);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});
