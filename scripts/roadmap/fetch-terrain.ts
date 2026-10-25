// Downloads the open data the terrain image is baked from. Run once: bun scripts/roadmap/fetch-terrain.ts
//
// - Elevation: AWS Terrain Tiles, Terrarium PNG encoding (SRTM, GMTED2010, ETOPO1 … — open data, attribution
//   in the map footer). Zoom 7 tiles covering Mongolia, cached in scripts/roadmap/.cache (git-ignored).
// - Lakes: Natural Earth 1:10m lakes (public domain), filtered to lakes inside Mongolia and committed as
//   scripts/roadmap/data/mng-lakes.geojson.
import { mkdir } from 'node:fs/promises';
import { geoCentroid, geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { type Geo, SRC } from './build-map';

export const DEM_ZOOM = 7;
/** lon/lat box around Mongolia with a margin so the slab edge has data. */
export const BBOX = { west: 87.4, east: 120.2, south: 41.4, north: 52.3 };

const here = new URL('.', import.meta.url).pathname;
export const CACHE = `${here}.cache/terrarium/${DEM_ZOOM}`;
export const LAKES = `${here}data/mng-lakes.geojson`;
const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const LAKES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_lakes.geojson';

export function tileX(lon: number, z = DEM_ZOOM) {
  return ((lon + 180) / 360) * 2 ** z;
}
export function tileY(lat: number, z = DEM_ZOOM) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

/** Tile index ranges covering BBOX. */
export function tileRange() {
  return {
    x0: Math.floor(tileX(BBOX.west)),
    x1: Math.floor(tileX(BBOX.east)),
    y0: Math.floor(tileY(BBOX.north)),
    y1: Math.floor(tileY(BBOX.south)),
  };
}

async function fetchTiles() {
  const { x0, x1, y0, y1 } = tileRange();
  let got = 0;
  for (let x = x0; x <= x1; x++) {
    await mkdir(`${CACHE}/${x}`, { recursive: true });
    for (let y = y0; y <= y1; y++) {
      const file = Bun.file(`${CACHE}/${x}/${y}.png`);
      if (await file.exists()) continue;
      const res = await fetch(`${TILE_URL}/${DEM_ZOOM}/${x}/${y}.png`);
      if (!res.ok) throw new Error(`tile ${x}/${y}: HTTP ${res.status}`);
      await Bun.write(file, await res.arrayBuffer());
      got++;
    }
  }
  console.log(`✓ DEM: ${(x1 - x0 + 1) * (y1 - y0 + 1)} tiles at z${DEM_ZOOM} (${got} downloaded)`);
}

type Lake = Feature<Polygon | MultiPolygon, { name: string }>;

async function fetchLakes() {
  const country = (await Bun.file(SRC).json()) as Geo;
  const res = await fetch(LAKES_URL);
  if (!res.ok) throw new Error(`lakes: HTTP ${res.status}`);
  const all = (await res.json()) as FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const roundGeom = (g: Polygon | MultiPolygon): Polygon | MultiPolygon =>
    g.type === 'Polygon'
      ? { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(([x, y]) => [round(x), round(y)])) }
      : {
          type: 'MultiPolygon',
          coordinates: g.coordinates.map((p) => p.map((r) => r.map(([x, y]) => [round(x), round(y)]))),
        };
  const lakes: Lake[] = all.features
    .filter((f) => {
      const c = geoCentroid(f);
      return country.features.some((a) => geoContains(a, c));
    })
    .map((f) => ({
      type: 'Feature',
      properties: { name: String(f.properties.name ?? f.properties.name_en ?? '') },
      geometry: roundGeom(f.geometry),
    }));
  await Bun.write(LAKES, `${JSON.stringify({ type: 'FeatureCollection', features: lakes })}\n`);
  console.log(`✓ lakes: ${lakes.length} inside Mongolia → ${LAKES.split('/scripts/')[1]}`);
  console.log(`  ${lakes.map((l) => l.properties.name || '?').join(', ')}`);
}

if (import.meta.main) {
  await fetchTiles();
  await fetchLakes();
}
