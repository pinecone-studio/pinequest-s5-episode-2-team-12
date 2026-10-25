// Pure helpers for baking the terrain image (build-terrain.ts). No I/O, unit-tested in terrain.test.ts.

export type RGB = [number, number, number];

/** Terrarium PNG encoding → metres. */
export function terrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Palette, tuned against the reference (grass-green steppe, dark taiga, warm Gobi, white Altai). */
export const BIOME = {
  steppe: [112, 152, 64],
  lushSteppe: [92, 140, 56],
  dryStepp: [164, 160, 92],
  gobi: [206, 178, 124],
  gravel: [176, 148, 106],
  forestSteppe: [70, 118, 54],
  taiga: [38, 78, 44],
  alpine: [124, 134, 88],
  rock: [138, 128, 114],
  snow: [242, 245, 247],
  water: [62, 122, 168],
  waterDeep: [40, 92, 140],
} satisfies Record<string, RGB>;

/**
 * Ground color from elevation (m), latitude, longitude and slope (0 flat .. 1 steep). Rule-based biomes:
 * Gobi in the south, the dry Great Lakes basin in the west, steppe in the middle and east, taiga and
 * forest-steppe on the northern mountains, alpine → rock → snow on the Altai and Khangai peaks.
 */
export function biomeColor(e: number, lat: number, lon: number, slope: number): RGB {
  // aridity: south is dry (with a wavy, not ruler-straight, edge); mountains hold more moisture; the western
  // basins below the mountains are dry too; the far east is a little wetter
  const wavyLat = lat + (fbm(lon * 0.9, lat * 0.9) - 0.5) * 1.6 + smoothstep(1600, 2600, e) * 1.1;
  let arid = smoothstep(46.9, 43.8, wavyLat);
  if (lon < 97)
    arid += 0.7 * smoothstep(1700, 1050, e) * smoothstep(51.6, 49.4, lat) * smoothstep(97, 94, lon);
  if (lon > 111.5) arid -= 0.25 * smoothstep(45, 47, lat);
  arid = Math.min(1, Math.max(0, arid));

  let c = mix(BIOME.lushSteppe, BIOME.steppe, smoothstep(0.05, 0.25, arid));
  c = mix(c, BIOME.dryStepp, smoothstep(0.25, 0.6, arid));
  c = mix(c, BIOME.gobi, smoothstep(0.55, 0.9, arid));
  c = mix(c, BIOME.gravel, smoothstep(0.75, 1, arid) * smoothstep(900, 1600, e) * 0.6);

  // forest on the wet northern mountains: Khövsgöl, northern Khangai, Khentii
  const north = smoothstep(47.2, 49.6, lat) * (1 - arid);
  const forestBand = smoothstep(1150, 1550, e) * (1 - smoothstep(2350, 2650, e));
  const forestLon = smoothstep(95.5, 97.5, lon) * (1 - smoothstep(112.5, 114, lon));
  const forest = north * forestBand * forestLon;
  c = mix(c, BIOME.forestSteppe, Math.min(1, forest * 1.6));
  c = mix(c, BIOME.taiga, smoothstep(0.45, 0.9, forest + 0.25 * slope * north));

  // high mountains
  c = mix(c, BIOME.alpine, smoothstep(2500, 2950, e));
  c = mix(c, BIOME.rock, smoothstep(2950, 3400, e) * 0.85 + smoothstep(0.55, 0.9, slope) * 0.35);
  // the 1.2 km/px DEM smooths peaks by a few hundred metres, so the snow line sits a little low
  const snowLine = 3250 - 150 * smoothstep(46, 50, lat);
  c = mix(c, BIOME.snow, smoothstep(snowLine - 200, snowLine + 250, e));
  return c;
}

/**
 * Lambert hillshade 0..1 for a surface gradient (dz/dx, dz/dy in the same units as x/y, y pointing down),
 * sun from the north-west at 45°.
 */
export function hillshade(dzdx: number, dzdy: number, azimuthDeg = 315, altitudeDeg = 45): number {
  const az = (azimuthDeg * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  // light direction (x east, y south, z up)
  const lx = Math.sin(az) * Math.cos(alt);
  const ly = -Math.cos(az) * Math.cos(alt);
  const lz = Math.sin(alt);
  const len = Math.hypot(dzdx, dzdy, 1);
  return Math.max(0, (-dzdx * lx - dzdy * ly + lz) / len);
}

/** Even-odd scanline fill of polygons (rings in pixel space) into a w×h mask (1 = inside). */
export function fillRings(rings: readonly (readonly [number, number][])[], w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const xs: number[] = [];
  for (let y = 0; y < h; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[i];
        if (y1 <= sy === y2 <= sy) continue;
        xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5));
      const to = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = from; x <= to; x++) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** Smooth deterministic value noise 0..1 (3 octaves) over continuous coordinates. */
export function fbm(x: number, y: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    const f = 2 ** o;
    const xi = Math.floor(x * f);
    const yi = Math.floor(y * f);
    const tx = x * f - xi;
    const ty = y * f - yi;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n = (a: number, b: number) => grain(a + o * 1013, b - o * 7919);
    const top = n(xi, yi) + (n(xi + 1, yi) - n(xi, yi)) * sx;
    const bottom = n(xi, yi + 1) + (n(xi + 1, yi + 1) - n(xi, yi + 1)) * sx;
    sum += amp * (top + (bottom - top) * sy);
    norm += amp;
    amp /= 2;
  }
  return sum / norm;
}

/** Deterministic 0..1 noise per pixel, for a little grass grain. */
export function grain(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
