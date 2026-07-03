// Fetch raw OSM data from Overpass API into scripts/cache/ (gitignored).
// Cache-first: an existing cache file is never re-fetched — delete it to force.
// Run: npm run data:fetch
//
// Fallback if the buildings query 504s (it shouldn't at this bbox size):
// split BBOX into 2x2 quadrants, run the same query per quadrant, concatenate
// the `elements` arrays, and deduplicate by element type+id before writing.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { BBOX } from './config.mjs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_DIR = new URL('./cache/', import.meta.url);

const [minLng, minLat, maxLng, maxLat] = BBOX;
const bbox = `${minLat},${minLng},${maxLat},${maxLng}`; // Overpass order: S,W,N,E

// buildings/water use body+recurse form: osmtogeojson needs node refs to
// assemble way geometry and multipolygon relations (holes included).
// roads use `out geom` (inline coords) — we only need polylines, no recursion.
const QUERIES = {
  buildings: `[out:json][timeout:180][maxsize:536870912];
(
  way["building"](${bbox});
  relation["building"](${bbox});
);
out body;
>;
out skel qt;`,
  roads: `[out:json][timeout:180];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](${bbox});
out geom;`,
  water: `[out:json][timeout:180];
(
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["waterway"="riverbank"](${bbox});
);
out body;
>;
out skel qt;`,
};

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchQuery(name, query) {
  const out = new URL(`${name}.raw.json`, CACHE_DIR);
  if (await exists(out)) {
    console.log(`[skip] ${name} — cache exists`);
    return false;
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`[fetch] ${name}${attempt > 1 ? ` (attempt ${attempt})` : ''} ...`);
    const t0 = Date.now();
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': '3d-phnompenh-build-script (github.com/sovithyea)',
      },
      body: 'data=' + encodeURIComponent(query),
    });
    if (res.status === 429 || res.status === 504) {
      // busy or rate-limited — back off and retry
      await res.text();
      const wait = 30 * attempt;
      console.log(`[busy] ${name}: HTTP ${res.status}, retrying in ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`${name}: HTTP ${res.status} ${res.statusText}\n${await res.text()}`);
    }
    const text = await res.text();
    const parsed = JSON.parse(text); // validate before writing
    await writeFile(out, text);
    console.log(
      `[done] ${name}: ${parsed.elements.length} elements, ${(text.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    return true;
  }
  throw new Error(`${name}: gave up after 4 attempts (Overpass busy)`);
}

await mkdir(CACHE_DIR, { recursive: true });
for (const [name, query] of Object.entries(QUERIES)) {
  const fetched = await fetchQuery(name, query); // sequential — be polite to Overpass
  if (fetched) await sleep(10_000); // inter-query cooldown
}
console.log('All queries cached. Next: npm run data:build');
