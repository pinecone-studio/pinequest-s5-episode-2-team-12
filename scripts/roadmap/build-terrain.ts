// Bakes the terrain image of «Монголын аялал»: real relief (hillshaded DEM), biome colors and lakes, cut to
// the country outline, in the same projection as the borders and pins (build-map.ts), so the client tilts it
// with the same matrix. Output: public/map/terrain-{1024,2048,3072}.webp (alpha outside Mongolia).
// Run: bun scripts/roadmap/fetch-terrain.ts (once) && bun run roadmap:terrain
import { mkdir } from 'node:fs/promises';
import type { Geometry, MultiPolygon, Polygon } from 'geojson';
import sharp from 'sharp';
import { MAP } from '../../src/features/roadmap/map/mongolia.generated';
import { type Geo, placedProjection, SRC } from './build-map';
import { BBOX, CACHE, LAKES, tileRange, tileX, tileY } from './fetch-terrain';
import { BIOME, biomeColor, fillRings, grain, hillshade, smoothstep, terrarium } from './terrain';

/** Output pixels per map unit for the large image. */
const SCALE = 3.072;
const W = Math.round(MAP.width * SCALE);
const H = Math.round(MAP.height * SCALE);
/** Vertical exaggeration so the relief reads at country scale. */
const EXAGGERATE = 14;
const OUT = new URL('../../public/map/', import.meta.url).pathname;

async function loadDem() {
  const { x0, x1, y0, y1 } = tileRange();
  const tw = (x1 - x0 + 1) * 256;
  const th = (y1 - y0 + 1) * 256;
  const dem = new Float32Array(tw * th);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const { data, info } = await sharp(`${CACHE}/${x}/${y}.png`)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let py = 0; py < 256; py++) {
        for (let px = 0; px < 256; px++) {
          const i = (py * 256 + px) * info.channels;
          dem[((y - y0) * 256 + py) * tw + (x - x0) * 256 + px] = terrarium(
            data[i],
            data[i + 1],
            data[i + 2],
          );
        }
      }
    }
  }
  const sample = (lon: number, lat: number) => {
    const gx = Math.min(tw - 1.001, Math.max(0, (tileX(lon) - x0) * 256 - 0.5));
    const gy = Math.min(th - 1.001, Math.max(0, (tileY(lat) - y0) * 256 - 0.5));
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const v = (dx: number, dy: number) => dem[(iy + dy) * tw + ix + dx];
    return (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy;
  };
  return sample;
}

/** Polygon rings projected into output pixels. */
function rings(geoms: Geometry[], project: (p: [number, number]) => [number, number] | null) {
  const out: [number, number][][] = [];
  for (const g of geoms as (Polygon | MultiPolygon)[]) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys)
      for (const ring of poly)
        out.push(
          ring
            .map(([lon, lat]) => project([lon, lat]))
            .filter((p): p is [number, number] => p !== null)
            .map(([x, y]) => [x * SCALE, y * SCALE]),
        );
  }
  return out;
}

/** Mask at 2× and box-downsampled to 0..255 for an anti-aliased edge. */
function coverage(r: [number, number][][]): Uint8Array {
  const hi = fillRings(
    r.map((ring) => ring.map(([x, y]) => [x * 2, y * 2] as [number, number])),
    W * 2,
    H * 2,
  );
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * 2 * W * 2 + x * 2;
      out[y * W + x] = ((hi[i] + hi[i + 1] + hi[i + W * 2] + hi[i + W * 2 + 1]) * 255) / 4;
    }
  return out;
}

async function main() {
  const country = (await Bun.file(SRC).json()) as Geo;
  const lakes = (await Bun.file(LAKES).json()) as { features: { geometry: Geometry }[] };
  const { projection } = placedProjection(country);
  const sample = await loadDem();

  const land = coverage(
    rings(
      country.features.map((f) => f.geometry),
      projection,
    ),
  );
  const water = coverage(
    rings(
      lakes.features.map((f) => f.geometry),
      projection,
    ),
  );

  // elevation and lon/lat per output pixel
  const elev = new Float32Array(W * H);
  const lat = new Float32Array(W * H);
  const lon = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ll = projection.invert?.([(x + 0.5) / SCALE, (y + 0.5) / SCALE]);
      if (!ll) continue;
      const [lo, la] = ll;
      const i = y * W + x;
      lon[i] = lo;
      lat[i] = la;
      elev[i] =
        lo >= BBOX.west && lo <= BBOX.east && la >= BBOX.south && la <= BBOX.north ? sample(lo, la) : 0;
    }

  // metres per output pixel, measured along the middle row
  const [la0, lo0] = [lat[(H >> 1) * W + (W >> 2)], lon[(H >> 1) * W + (W >> 2)]];
  const [la1, lo1] = [lat[(H >> 1) * W + (W >> 2) + 100], lon[(H >> 1) * W + (W >> 2) + 100]];
  const mPerPx = (Math.hypot((lo1 - lo0) * Math.cos((la0 * Math.PI) / 180), la1 - la0) * 111_320) / 100;

  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = land[i];
      if (!a) continue;
      const e = elev[i];
      const ex = (elev[y * W + Math.min(W - 1, x + 1)] - elev[y * W + Math.max(0, x - 1)]) / (2 * mPerPx);
      const ey = (elev[Math.min(H - 1, y + 1) * W + x] - elev[Math.max(0, y - 1) * W + x]) / (2 * mPerPx);
      const slope = Math.min(1, Math.hypot(ex, ey) * 25);
      const shade = hillshade(ex * EXAGGERATE, ey * EXAGGERATE);
      let c = biomeColor(e, lat[i], lon[i], slope);
      // light from the north-west, never crushed to black; a little grass grain
      const k = (0.42 + 0.78 * shade) * (0.96 + 0.08 * grain(x, y));
      c = [c[0] * k, c[1] * k, c[2] * k];
      const wa = water[i] / 255;
      if (wa > 0) {
        const deep = smoothstep(0, 1, wa);
        const wc = [
          BIOME.water[0] + (BIOME.waterDeep[0] - BIOME.water[0]) * deep,
          BIOME.water[1] + (BIOME.waterDeep[1] - BIOME.water[1]) * deep,
          BIOME.water[2] + (BIOME.waterDeep[2] - BIOME.water[2]) * deep,
        ];
        c = [c[0] + (wc[0] - c[0]) * wa, c[1] + (wc[1] - c[1]) * wa, c[2] + (wc[2] - c[2]) * wa];
      }
      rgba[i * 4] = Math.min(255, c[0]);
      rgba[i * 4 + 1] = Math.min(255, c[1]);
      rgba[i * 4 + 2] = Math.min(255, c[2]);
      rgba[i * 4 + 3] = a;
    }

  await mkdir(OUT, { recursive: true });
  const img = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
  for (const size of [3072, 2048, 1024]) {
    const file = `${OUT}terrain-${size}.webp`;
    await img
      .clone()
      .resize({ width: size })
      .webp({ quality: size > 1024 ? 78 : 80, alphaQuality: 90, effort: 6 })
      .toFile(file);
    console.log(`✓ public/map/terrain-${size}.webp ${(Bun.file(file).size / 1024).toFixed(0)} KB`);
  }
  console.log(`  ${W}×${H} px, ${mPerPx.toFixed(0)} m/px, relief ×${EXAGGERATE}`);
}

if (import.meta.main) await main();
