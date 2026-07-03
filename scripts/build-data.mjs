// Convert scripts/cache/*.raw.json (Overpass dumps) into compact committed
// assets in public/data/. Run: npm run data:build  (after data:fetch)
//
// buildings.json format:
//   { origin: [lng, lat],
//     buildings: [{ h: <height m>, k: <kind index>, r: [[x1,z1,x2,z2,...], <holes...>] }] }
// Kind indices: 0 generic, 1 residential, 2 commercial, 3 tower, 4 religious.
// Coordinates are local meters around ORIGIN (see config.mjs), rounded to 0.1 m.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import osmtogeojson from 'osmtogeojson';
import { bboxClip } from '@turf/bbox-clip';
import { BBOX, LEVEL_HEIGHT, DEFAULT_LEVELS, ORIGIN, project } from './config.mjs';
import { LANDMARKS } from './landmarks.config.mjs';

const CACHE_DIR = new URL('./cache/', import.meta.url);
const OUT_DIR = new URL('../public/data/', import.meta.url);

const KINDS = ['generic', 'residential', 'commercial', 'tower', 'religious'];
const RESIDENTIAL = new Set([
  'residential', 'house', 'apartments', 'detached', 'terrace', 'semidetached_house',
  'dormitory', 'bungalow', 'hut',
]);
const COMMERCIAL = new Set([
  'commercial', 'retail', 'office', 'hotel', 'supermarket', 'mall', 'warehouse', 'industrial',
]);
const RELIGIOUS = new Set([
  'temple', 'monastery', 'religious', 'pagoda', 'church', 'mosque', 'shrine', 'cathedral',
]);

async function readCache(name) {
  const raw = await readFile(new URL(`${name}.raw.json`, CACHE_DIR), 'utf8');
  return JSON.parse(raw);
}

function parseHeight(tags) {
  if (tags.height) {
    const h = parseFloat(String(tags.height).replace(/m$/i, '').trim());
    if (Number.isFinite(h) && h > 0) return Math.min(h, 400);
  }
  const levels = parseFloat(tags['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels, 100) * LEVEL_HEIGHT;
  return DEFAULT_LEVELS * LEVEL_HEIGHT;
}

function classify(tags, height) {
  const b = String(tags.building || '').toLowerCase();
  if (RELIGIOUS.has(b) || tags.religion) return 4;
  if (height > 60) return 3;
  if (COMMERCIAL.has(b)) return 2;
  if (RESIDENTIAL.has(b)) return 1;
  return 0;
}

function ringCentroid(ring) {
  let lng = 0, lat = 0;
  for (const [x, y] of ring) { lng += x; lat += y; }
  return [lng / ring.length, lat / ring.length];
}

function inZone([lng, lat], [minLng, minLat, maxLng, maxLat]) {
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

function projectRing(ring) {
  // GeoJSON rings repeat the first point at the end — drop it, extrusion closes itself.
  const flat = [];
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const [x, z] = project(ring[i][0], ring[i][1]);
    flat.push(x, z);
  }
  return flat;
}

// ---- buildings ----
async function buildBuildings() {
  const geojson = osmtogeojson(await readCache('buildings'));
  const buildings = [];
  const suppressed = Object.fromEntries(LANDMARKS.map((l) => [l.id, 0]));
  let heightTagged = 0, levelsTagged = 0;

  for (const f of geojson.features) {
    const tags = f.properties ?? {};
    if (!tags.building || tags.building === 'no') continue;
    const polygons =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
      : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates
      : null;
    if (!polygons) continue;

    if (tags.height) heightTagged++;
    else if (tags['building:levels']) levelsTagged++;
    const h = parseHeight(tags);
    const k = classify(tags, h);

    for (const rings of polygons) {
      if (rings[0].length < 4) continue; // degenerate
      const centroid = ringCentroid(rings[0]);
      const zone = LANDMARKS.find((l) => l.zone && inZone(centroid, l.zone));
      if (zone) { suppressed[zone.id]++; continue; }
      buildings.push({ h: Math.round(h * 10) / 10, k, r: rings.map(projectRing) });
    }
  }

  await writeFile(
    new URL('buildings.json', OUT_DIR),
    JSON.stringify({ origin: [ORIGIN.lng, ORIGIN.lat], buildings }),
  );

  console.log(`buildings: ${buildings.length} written`);
  console.log(`  height tag: ${heightTagged}, levels tag: ${levelsTagged}, defaulted: rest`);
  const byKind = buildings.reduce((acc, b) => ((acc[b.k] = (acc[b.k] ?? 0) + 1), acc), {});
  console.log(`  kinds: ${KINDS.map((k, i) => `${k}=${byKind[i] ?? 0}`).join(' ')}`);
  for (const [id, n] of Object.entries(suppressed)) console.log(`  suppressed[${id}]: ${n}`);
}

// ---- roads ----
async function buildRoads() {
  const raw = await readCache('roads');
  const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);
  const roads = [];
  for (const el of raw.elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const c = MAJOR.has(el.tags?.highway) ? 1 : 0;
    const p = [];
    for (const pt of el.geometry) {
      const [x, z] = project(pt.lon, pt.lat);
      p.push(x, z);
    }
    if (p.length >= 4) roads.push({ c, p });
  }
  await writeFile(new URL('roads.json', OUT_DIR), JSON.stringify({ roads }));
  console.log(`roads: ${roads.length} polylines`);
}

// ---- water ----
async function buildWater() {
  const geojson = osmtogeojson(await readCache('water'));
  const polys = [];
  for (const f of geojson.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    let clipped;
    try {
      clipped = bboxClip(f, BBOX); // rivers extend far beyond bbox
    } catch {
      continue;
    }
    const polygons =
      clipped.geometry.type === 'Polygon' ? [clipped.geometry.coordinates]
      : clipped.geometry.type === 'MultiPolygon' ? clipped.geometry.coordinates
      : [];
    for (const rings of polygons) {
      if (!rings.length || rings[0].length < 4) continue;
      polys.push(rings.map(projectRing));
    }
  }
  await writeFile(new URL('water.json', OUT_DIR), JSON.stringify({ polys }));
  console.log(`water: ${polys.length} polygons`);
}

await mkdir(OUT_DIR, { recursive: true });
await buildBuildings();
await buildRoads();
await buildWater();
console.log('public/data/ written — commit it.');
