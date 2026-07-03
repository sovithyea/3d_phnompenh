# Visual Realism Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat-color materials across the city (mass buildings, 9 landmarks, ground, roads, water) with real downloaded CC0 textures + PBR shading + scoped real-time shadows, without regressing draw-call count, the day/night system, or the 45-60fps target.

**Architecture:** Stays entirely within the existing rendering pipeline (no Google/Mapbox imagery, no new API dependency). Mass buildings get a 5-slot texture atlas selected via baked UV offsets (a custom `THREE.ExtrudeGeometry.UVGenerator`, not a new per-vertex attribute — kind is static per building). Landmarks swap their shared `MAT.*` materials from flat `MeshLambertMaterial` to textured `MeshStandardMaterial`, no changes needed in the 9 landmark component files themselves. Shadows use a small shadow-camera frustum that follows the camera's look-at target every frame, rather than covering the full 8km bbox. Roads become real ribbon geometry (finally consuming the `c`/major-minor field that's existed unused since Phase 1).

**Tech Stack:** Vite + React 19 + TypeScript, React Three Fiber 9 / three.js 0.178, drei, camera-controls. Test runner: vitest (new dependency — the project has zero test infrastructure prior to this plan; see Task 1).

## Global Constraints

- Textures are CC0 only, sourced from ambientCG.com or polyhaven.com, committed to `public/textures/` — no runtime fetch dependency, no attribution bookkeeping (per spec Section 1).
- No file is downloaded without first presenting the exact list (filename, source URL, size) for a single batch confirmation (per spec Process note, Task 3 below).
- Mass-building tiles must stay at ~1 draw call per 500m tile — no new per-vertex runtime attribute for texture selection (per spec Section 2).
- LOD1 (far/box tier, >1500m) stays flat vertex-color, no texture, no shadow casting/receiving (per spec Sections 2 and 4).
- Water stays `MeshBasicMaterial` (unlit) — this avoids visible z-fighting between overlapping OSM water polygons; do not add lighting/shadow interaction to it (per spec Section 4/5, and the existing `Ground.tsx` comment this reasoning already lives next to).
- Foliage materials (`MAT.green`, `MAT.treeGreen`) and `MAT.craneYellow` stay flat-colored — not worth a texture asset at this geometric scale (per spec Section 3).
- New landmarks (Central Market, Tuol Sleng, Olympic Stadium) are explicitly out of scope — separate follow-on spec (per spec Non-Goals).
- Real-time water reflection/refraction is explicitly out of scope (per spec Non-Goals).

---

### Task 1: Test infrastructure (vitest)

The project has no test runner configured (`package.json` has no `test` script, no test framework dependency, no test files exist anywhere in the repo). This plan's geometry/math-heavy tasks need real TDD, so this task adds a minimal one. three.js's CPU-side classes (`BufferGeometry`, `ExtrudeGeometry`, `Vector2`, `Vector3`, `DirectionalLight`, etc.) construct and can be inspected without a DOM/WebGL context, so a plain Node test environment is sufficient — no `jsdom` dependency needed anywhere in this plan.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency, add `test`/`test:watch` scripts)
- Create: `src/lib/tiles.test.ts` (first real test — also adds regression coverage for existing untested pure functions this plan builds on top of in Task 4)

**Interfaces:**
- Produces: `npm test` runs the full suite once; `npm run test:watch` runs vitest in watch mode. Every later task's test files are picked up automatically (vitest defaults to `**/*.test.ts`).

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json`, in the `"scripts"` block, add two entries (keep existing `dev`/`build`/`preview`/`data:fetch`/`data:build` as-is):

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Write the first real test — existing `src/lib/tiles.ts` pure functions**

Create `src/lib/tiles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tileIndex, tileKey, tileCenter, centroidOf } from './tiles';

describe('tileIndex', () => {
  it('floors world coordinates into 500m tile indices', () => {
    expect(tileIndex(0, 0)).toEqual([0, 0]);
    expect(tileIndex(499, 499)).toEqual([0, 0]);
    expect(tileIndex(500, 500)).toEqual([1, 1]);
    expect(tileIndex(-1, -1)).toEqual([-1, -1]);
  });
});

describe('tileKey', () => {
  it('formats indices as a stable string key', () => {
    expect(tileKey(3, -2)).toBe('3_-2');
  });
});

describe('tileCenter', () => {
  it('returns the center point of a tile in world meters', () => {
    expect(tileCenter(0, 0)).toEqual([250, 250]);
    expect(tileCenter(1, -1)).toEqual([750, -250]);
  });
});

describe('centroidOf', () => {
  it('averages a flat ring of points', () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10]; // 10x10 square
    expect(centroidOf(square)).toEqual([5, 5]);
  });
});
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test`
Expected: 4 test files worth of assertions (well, 1 file, 4 describe blocks) all PASS — `tiles.ts` already exists and is correct from the base build, this step proves the harness works against real existing code.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/tiles.test.ts
git commit -m "Add vitest test infrastructure

No test runner existed in the project before this. Node environment is
sufficient (three.js CPU-side geometry classes don't need a DOM), so no
jsdom dependency. First test covers the existing untested tiles.ts pure
functions that the visual-realism work builds on top of."
```

---

### Task 2: Add shared texture-tiling constant

One constant (`TEXTURE_TILE_METERS`) is used by four different files in this plan (building UV generation, loft UV generation, road ribbon UV, ground/water UV) to decide how many real-world meters one texture tile represents. Defining it once in the existing shared-constants file avoids four separate magic numbers drifting out of sync.

**Files:**
- Modify: `src/config.ts`

**Interfaces:**
- Produces: `TEXTURE_TILE_METERS: number` — imported by `src/lib/buildingUV.ts` (Task 4), `src/lib/loft.ts` (Task 7), `src/lib/roadRibbon.ts` (Task 10), `src/scene/Ground.tsx` (Task 10), `src/scene/groundMaterials.ts` (Task 10).

- [ ] **Step 1: Add the constant**

In `src/config.ts`, after the existing `DEFAULT_LEVELS` export, add:

```ts
export const TEXTURE_TILE_METERS = 8; // real-world meters one texture tile spans, for UV scaling
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds (this is an additive export, nothing consumes it yet).

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "Add shared TEXTURE_TILE_METERS constant for upcoming UV work"
```

---

### Task 3: Source and download texture assets

**This task requires a pause for user confirmation before downloading anything.**

**Files:**
- Create: `public/textures/kind-generic-diffuse.jpg`, `kind-generic-roughness.jpg`
- Create: `public/textures/kind-residential-diffuse.jpg`, `kind-residential-roughness.jpg`
- Create: `public/textures/kind-commercial-diffuse.jpg`, `kind-commercial-roughness.jpg`
- Create: `public/textures/kind-tower-diffuse.jpg`, `kind-tower-roughness.jpg`
- Create: `public/textures/kind-religious-diffuse.jpg`, `kind-religious-roughness.jpg`
- Create: `public/textures/landmark-glass-diffuse.jpg`, `landmark-glass-roughness.jpg`
- Create: `public/textures/landmark-gold-diffuse.jpg`, `landmark-gold-roughness.jpg`
- Create: `public/textures/landmark-stucco-diffuse.jpg`, `landmark-stucco-roughness.jpg`
- Create: `public/textures/landmark-laterite-diffuse.jpg`, `landmark-laterite-roughness.jpg`
- Create: `public/textures/landmark-concrete-diffuse.jpg`, `landmark-concrete-roughness.jpg`
- Create: `public/textures/landmark-pavement-diffuse.jpg`, `landmark-pavement-roughness.jpg`
- Create: `public/textures/ground-diffuse.jpg`, `ground-roughness.jpg`
- Create: `public/textures/road-diffuse.jpg`
- Create: `public/textures/water-diffuse.jpg`

26 files total. Each must be a **tileable/seamless** texture (both sites label these explicitly) so `RepeatWrapping` doesn't show visible seams. Target ~512×512 (1024×1024 acceptable for the atlas/landmark textures if the seamless tile at that resolution is meaningfully better — avoid 2048+, unnecessary at this camera distance and bad for load time).

Texture roles (what to search for on ambientCG.com / polyhaven.com):

| File prefix | Search term | Used by |
|---|---|---|
| `kind-generic` | concrete, weathered | mass buildings, kind 0 |
| `kind-residential` | plaster / stucco, warm tan | mass buildings, kind 1 |
| `kind-commercial` | concrete panel / facade | mass buildings, kind 2 |
| `kind-tower` | glass / glass curtain wall | mass buildings, kind 3 |
| `kind-religious` | ochre plaster / weathered stucco | mass buildings, kind 4 |
| `landmark-glass` | blue-tinted glass panel | Vattanac/Peak/Morgan/NagaWorld towers |
| `landmark-gold` | gold leaf / gilded tile | palace + NagaWorld roofs |
| `landmark-stucco` | white/cream plaster | palace walls, vihara |
| `landmark-laterite` | laterite stone / red sandstone | Independence Monument |
| `landmark-concrete` | concrete, smooth | podiums, bridge deck, Naga3 site, crane/steel reuse |
| `landmark-pavement` | paving stone / cobblestone | plazas, monument base |
| `ground` | dirt / packed earth / asphalt ground | ground plane |
| `road` | asphalt | roads (single texture, day/night tint via `roadMaterial.color` already handles major/minor distinction visually) |
| `water` | water surface / ripple | river/lake |

- [ ] **Step 1: Search ambientCG.com and polyhaven.com for each role above**

Use WebSearch/WebFetch against the two approved sites only. Of the 14 roles in the table, 12 need both a diffuse and a roughness map (the 5 `kind-*` roles + the 6 `landmark-*` roles + `ground`), and 2 need diffuse only (`road`, `water`) — 12×2 + 2×1 = 26 files, matching the Files list above.

- [ ] **Step 2: Present the exact file list for confirmation**

Before downloading anything, message the user with a table: role, chosen source URL, resolution, license (should be CC0/public domain in every row — if a site's specific asset isn't CC0, do not use it, keep searching). Wait for explicit go-ahead.

- [ ] **Step 3: Download into `public/textures/` with the exact filenames from the Files list above**

- [ ] **Step 4: Verify all 26 files exist and are non-trivial in size**

Run:
```bash
node -e "
const fs = require('fs');
const files = fs.readdirSync('public/textures');
console.log('count:', files.length);
for (const f of files) {
  const size = fs.statSync('public/textures/' + f).size;
  if (size < 10000) console.log('SUSPICIOUSLY SMALL:', f, size, 'bytes');
}
"
```
Expected: `count: 26`, no "SUSPICIOUSLY SMALL" lines (a truncated/failed download would be near-0 bytes).

- [ ] **Step 5: Commit**

```bash
git add public/textures/
git commit -m "Add CC0 texture assets from ambientCG/Poly Haven

26 tileable textures: 5 mass-building kind materials (diffuse+roughness),
6 landmark surface materials (diffuse+roughness), ground (diffuse+roughness),
road (diffuse), water (diffuse). All public domain, no attribution required."
```

---

### Task 4: World-scale building UV generator, wired into mass-building extrusion

Building `kind` (0-4) is static per building — it never changes at runtime (unlike day/night state) — so texture-atlas selection can be baked directly into UV coordinates at geometry-build time, using three.js's own `ExtrudeGeometry.UVGenerator` extension point (verified present in the installed three.js at `node_modules/three/src/geometries/ExtrudeGeometry.js:97`, hooks: `generateTopUV(geometry, vertices, indexA, indexB, indexC)` and `generateSideWallUV(geometry, vertices, indexA, indexB, indexC, indexD)`). This avoids a new per-vertex runtime attribute entirely.

Because `ringsToShape()` builds shapes directly from real local-meter footprint coordinates (not normalized 0-1 shape space), the raw vertex x/y/z values three.js's `UVGenerator` callback receives are already true world meters — the default `WorldUVGenerator` three.js ships (same file, `WorldUVGenerator` object) already does roughly the right thing; this task's generator extends it with (a) division by `TEXTURE_TILE_METERS` so the numbers become tileable 0-1-repeating UV units, and (b) a fixed offset shifting every UV into this building's 1/5-wide slot in the shared 5-slot atlas.

**Files:**
- Create: `src/lib/buildingUV.ts`
- Create: `src/lib/buildingUV.test.ts`
- Modify: `src/lib/buildTileGeometry.ts:52-62` (the `extrudeBuilding` function)

**Interfaces:**
- Consumes: `TEXTURE_TILE_METERS` from `../config` (Task 2). `BuildingRec.k: number` from `./loadCityData` (existing).
- Produces: `createBuildingUVGenerator(kind: number): THREE.ExtrudeGeometryOptions['UVGenerator']` — consumed by `extrudeBuilding()` in this same task, and conceptually by Task 5's atlas layout (atlas must lay its 5 tiles out in kind order `[generic, residential, commercial, tower, religious]` matching indices 0-4 for this generator's offsets to line up).

- [ ] **Step 1: Write the failing test**

Create `src/lib/buildingUV.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createBuildingUVGenerator } from './buildingUV';

describe('createBuildingUVGenerator', () => {
  it('bakes the atlas slot offset into top-face U, scaled by tile size', () => {
    const gen = createBuildingUVGenerator(2); // kind 2 = commercial, slot 2 of 5
    // a flat triangle at (0,0) (8,0) (0,8) in the shape's local meter space —
    // x,y here map to vertices[i*3], vertices[i*3+1]
    const vertices = [0, 0, 0, 8, 0, 0, 0, 8, 0];
    const uvs = gen.generateTopUV({} as never, vertices, 0, 1, 2);
    // TEXTURE_TILE_METERS=8, so x=8 -> 8/8=1 -> wraps to 0 -> pure slot offset
    expect(uvs[0].x).toBeCloseTo(2 / 5);
    expect(uvs[1].x).toBeCloseTo(2 / 5);
    expect(uvs[0].y).toBeCloseTo(0);
  });

  it('keeps every side-wall U within this kind\'s atlas slot', () => {
    const gen = createBuildingUVGenerator(0); // kind 0 = generic, slot 0 of 5
    // wall quad: contour points j=(0,0) k=(4,0), heights 0 (a,b) and 3 (d,c)
    const vertices = [
      0, 0, 0, // a: point j, height 0
      4, 0, 0, // b: point k, height 0
      4, 0, 3, // c: point k, height 3
      0, 0, 3, // d: point j, height 3
    ];
    const uvs = gen.generateSideWallUV({} as never, vertices, 0, 1, 2, 3);
    for (const uv of uvs) {
      expect(uv.x).toBeGreaterThanOrEqual(0);
      expect(uv.x).toBeLessThan(1 / 5); // slot 0 spans [0, 0.2)
    }
    expect(uvs[0].y).toBeCloseTo(0); // a: height 0
    expect(uvs[2].y).toBeCloseTo(3 / 8); // c: height 3, TEXTURE_TILE_METERS=8
  });

  it('wraps negative shape coordinates into the same slot range', () => {
    const gen = createBuildingUVGenerator(4);
    const vertices = [-3, 0, 0, 5, 0, 0, -3, 5, 0];
    const uvs = gen.generateTopUV({} as never, vertices, 0, 1, 2);
    for (const uv of uvs) {
      expect(uv.x).toBeGreaterThanOrEqual(4 / 5 - 1e-9);
      expect(uv.x).toBeLessThan(1 - 1e-9 + 1 / 5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- buildingUV`
Expected: FAIL — `Cannot find module './buildingUV'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/buildingUV.ts`:

```ts
import * as THREE from 'three';
import { TEXTURE_TILE_METERS } from '../config';

const ATLAS_SLOTS = 5; // must match the atlas layout order in loadAtlas.ts (Task 5)

// Custom THREE.ExtrudeGeometry.UVGenerator. Our shapes (see shapes.ts /
// ringsToShape) are built from real local-meter footprint coordinates, so
// the raw vertex x/y/z the UVGenerator callbacks receive are already true
// world meters — this mirrors three.js's own WorldUVGenerator (see
// node_modules/three/src/geometries/ExtrudeGeometry.js) but (a) divides by
// TEXTURE_TILE_METERS so the numbers become tileable UV units, and (b)
// shifts every U into this building's fixed 1/ATLAS_SLOTS-wide slot in the
// shared kind-texture atlas. `kind` is static per building (never changes
// at runtime, unlike day/night), so this offset is baked once at geometry-
// build time — no new per-vertex runtime attribute needed.
export function createBuildingUVGenerator(kind: number): THREE.ExtrudeGeometryOptions['UVGenerator'] {
  const offset = kind / ATLAS_SLOTS;
  const slotWidth = 1 / ATLAS_SLOTS;

  function atlasU(worldMeters: number): number {
    const local = (worldMeters / TEXTURE_TILE_METERS) % 1;
    const wrapped = local < 0 ? local + 1 : local;
    return offset + wrapped * slotWidth;
  }
  function v(worldMeters: number): number {
    return worldMeters / TEXTURE_TILE_METERS;
  }

  return {
    generateTopUV(_geometry, vertices, indexA, indexB, indexC) {
      const at = (i: number) => new THREE.Vector2(atlasU(vertices[i * 3]), v(vertices[i * 3 + 1]));
      return [at(indexA), at(indexB), at(indexC)];
    },
    generateSideWallUV(_geometry, vertices, indexA, indexB, indexC, indexD) {
      const a_x = vertices[indexA * 3], a_y = vertices[indexA * 3 + 1], a_z = vertices[indexA * 3 + 2];
      const b_x = vertices[indexB * 3], b_y = vertices[indexB * 3 + 1], b_z = vertices[indexB * 3 + 2];
      const c_x = vertices[indexC * 3], c_y = vertices[indexC * 3 + 1], c_z = vertices[indexC * 3 + 2];
      const d_x = vertices[indexD * 3], d_y = vertices[indexD * 3 + 1], d_z = vertices[indexD * 3 + 2];
      // pick whichever axis varies more between A and B — same heuristic
      // three.js's own WorldUVGenerator uses. A/D share one contour point
      // (only height differs), B/C share the other, so this stays
      // consistent along each vertical wall edge.
      const useX = Math.abs(a_y - b_y) < Math.abs(a_x - b_x);
      if (useX) {
        return [
          new THREE.Vector2(atlasU(a_x), v(a_z)),
          new THREE.Vector2(atlasU(b_x), v(b_z)),
          new THREE.Vector2(atlasU(c_x), v(c_z)),
          new THREE.Vector2(atlasU(d_x), v(d_z)),
        ];
      }
      return [
        new THREE.Vector2(atlasU(a_y), v(a_z)),
        new THREE.Vector2(atlasU(b_y), v(b_z)),
        new THREE.Vector2(atlasU(c_y), v(c_z)),
        new THREE.Vector2(atlasU(d_y), v(d_z)),
      ];
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- buildingUV`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the generator into `extrudeBuilding()`**

In `src/lib/buildTileGeometry.ts`, add the import near the top (after the existing `import { tileIndex, ... } from './tiles';` line):

```ts
import { createBuildingUVGenerator } from './buildingUV';
```

Replace the `extrudeBuilding` function (currently lines 52-62):

```ts
function extrudeBuilding(b: BuildingRec): THREE.BufferGeometry {
  const geom = new THREE.ExtrudeGeometry(ringsToShape(b.r), {
    depth: b.h,
    bevelEnabled: false,
    curveSegments: 1,
    UVGenerator: createBuildingUVGenerator(b.k),
  });
  geom.rotateX(-Math.PI / 2); // shape XY + extrude Z → world XZ + height Y
  return geom;
}
```

(The `geom.deleteAttribute('uv')` call and its comment are removed — we now want real UVs.)

- [ ] **Step 6: Write a test proving the wiring works end-to-end**

Create `src/lib/buildTileGeometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCityTiles } from './buildTileGeometry';
import type { BuildingRec } from './loadCityData';

describe('buildCityTiles', () => {
  it('produces detail geometry with a uv attribute confined to the building\'s kind slot', () => {
    const building: BuildingRec = {
      h: 10,
      k: 1, // residential — slot 1 of 5, spans [0.2, 0.4)
      r: [[0, 0, 10, 0, 10, 10, 0, 10]], // 10x10 square footprint
    };
    const tiles = buildCityTiles([building]);
    expect(tiles).toHaveLength(1);
    const uv = tiles[0].detail.getAttribute('uv');
    expect(uv).toBeDefined();
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(1 / 5 - 1e-6);
      expect(uv.getX(i)).toBeLessThan(2 / 5 + 1e-6);
    }
  });
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- buildTileGeometry`
Expected: PASS. If it fails with a `document is not defined` or similar DOM error, add `// @vitest-environment jsdom` as the first line of this test file and install `jsdom` as a devDependency — but this shouldn't be needed, since `ExtrudeGeometry` construction is pure CPU-side three.js code.

- [ ] **Step 8: Run the full build to confirm nothing else broke**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/buildingUV.ts src/lib/buildingUV.test.ts src/lib/buildTileGeometry.ts src/lib/buildTileGeometry.test.ts
git commit -m "Bake texture-atlas UV offsets into mass-building extrusions

Uses ExtrudeGeometry's native UVGenerator hook instead of a new per-vertex
runtime attribute, since building kind never changes at runtime. Keeps the
existing single-draw-call-per-tile architecture unchanged."
```

---

### Task 5: Runtime kind-atlas compositing + mass-building material PBR swap

The 5 kind textures (Task 3) are downloaded as separate same-size files rather than pre-stitched, and composited into one atlas at runtime via an offscreen canvas — this avoids adding an image-processing build step or a native dependency like `sharp`. `createCityMaterial()` stays synchronous (so `CityTiles.tsx`'s existing `useMemo(createCityMaterial, [])` call doesn't need to change) — the atlas texture loads asynchronously and is assigned onto the already-in-use material once ready.

**Files:**
- Create: `src/lib/loadAtlas.ts`
- Modify: `src/scene/cityMaterial.ts`
- Create: `src/scene/cityMaterial.test.ts`

**Interfaces:**
- Consumes: none new (browser `Image`/`canvas` APIs, `import.meta.env.BASE_URL` — same pattern already used in `loadCityData.ts`).
- Produces: `loadKindAtlas(variant: 'diffuse' | 'roughness'): Promise<THREE.Texture>` — atlas slot order `['generic', 'residential', 'commercial', 'tower', 'religious']` (indices 0-4), must match `createBuildingUVGenerator`'s slot indexing from Task 4. `createCityMaterial(): THREE.MeshStandardMaterial` (return type changes from `MeshLambertMaterial` — `CityTiles.tsx` doesn't annotate the type explicitly so this is a non-breaking change there).

- [ ] **Step 1: Write `loadAtlas.ts`**

Create `src/lib/loadAtlas.ts`:

```ts
import * as THREE from 'three';

// Order matters — index 0-4 must match createBuildingUVGenerator's kind
// slot indexing (src/lib/buildingUV.ts) and BuildingRec.k's kind values
// (0 generic, 1 residential, 2 commercial, 3 tower, 4 religious).
const KIND_ORDER = ['generic', 'residential', 'commercial', 'tower', 'religious'] as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Composites the 5 same-size per-kind textures side by side into one atlas
// texture via an offscreen canvas — avoids a build-time image-processing
// step (no sharp/canvas native dependency) for a one-time 5-image composite.
export async function loadKindAtlas(variant: 'diffuse' | 'roughness'): Promise<THREE.Texture> {
  const base = `${import.meta.env.BASE_URL}textures/`;
  const images = await Promise.all(
    KIND_ORDER.map((name) => loadImage(`${base}kind-${name}-${variant}.jpg`)),
  );
  const tileSize = images[0].naturalWidth;
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * images.length;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d')!;
  images.forEach((img, i) => ctx.drawImage(img, i * tileSize, 0, tileSize, tileSize));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = variant === 'diffuse' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}
```

No dedicated unit test for this file: it's thin browser-I/O glue (`Image`/`canvas`/`fetch` loading), not logic — a Node-environment test would need to mock every browser API involved, which tests the mocks more than the code. It's covered by this task's visual verification instead (Task 11).

- [ ] **Step 2: Write the failing test for the material swap**

Create `src/scene/cityMaterial.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCityMaterial } from './cityMaterial';

describe('createCityMaterial', () => {
  it('returns a PBR material with vertex colors enabled', () => {
    const mat = createCityMaterial();
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.vertexColors).toBe(true);
  });

  it('injects the night-window uniform and shader chunks via onBeforeCompile', () => {
    const mat = createCityMaterial();
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <dithering_fragment>\n}',
    };
    mat.onBeforeCompile!(shader as never, null as never);
    expect(shader.uniforms.uNight).toBeDefined();
    expect(shader.vertexShader).toContain('attribute vec2 aWindow');
    expect(shader.fragmentShader).toContain('cityHash');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- cityMaterial`
Expected: FAIL — first assertion fails because `createCityMaterial()` currently returns `MeshLambertMaterial`.

- [ ] **Step 4: Modify `cityMaterial.ts`**

Replace the full contents of `src/scene/cityMaterial.ts`:

```ts
import * as THREE from 'three';
import { loadKindAtlas } from '../lib/loadAtlas';

// Single shared material for all city tiles — one shader program, vertex
// colors carry per-building variation on top of the 5-slot kind-texture
// atlas (loaded asynchronously and assigned once ready). At night, a window
// grid derived from world position is lit on wall faces (aWindow attribute:
// seed + wall flag, baked in buildTileGeometry).
export const nightUniform = { value: 0 };

export function createCityMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

  loadKindAtlas('diffuse').then((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    mat.map = tex;
    mat.needsUpdate = true;
  });
  loadKindAtlas('roughness').then((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    mat.roughnessMap = tex;
    mat.needsUpdate = true;
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aWindow;
varying vec3 vCityWorldPos;
varying vec2 vAWindow;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vCityWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
vAWindow = aWindow;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
varying vec3 vCityWorldPos;
varying vec2 vAWindow;
float cityHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`,
      )
      .replace(
        '#include <dithering_fragment>',
        `if (uNight > 0.001 && vAWindow.y > 0.5) {
  float floorY = vCityWorldPos.y / 3.2;
  float cellX = (vCityWorldPos.x + vCityWorldPos.z) / 2.6;
  float lit = step(cityHash(vec2(floor(floorY), floor(cellX)) + vAWindow.x * 91.7), 0.35);
  float pane = step(0.25, fract(floorY)) * step(fract(floorY), 0.8)
             * step(0.2, fract(cellX)) * step(fract(cellX), 0.85);
  gl_FragColor.rgb += vec3(1.0, 0.82, 0.5) * (lit * pane * uNight);
}
#include <dithering_fragment>`,
      );
  };

  return mat;
}
```

(This changes `MeshLambertMaterial` → `MeshStandardMaterial` and adds the two `loadKindAtlas(...).then(...)` blocks. The `onBeforeCompile` body is unchanged — its three injection points, `#include <common>`, `#include <begin_vertex>`, `#include <dithering_fragment>`, are confirmed present in `MeshStandardMaterial`'s shader template too, `node_modules/three/src/renderers/shaders/ShaderLib/meshphysical.glsl.js`, same as Lambert's.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- cityMaterial`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/loadAtlas.ts src/scene/cityMaterial.ts src/scene/cityMaterial.test.ts
git commit -m "Composite kind-texture atlas at runtime, swap city material to PBR

MeshLambertMaterial -> MeshStandardMaterial (needed to respond correctly
to real shadows added in a later task). Atlas is 5 same-size per-kind
images composited via canvas at load time, avoiding a build-time image
tool. Night-window onBeforeCompile hook carries over unchanged."
```

---

### Task 6: Landmark material textures

All 9 landmark components already reference a shared `MAT` object (e.g. `<mesh material={MAT.glass} />`) — swapping the material *definitions* in `materials.ts` requires zero changes to the 9 landmark component files themselves.

**Files:**
- Modify: `src/scene/landmarks/materials.ts`
- Create: `src/scene/landmarks/materials.test.ts`

**Interfaces:**
- Consumes: texture files from Task 3 (`landmark-glass-*`, `landmark-gold-*`, `landmark-stucco-*`, `landmark-laterite-*`, `landmark-concrete-*`, `landmark-pavement-*`).
- Produces: `MAT` object — same shape/keys as before (`glass`, `glassDark`, `white`, `cream`, `gold`, `goldDark`, `laterite`, `concrete`, `pavement`, `green`, `treeGreen`, `steel`, `craneYellow`), consumed unchanged by all 9 files in `src/scene/landmarks/*.tsx` and by the `GLOWING` array in `src/scene/Lighting.tsx:30-35` (which references `MAT.glass`, `MAT.glassDark`, `MAT.gold`, `MAT.goldDark` by object identity — those four keys must remain the same object type family, `MeshStandardMaterial`, which supports `.emissive`/`.emissiveIntensity` exactly like `MeshLambertMaterial` did, so `Lighting.tsx` needs no changes).

- [ ] **Step 1: Write the failing test**

Create `src/scene/landmarks/materials.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MAT } from './materials';

describe('landmark MAT palette', () => {
  it('textures the surfaces meant to look real', () => {
    const textured = [
      'glass', 'glassDark', 'white', 'cream',
      'gold', 'goldDark', 'laterite', 'concrete', 'pavement', 'steel',
    ] as const;
    for (const key of textured) {
      expect(MAT[key]).toBeInstanceOf(THREE.MeshStandardMaterial);
    }
  });

  it('keeps foliage and thin crane details flat-colored', () => {
    expect(MAT.green).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(MAT.treeGreen).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(MAT.craneYellow).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('still supports emissive for the night-glow lerp in Lighting.tsx', () => {
    for (const key of ['glass', 'glassDark', 'gold', 'goldDark'] as const) {
      expect(MAT[key].emissive).toBeUndefined(); // not yet assigned by materials.ts itself
      MAT[key].emissive = new THREE.Color('#111111');
      MAT[key].emissiveIntensity = 0.5;
      expect(MAT[key].emissiveIntensity).toBe(0.5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- landmarks/materials`
Expected: FAIL — all `MAT.*` entries are currently `MeshLambertMaterial`.

- [ ] **Step 3: Modify `materials.ts`**

Replace the full contents of `src/scene/landmarks/materials.ts`:

```ts
import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function textured(basePath: string, color: string, repeat = 4): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  loader.loadAsync(`${import.meta.env.BASE_URL}textures/${basePath}-diffuse.jpg`).then((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    mat.map = tex;
    mat.needsUpdate = true;
  });
  loader.loadAsync(`${import.meta.env.BASE_URL}textures/${basePath}-roughness.jpg`).then((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    mat.roughnessMap = tex;
    mat.needsUpdate = true;
  });
  return mat;
}

// Shared stylized landmark palette. Each entry is a textured
// MeshStandardMaterial for the real surface it represents; `color` still
// tints the texture (kept close to the original flat-color values so the
// day/night emissive lerp in Lighting.tsx, which references these exact
// object instances, needs no changes).
export const MAT = {
  glass: textured('landmark-glass', '#8fb4d4', 2),
  glassDark: textured('landmark-glass', '#5d7f9e', 2),
  white: textured('landmark-stucco', '#ece7db', 3),
  cream: textured('landmark-stucco', '#e3d9bd', 3),
  gold: textured('landmark-gold', '#c9a227', 2),
  goldDark: textured('landmark-gold', '#a9852b', 2),
  laterite: textured('landmark-laterite', '#6b3a2a', 3),
  concrete: textured('landmark-concrete', '#b5ad9d', 3),
  pavement: textured('landmark-pavement', '#d8d2c0', 4),
  // flat — foliage textures don't read meaningfully on these low-poly
  // shapes (tree spheres, the Wat Phnom hill cone) at this camera scale
  green: new THREE.MeshLambertMaterial({ color: '#5a7a4a' }),
  treeGreen: new THREE.MeshLambertMaterial({ color: '#3f5f38' }),
  // reuses the concrete texture, tinted — a handful of thin crane/steel
  // details don't justify a 27th texture asset
  steel: textured('landmark-concrete', '#9aa2a8', 3),
  // flat — thin crane mast/jib boxes, not worth texturing
  craneYellow: new THREE.MeshLambertMaterial({ color: '#d8a13a' }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- landmarks/materials`
Expected: PASS (3 tests). Note: this test only checks material *type* and object-shape, not that texture loading completes — `TextureLoader().loadAsync()` fires async browser I/O in a `.then()` that a Node test environment won't resolve; this is expected and harmless (the synchronous material construction, which is what's asserted, already happened before the promise settles).

- [ ] **Step 5: Run the full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/scene/landmarks/materials.ts src/scene/landmarks/materials.test.ts
git commit -m "Texture the 9 landmarks' shared material palette

Swaps MeshLambertMaterial -> MeshStandardMaterial with real CC0 textures
for glass/gold/stucco/laterite/concrete/pavement. Foliage and thin crane
details stay flat-colored. Zero changes needed in the 9 landmark component
files since they all reference these MAT.* objects by identity."
```

---

### Task 7: Loft (tower) UV generation

`src/lib/loft.ts`'s `loftGeometry()` builds custom `BufferGeometry` directly (not via `ExtrudeGeometry`), used by the Vattanac/Peak/Morgan tower shapes — it currently has no `uv` attribute at all. This adds one, using the same world-scale-meters philosophy as Task 4 but computed directly during the existing ring-construction loop (arc length around the profile perimeter for U, section height for V).

**Files:**
- Modify: `src/lib/loft.ts`
- Create: `src/lib/loft.test.ts`

**Interfaces:**
- Consumes: `TEXTURE_TILE_METERS` from `../config` (Task 2).
- Produces: `loftGeometry()`'s return value now includes a `uv` attribute — consumed transparently by `VattanacTower.tsx`, `ThePeak.tsx`, `MorganEnmaison.tsx` (they just pass the resulting geometry straight to a `<mesh>`, no changes needed there since they already use the now-textured `MAT.glass`/`MAT.glassDark` from Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/lib/loft.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loftGeometry, roundedRectProfile } from './loft';

describe('loftGeometry', () => {
  it('generates a uv attribute alongside position', () => {
    const profile = roundedRectProfile(10, 10, 0, 1); // simple square-ish profile
    const geom = loftGeometry(profile, [
      { y: 0, sx: 1, sz: 1 },
      { y: 8, sx: 1, sz: 1 }, // 8m up == exactly 1 texture tile (TEXTURE_TILE_METERS=8)
    ]);
    const uv = geom.getAttribute('uv');
    expect(uv).toBeDefined();
    expect(uv.count).toBe(geom.getAttribute('position').count);
  });

  it('scales V by section height / TEXTURE_TILE_METERS', () => {
    const profile = roundedRectProfile(10, 10, 0, 1);
    const geom = loftGeometry(profile, [
      { y: 0, sx: 1, sz: 1 },
      { y: 16, sx: 1, sz: 1 }, // 16m == 2 tiles
    ]);
    const uv = geom.getAttribute('uv');
    const pos = geom.getAttribute('position');
    // find a vertex at y=16 (top ring) and check its V
    let found = false;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - 16) < 1e-6) {
        expect(uv.getY(i)).toBeCloseTo(2);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- loft`
Expected: FAIL — `uv` attribute is `undefined`.

- [ ] **Step 3: Modify `loft.ts`**

In `src/lib/loft.ts`, add the import at the top:

```ts
import { TEXTURE_TILE_METERS } from '../config';
```

Replace the `loftGeometry` function body (currently the whole function):

```ts
function profileArcLengths(profile: [number, number][]): number[] {
  const lengths = [0];
  for (let i = 1; i < profile.length; i++) {
    const [x0, z0] = profile[i - 1];
    const [x1, z1] = profile[i];
    lengths.push(lengths[i - 1] + Math.hypot(x1 - x0, z1 - z0));
  }
  return lengths;
}

export function loftGeometry(profile: [number, number][], sections: LoftSection[]): THREE.BufferGeometry {
  const n = profile.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const arcLengths = profileArcLengths(profile);

  const ringAt = (s: LoftSection) =>
    profile.map(([px, pz]) => [px * s.sx + (s.ox ?? 0), s.y, pz * s.sz + (s.oz ?? 0)]);

  const rings = sections.map(ringAt);
  for (let ri = 0; ri < rings.length; ri++) {
    for (let pi = 0; pi < n; pi++) {
      const p = rings[ri][pi];
      positions.push(p[0], p[1], p[2]);
      // U follows arc length around the (unscaled) profile perimeter; V
      // follows section height. Caps reuse ring vertices' UVs as-is — a
      // minor stretch on the (rarely-seen, small) tower rooftop, accepted
      // rather than special-casing flat-cap UV projection for this scale.
      uvs.push(arcLengths[pi] / TEXTURE_TILE_METERS, sections[ri].y / TEXTURE_TILE_METERS);
    }
  }

  // side quads between consecutive rings
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + j1;
      const c = (i + 1) * n + j1;
      const d = (i + 1) * n + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // caps (fan-triangulated via ShapeUtils to handle any convex-ish profile)
  const vec2s = profile.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(vec2s, []);
  const topBase = (rings.length - 1) * n;
  for (const [a, b, c] of tris) {
    indices.push(topBase + a, topBase + b, topBase + c); // top
    indices.push(c, b, a); // bottom, reversed
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  const nonIndexed = geom.toNonIndexed(); // flat shading-friendly normals; expands uv too
  nonIndexed.computeVertexNormals();
  geom.dispose();
  return nonIndexed;
}
```

(Only the `positions`/`uvs` construction and the two `geom.setAttribute`/`setIndex` lines actually change; the side-quad and cap index logic is unchanged, reproduced here in full per the plan's no-partial-file-diff convention.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- loft`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/loft.ts src/lib/loft.test.ts
git commit -m "Add world-scale UV generation to the tower loft geometry

Used by Vattanac/Peak/Morgan Enmaison — now paired with textured
MAT.glass/glassDark from the previous task instead of rendering with no
UVs at all."
```

---

### Task 8: Shadow-enable utility, wired into landmarks

Landmarks are built as many small individual meshes per component (unlike the mass city tiles, which are one merged geometry per tile) — enabling `castShadow`/`receiveShadow` on each requires a traversal, not a single flag. Extracted as a standalone utility so it's unit-testable without a renderer.

**Files:**
- Create: `src/lib/enableShadows.ts`
- Create: `src/lib/enableShadows.test.ts`
- Modify: `src/scene/landmarks/index.tsx`

**Interfaces:**
- Produces: `enableShadows(object: THREE.Object3D): void` — called once per landmark group via a ref callback in `index.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/enableShadows.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { enableShadows } from './enableShadows';

describe('enableShadows', () => {
  it('sets castShadow and receiveShadow on every descendant mesh', () => {
    const group = new THREE.Group();
    const nested = new THREE.Group();
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry());
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry());
    nested.add(mesh2);
    group.add(mesh1, nested);

    enableShadows(group);

    expect(mesh1.castShadow).toBe(true);
    expect(mesh1.receiveShadow).toBe(true);
    expect(mesh2.castShadow).toBe(true);
    expect(mesh2.receiveShadow).toBe(true);
  });

  it('does not throw on a group with no meshes', () => {
    expect(() => enableShadows(new THREE.Group())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- enableShadows`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/enableShadows.ts`:

```ts
import * as THREE from 'three';

// Recursively enables cast+receive shadows on every Mesh under `object`.
// Landmarks are built as many small individual meshes rather than one
// merged geometry (unlike the mass-generated city tiles), so this needs a
// traversal rather than a single flag.
export function enableShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- enableShadows`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `landmarks/index.tsx`**

In `src/scene/landmarks/index.tsx`, add the import:

```ts
import { enableShadows } from '../../lib/enableShadows';
```

In the `Landmarks` component's returned JSX, the `<group>` currently reads:

```tsx
<group
  key={l.id}
  position={l.absolute ? [0, 0, 0] : [x, 0, z]}
  userData={{ landmarkId: l.id }}
  onClick={(e) => {
    e.stopPropagation();
    setSelected(l.id);
  }}
  onPointerOver={() => (document.body.style.cursor = 'pointer')}
  onPointerOut={() => (document.body.style.cursor = 'auto')}
>
```

Add a `ref` prop (landmark geometry is static after mount, so a one-shot ref callback is sufficient — no cleanup/effect needed):

```tsx
<group
  key={l.id}
  position={l.absolute ? [0, 0, 0] : [x, 0, z]}
  userData={{ landmarkId: l.id }}
  ref={(g) => {
    if (g) enableShadows(g);
  }}
  onClick={(e) => {
    e.stopPropagation();
    setSelected(l.id);
  }}
  onPointerOver={() => (document.body.style.cursor = 'pointer')}
  onPointerOut={() => (document.body.style.cursor = 'auto')}
>
```

- [ ] **Step 6: Run the full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/enableShadows.ts src/lib/enableShadows.test.ts src/scene/landmarks/index.tsx
git commit -m "Enable shadows on all 9 landmarks via a traversal utility

Landmarks are many small meshes per component, not one merged geometry,
so castShadow/receiveShadow needs a one-time traversal on mount rather
than a single flag."
```

---

### Task 9: Shadow-camera-follows-camera + sun shadow config + Canvas shadows

The shadow camera's orthographic frustum can't cover the full ~8km bbox without becoming too coarse to read as shadows. Instead, a tight frustum follows wherever `CameraControls`' look-at target currently is, repositioned every frame — the follow math is extracted into a standalone function so it's testable without a renderer.

**Files:**
- Create: `src/lib/shadowFollow.ts`
- Create: `src/lib/shadowFollow.test.ts`
- Modify: `src/scene/Lighting.tsx`
- Modify: `src/App.tsx:10-11` (add `shadows` to `<Canvas>`)
- Modify: `src/scene/CityTiles.tsx:17-18` (cast/receive shadow on the mass-building meshes — this is the actual per-spec "near-camera detail tiles cast+receive, far boxes neither" assignment; without this step the sun would cast shadows with nothing but landmarks and the ground to cast/receive them, missing the single biggest visual case)

**Interfaces:**
- Consumes: `camera-controls`' `CameraControls.getTarget(out: THREE.Vector3, receiveEndValue?: boolean): THREE.Vector3` (verified present at `node_modules/camera-controls/dist/index.d.ts:870`). R3F's `useThree((s) => s.controls)` — populated because `CityScene.tsx`'s `<CameraControls makeDefault ...>` already registers itself as R3F's default controls.
- Produces: `updateShadowFollow(light: THREE.DirectionalLight, targetPoint: THREE.Vector3, sunDirection: THREE.Vector3, distance: number): void`. This task also sets `castShadow`/`receiveShadow` directly on `CityTiles.tsx`'s detail-tier mesh (Step 7) — the concrete per-spec realization of "near-camera detail tiles cast+receive."

- [ ] **Step 1: Write the failing test**

Create `src/lib/shadowFollow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { updateShadowFollow } from './shadowFollow';

describe('updateShadowFollow', () => {
  it('positions the light offset from the target along the sun direction', () => {
    const light = new THREE.DirectionalLight();
    const targetPoint = new THREE.Vector3(100, 0, 200);
    const sunDir = new THREE.Vector3(0, 1, 0);

    updateShadowFollow(light, targetPoint, sunDir, 500);

    expect(light.position.x).toBeCloseTo(100);
    expect(light.position.y).toBeCloseTo(500);
    expect(light.position.z).toBeCloseTo(200);
  });

  it('points the light\'s shadow target at the given point', () => {
    const light = new THREE.DirectionalLight();
    const targetPoint = new THREE.Vector3(-50, 0, 30);

    updateShadowFollow(light, targetPoint, new THREE.Vector3(0, 1, 0), 500);

    expect(light.target.position.x).toBeCloseTo(-50);
    expect(light.target.position.z).toBeCloseTo(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shadowFollow`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/shadowFollow.ts`:

```ts
import * as THREE from 'three';

// Repositions a shadow-casting directional light (and its shadow target)
// so its tight frustum stays centered on wherever the camera is currently
// looking, instead of trying to cover the whole multi-km scene at once —
// the same technique open-world games use to snap a limited shadow
// frustum to the player instead of the whole world.
export function updateShadowFollow(
  light: THREE.DirectionalLight,
  targetPoint: THREE.Vector3,
  sunDirection: THREE.Vector3,
  distance: number,
): void {
  light.position.copy(targetPoint).addScaledVector(sunDirection, distance);
  light.target.position.copy(targetPoint);
  light.target.updateMatrixWorld();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- shadowFollow`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `Lighting.tsx`**

In `src/scene/Lighting.tsx`, replace the full file contents:

```tsx
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import { useAppStore } from '../state/useAppStore';
import { nightUniform } from './cityMaterial';
import { MAT } from './landmarks/materials';
import { updateShadowFollow } from '../lib/shadowFollow';
import {
  waterMaterial, roadMaterial, groundMaterial,
  WATER_DAY, WATER_NIGHT, ROAD_DAY, ROAD_NIGHT, GROUND_DAY, GROUND_NIGHT,
} from './groundMaterials';

const DAY = {
  sky: new THREE.Color('#cfe0ee'),
  hemiSky: new THREE.Color('#bfd9ff'),
  hemiGround: new THREE.Color('#c8b89a'),
  sun: new THREE.Color('#fff5e8'),
  hemiIntensity: 0.9,
  sunIntensity: 1.6,
};
const NIGHT = {
  sky: new THREE.Color('#0a1020'),
  hemiSky: new THREE.Color('#1a2438'),
  hemiGround: new THREE.Color('#141210'),
  sun: new THREE.Color('#b8c8e8'), // moon
  hemiIntensity: 0.22,
  sunIntensity: 0.25,
};

// Landmark materials that glow at night (emissive intensity driven by nightT)
const GLOWING: [THREE.MeshStandardMaterial, string][] = [
  [MAT.glass, '#2a3c52'],
  [MAT.glassDark, '#243448'],
  [MAT.gold, '#4a3a10'],
  [MAT.goldDark, '#3a2e0c'],
];
for (const [mat, color] of GLOWING) {
  mat.emissive = new THREE.Color(color);
  mat.emissiveIntensity = 0;
}

const SUN_DIRECTION = new THREE.Vector3(2000, 4000, 1200).normalize();
const SUN_DISTANCE = 3000;
const SHADOW_FRUSTUM = 400; // meters half-width — follows the camera target instead of covering the full bbox

export default function Lighting() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const nightT = useRef(0);
  const shadowTarget = useRef(new THREE.Vector3());
  const scene = useThree((s) => s.scene);

  if (!scene.fog) {
    scene.fog = new THREE.Fog(DAY.sky.clone(), 3000, 14000);
    scene.background = DAY.sky.clone();
  }

  useFrame((state, dt) => {
    const target = useAppStore.getState().night ? 1 : 0;
    const t = (nightT.current = THREE.MathUtils.damp(nightT.current, target, 3, dt));
    nightUniform.value = t;
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(DAY.hemiIntensity, NIGHT.hemiIntensity, t);
      hemi.current.color.lerpColors(DAY.hemiSky, NIGHT.hemiSky, t);
      hemi.current.groundColor.lerpColors(DAY.hemiGround, NIGHT.hemiGround, t);
    }
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(DAY.sunIntensity, NIGHT.sunIntensity, t);
      sun.current.color.lerpColors(DAY.sun, NIGHT.sun, t);

      const controls = state.controls as unknown as CameraControlsImpl | null;
      if (controls) {
        controls.getTarget(shadowTarget.current);
        updateShadowFollow(sun.current, shadowTarget.current, SUN_DIRECTION, SUN_DISTANCE);
      }
    }
    (scene.background as THREE.Color).lerpColors(DAY.sky, NIGHT.sky, t);
    (scene.fog as THREE.Fog).color.lerpColors(DAY.sky, NIGHT.sky, t);
    for (const [mat] of GLOWING) mat.emissiveIntensity = t;
    waterMaterial.color.lerpColors(WATER_DAY, WATER_NIGHT, t);
    roadMaterial.color.lerpColors(ROAD_DAY, ROAD_NIGHT, t);
    groundMaterial.color.lerpColors(GROUND_DAY, GROUND_NIGHT, t);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity]} />
      <directionalLight
        ref={sun}
        position={[2000, 4000, 1200]}
        intensity={DAY.sunIntensity}
        color={DAY.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_FRUSTUM}
        shadow-camera-right={SHADOW_FRUSTUM}
        shadow-camera-top={SHADOW_FRUSTUM}
        shadow-camera-bottom={-SHADOW_FRUSTUM}
        shadow-camera-near={10}
        shadow-camera-far={SUN_DISTANCE + SHADOW_FRUSTUM}
        shadow-bias={-0.0005}
      />
    </>
  );
}
```

(Changes: `MAT.glass`/etc. type annotation updated to `MeshStandardMaterial` matching Task 6; added `SUN_DIRECTION`/`SUN_DISTANCE`/`SHADOW_FRUSTUM` constants; added `shadowTarget` ref; `useFrame`'s callback now takes `state` instead of `_` so it can read `state.controls`; added the `controls.getTarget(...)` + `updateShadowFollow(...)` block; added `castShadow` + `shadow-*` props to `<directionalLight>`. The day/night color-lerp logic — hemisphere, sun, fog, background, `GLOWING`, water/road/ground colors — is unchanged.)

- [ ] **Step 6: Enable shadow rendering on the Canvas**

In `src/App.tsx`, the `<Canvas>` currently reads:

```tsx
<Canvas
  camera={{ position: [2500, 1800, 3000], near: 10, far: 20000, fov: 50 }}
  onPointerMissed={() => useAppStore.getState().setSelectedLandmark(null)}
  onCreated={(state) => {
    // debug/perf handle for scripted verification
    (window as unknown as { __gl?: unknown }).__gl = state.gl;
  }}
>
```

Add the `shadows` prop:

```tsx
<Canvas
  shadows
  camera={{ position: [2500, 1800, 3000], near: 10, far: 20000, fov: 50 }}
  onPointerMissed={() => useAppStore.getState().setSelectedLandmark(null)}
  onCreated={(state) => {
    // debug/perf handle for scripted verification
    (window as unknown as { __gl?: unknown }).__gl = state.gl;
  }}
>
```

- [ ] **Step 7: Cast/receive shadows on the mass-building tiles**

In `src/scene/CityTiles.tsx`, the two meshes inside `<Detailed>` currently read:

```tsx
<mesh geometry={t.detail} material={material} />
<mesh geometry={t.low} material={material} />
```

Replace with (only the near-camera `detail` mesh casts/receives — the far `low` box tier stays exactly as before, per spec Section 4):

```tsx
<mesh geometry={t.detail} material={material} castShadow receiveShadow />
<mesh geometry={t.low} material={material} />
```

- [ ] **Step 8: Run the full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shadowFollow.ts src/lib/shadowFollow.test.ts src/scene/Lighting.tsx src/App.tsx src/scene/CityTiles.tsx
git commit -m "Add scoped real-time shadows: sun casts, frustum follows camera

Shadow camera frustum is a 400m half-width box centered on wherever
CameraControls' look-at target currently is, repositioned every frame,
instead of trying to cover the full ~8km bbox at a resolution too coarse
to read as shadows. Near-camera detail tiles (LOD0) cast+receive; LOD1
(far boxes) and water stay untouched, per spec."
```

---

### Task 10: Road ribbon geometry + ground/road/water texturing

Roads upgrade from thin unlit `LineSegments` to real ribbon geometry with width — this also finally consumes `roads.json`'s `c` (major/minor) field, present since Phase 1 but never read by the renderer until now. Ground and road get tileable textures with proper `RepeatWrapping`. Water gets a genuine world-scale UV fix (its current per-shape default UV would otherwise stretch a giant river polygon and a tiny pond identically) plus a texture, while staying `MeshBasicMaterial` (unlit) as documented in the existing code comment.

**Files:**
- Create: `src/lib/roadRibbon.ts`
- Create: `src/lib/roadRibbon.test.ts`
- Modify: `src/scene/groundMaterials.ts`
- Modify: `src/scene/Ground.tsx`

**Interfaces:**
- Consumes: `TEXTURE_TILE_METERS` from `../config` (Task 2). `RoadRec.c: number` / `.p: number[]` from `../lib/loadCityData` (existing).
- Produces: `buildRoadRibbon(polyline: number[], width: number): THREE.BufferGeometry`, `roadWidth(c: number): number` — both consumed by `Ground.tsx` in this task.

- [ ] **Step 1: Write the failing test**

Create `src/lib/roadRibbon.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRoadRibbon, roadWidth } from './roadRibbon';

describe('buildRoadRibbon', () => {
  it('builds 2 vertices per polyline point, offset by half the width', () => {
    const polyline = [0, 0, 100, 0]; // straight 100m segment along x
    const geom = buildRoadRibbon(polyline, 12);
    const pos = geom.getAttribute('position');
    expect(pos.count).toBe(4); // 2 points * 2 edges (left/right)
    // straight segment along x -> perpendicular is along z
    expect(Math.abs(pos.getZ(0) - pos.getZ(1))).toBeCloseTo(12);
  });

  it('tiles the V coordinate by distance traveled along the polyline', () => {
    const polyline = [0, 0, 8, 0, 16, 0]; // 16m total, TEXTURE_TILE_METERS=8
    const geom = buildRoadRibbon(polyline, 6);
    const uv = geom.getAttribute('uv');
    expect(uv.getY(0)).toBeCloseTo(0);
    expect(uv.getY(2)).toBeCloseTo(1); // 8m in = 1 tile
    expect(uv.getY(4)).toBeCloseTo(2); // 16m in = 2 tiles
  });
});

describe('roadWidth', () => {
  it('returns a wider width for major roads (c=1) than minor (c=0)', () => {
    expect(roadWidth(1)).toBeGreaterThan(roadWidth(0));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- roadRibbon`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/roadRibbon.ts`:

```ts
import * as THREE from 'three';
import { TEXTURE_TILE_METERS } from '../config';

const MAJOR_WIDTH = 12; // meters
const MINOR_WIDTH = 6;

export function roadWidth(c: number): number {
  return c === 1 ? MAJOR_WIDTH : MINOR_WIDTH;
}

// Turns a flat polyline [x0,z0,x1,z1,...] into a flat-on-the-ground ribbon
// (triangulated quad strip) of the given width, with V tiled by distance
// traveled so an asphalt texture repeats along the road instead of
// stretching across its whole length.
export function buildRoadRibbon(polyline: number[], width: number): THREE.BufferGeometry {
  const pointCount = polyline.length / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const hw = width / 2;
  let dist = 0;

  for (let i = 0; i < pointCount; i++) {
    const x = polyline[i * 2];
    const z = polyline[i * 2 + 1];

    let dx: number, dz: number;
    if (i === 0) {
      dx = polyline[2] - polyline[0];
      dz = polyline[3] - polyline[1];
    } else if (i === pointCount - 1) {
      dx = polyline[i * 2] - polyline[(i - 1) * 2];
      dz = polyline[i * 2 + 1] - polyline[(i - 1) * 2 + 1];
    } else {
      dx = polyline[(i + 1) * 2] - polyline[(i - 1) * 2];
      dz = polyline[(i + 1) * 2 + 1] - polyline[(i - 1) * 2 + 1];
    }
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len; // perpendicular, normalized
    const pz = dx / len;

    if (i > 0) {
      const segDx = x - polyline[(i - 1) * 2];
      const segDz = z - polyline[(i - 1) * 2 + 1];
      dist += Math.hypot(segDx, segDz);
    }

    positions.push(x + px * hw, 0, z + pz * hw); // left edge
    positions.push(x - px * hw, 0, z - pz * hw); // right edge
    const v = dist / TEXTURE_TILE_METERS;
    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < pointCount - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2 + 1, d = (i + 1) * 2;
    indices.push(a, b, d, b, c, d);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- roadRibbon`
Expected: PASS (3 tests).

- [ ] **Step 5: Replace `groundMaterials.ts`**

Replace the full contents of `src/scene/groundMaterials.ts`:

```ts
import * as THREE from 'three';
import { TEXTURE_TILE_METERS } from '../config';

// Module singletons so Lighting can crossfade them with nightT.
// Water is unlit (see Ground.tsx: coplanar OSM water polys), so it must be
// dimmed manually at night.
export const WATER_DAY = new THREE.Color('#4a6f8a');
export const WATER_NIGHT = new THREE.Color('#132433');
export const ROAD_DAY = new THREE.Color('#8a8478');
export const ROAD_NIGHT = new THREE.Color('#3a4048');
export const GROUND_DAY = new THREE.Color('#c8c0ae');
export const GROUND_NIGHT = new THREE.Color('#23262c');

const GROUND_SIZE = 14000;

export const waterMaterial = new THREE.MeshBasicMaterial({ color: WATER_DAY.clone() });
export const roadMaterial = new THREE.MeshStandardMaterial({ color: ROAD_DAY.clone(), roughness: 0.9 });
export const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_DAY.clone(), roughness: 1 });

function loadTiled(path: string, repeat?: number): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`).then((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (repeat) tex.repeat.set(repeat, repeat);
    return tex;
  });
}

// Ground's UV comes from PlaneGeometry's default 0-1 span across the whole
// 14km plane, so it needs an explicit repeat count. Road's UV is already
// self-scaled in meters by buildRoadRibbon (Task 10), and water's UV is
// self-scaled in meters by the world-scale projection in Ground.tsx (this
// task) — neither needs a repeat count, just wrapping mode.
const GROUND_REPEAT = GROUND_SIZE / TEXTURE_TILE_METERS;

loadTiled('textures/ground-diffuse.jpg', GROUND_REPEAT).then((tex) => {
  groundMaterial.map = tex;
  groundMaterial.needsUpdate = true;
});
loadTiled('textures/ground-roughness.jpg', GROUND_REPEAT).then((tex) => {
  groundMaterial.roughnessMap = tex;
  groundMaterial.needsUpdate = true;
});
loadTiled('textures/road-diffuse.jpg').then((tex) => {
  roadMaterial.map = tex;
  roadMaterial.needsUpdate = true;
});
loadTiled('textures/water-diffuse.jpg').then((tex) => {
  waterMaterial.map = tex;
  waterMaterial.needsUpdate = true;
});
```

- [ ] **Step 6: Replace `Ground.tsx`**

Replace the full contents of `src/scene/Ground.tsx`:

```tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData } from '../lib/loadCityData';
import { ringsToShape } from '../lib/shapes';
import { buildRoadRibbon, roadWidth } from '../lib/roadRibbon';
import { TEXTURE_TILE_METERS } from '../config';
import { groundMaterial, waterMaterial, roadMaterial } from './groundMaterials';

const GROUND_SIZE = 14000;

export default function Ground({ data }: { data: CityData }) {
  const waterGeometry = useMemo(() => {
    const geoms = data.water.map((rings) => new THREE.ShapeGeometry(ringsToShape(rings)));
    const merged = mergeGeometries(geoms, false);
    merged.rotateX(-Math.PI / 2);
    geoms.forEach((g) => g.dispose());
    // ShapeGeometry's default UV is 0-1 per polygon's own bounding box —
    // fine for flat color, but would stretch a texture differently on a
    // 4km river vs. a 5m pond. Overwrite with a genuine world-scale
    // projection (position is already real meters at this point).
    const pos = merged.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / TEXTURE_TILE_METERS;
      uv[i * 2 + 1] = pos.getZ(i) / TEXTURE_TILE_METERS;
    }
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return merged;
  }, [data]);

  const roadGeometry = useMemo(() => {
    const parts = data.roads.map((r) => buildRoadRibbon(r.p, roadWidth(r.c)));
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    return merged;
  }, [data]);

  return (
    <>
      {/* y offsets sized for depth precision at km distances (see camera near) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-1} material={groundMaterial} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      </mesh>
      {/* unlit: overlapping OSM water polys (water + riverbank) are coplanar —
          identical unlit color makes their mutual z-fighting invisible */}
      <mesh geometry={waterGeometry} position-y={-0.3} material={waterMaterial} />
      <mesh geometry={roadGeometry} position-y={0.05} material={roadMaterial} receiveShadow />
    </>
  );
}
```

(Replaces the `LineSegments`/`lineSegments` road rendering with a merged ribbon mesh; adds the world-scale water UV overwrite; both ground and road meshes gain `receiveShadow`, matching the spec's Section 4 cast/receive assignment.)

- [ ] **Step 7: Run the full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/roadRibbon.ts src/lib/roadRibbon.test.ts src/scene/groundMaterials.ts src/scene/Ground.tsx
git commit -m "Textured ribbon roads, world-scale water UV, textured ground

Roads: thin LineSegments -> real ribbon geometry with major/minor width,
finally consuming roads.json's c field (present since Phase 1, unused
until now). Water: fixed per-shape UV stretch with a genuine world-scale
projection, stays unlit MeshBasicMaterial per the existing z-fight
reasoning. Ground: tileable texture with a proper repeat count."
```

---

### Task 11: Integration verification

No further code changes — this task confirms the whole feature works together, matching the spec's Verification section.

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests from Tasks 1, 4, 5, 6, 7, 8, 9, 10 PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds. Note the reported bundle size in the output (texture assets in `public/` aren't bundled by Vite — they're copied as static files — so this only reports JS bundle size, unaffected by this plan).

- [ ] **Step 3: Check total texture asset weight against the spec's 3-6MB budget**

Run:
```bash
node -e "
const fs = require('fs');
const files = fs.readdirSync('public/textures');
let total = 0;
for (const f of files) total += fs.statSync('public/textures/' + f).size;
console.log('texture files:', files.length, 'total MB:', (total / 1e6).toFixed(1));
"
```
Expected: total in the 3-6MB range stated in the spec. If it's meaningfully over, revisit texture resolution (Task 3) before proceeding — don't just accept a large regression silently.

- [ ] **Step 4: Start dev server and take comparison screenshots**

Run: `npm run dev` (leave running)

Reuse the existing scratchpad puppeteer screenshot tooling (`screenshot.mjs` / `pose.mjs` / `pose-combined.mjs`, used throughout this project's earlier phases) to capture the same camera poses used in prior verification passes:
- Overview pose (wide, oblique)
- Street-level pose near the Royal Palace
- Each of the 9 landmarks' anchor poses (see `LANDMARK_DEFS` in `src/scene/landmarks/index.tsx` for each landmark's `cameraOffset`/`lookHeight`)
- Night mode toggled on, same poses

Visually confirm: mass buildings show real material variation (not flat color), landmarks show real gold/glass/stone/stucco surfaces, roads have visible width, ground doesn't look like a stretched single image, shadows are visible near the camera and absent far away, night mode still crossfades correctly (lit windows, glowing landmark materials, dimmed ground/road/water).

- [ ] **Step 5: Perf check against the existing 45-60fps target**

Reuse the existing `perf.mjs` scratchpad script (built during the base project's Phase 5) against `npm run preview` (production build) at the same overview/street-level/night poses it already checks. Compare draw calls, triangle count, and FPS against the project's established 45-60fps mid-range-GPU target from the base build.

If FPS drops meaningfully below that target, the shadow map is the most likely cause (per spec Section 4's stated risk) — first thing to try is lowering `shadow-mapSize` in `Lighting.tsx` from `[2048, 2048]` to `[1024, 1024]`, or shrinking `SHADOW_FRUSTUM` from 400 to e.g. 250. Don't add a third variable (texture resolution, atlas size) to the perf investigation until frustum size and map resolution have both been tried, to keep the tuning loop legible.

- [ ] **Step 6: Cold-load timing check**

In the same puppeteer tooling, measure time from `page.goto()` to the first frame with populated `gl.info.render.calls` (same technique `perf.mjs` already uses), same as the base build's Phase 5 load-time check. Confirm it's still reasonable (base build's original target was under ~5s) — the added texture downloads (Task 3) are the main new load-time cost versus the base build.

- [ ] **Step 7: Stop the dev server, commit if any tuning changes were made in Step 5/6**

If Step 5 or 6 required parameter changes (shadow map size, frustum size, etc.), commit them:

```bash
git add src/scene/Lighting.tsx
git commit -m "Tune shadow map resolution/frustum after perf verification"
```

If no tuning was needed, no commit for this task — Task 10's commit is the last code change.
