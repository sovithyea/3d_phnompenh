# Visual Realism Upgrade — Design

## Context

The city currently renders in flat, unlit-feeling color: `MeshLambertMaterial` + per-building vertex-color tint for the ~22k mass-generated buildings, flat-color `MeshLambertMaterial` for the 9 parametric landmarks, and flat-color unlit/lambert planes for ground, water, and roads (roads are thin `LineSegments`, no width). It works and reads as a recognizable city, but it looks like a model, not a place.

The owner wants it to "look more real" — specifically referencing Google Earth's look. That phrase splits into three very different builds:
1. Actual Google Photorealistic 3D Tiles (streamed photogrammetry) — rejected: requires a Google Cloud billing account with a card on file, usage-scales-with-traffic cost exposure on a client-exposed API key, and would discard the entire OSM-extrusion/landmark/night-window pipeline already built.
2. Textured materials + real shadows + realistic ground, built on our own existing pipeline — **chosen direction**.
3. Ground texture only — rejected as too small a change to matter.

Within (2), textures are sourced as downloaded free-license images (not procedurally generated) per the owner's explicit preference.

**Explicitly out of scope for this spec** (decomposed into a separate follow-on, see Non-Goals): adding new landmarks (Central Market, Tuol Sleng, Olympic Stadium). That's independent content work using the same registry/anchor/suppression-zone pattern as the existing 9 landmarks — unrelated to whether buildings are textured or flat. It will automatically benefit from this spec's material system once both exist.

**Expectation set with the owner:** texturing improves *materials*, not *geometry fidelity*. The landmarks are parametric code shapes (cones, lathes, extrusions) approximating real proportions from research, not photogrammetry or blueprint-modeled. This spec makes surfaces look real (actual gold tile pattern, stone grain, glass reflectivity); it does not make the underlying shapes more geometrically accurate to their real-world counterparts. Tighter geometric accuracy is separate, not-yet-scoped work.

"Google Earth ground" also does not mean an actual aerial/satellite photo of Phnom Penh — no imagery source for that exists in this project (Mapbox and Google were both already ruled out for cost/API-key reasons). Ground realism means *realistic generic terrain material* (asphalt/dirt/pavement texture), not real-world-specific imagery.

## Goals

- Mass-generated buildings (~22k) get real, tiled material textures by kind, selected via baked UV atlas offsets — no new per-vertex attributes, no draw-call regression (stays ~1 draw call per 500m tile).
- The 9 landmarks get individually textured materials matching their real surfaces (gold roof tile, laterite stone, glass curtain wall, stucco, concrete).
- Real-time directional shadows, scoped to stay performant: near-camera tiles + landmarks only, shadow camera frustum follows the camera instead of covering the full 8km bbox.
- Ground gets a tileable realistic texture; roads become actual textured ribbon geometry (using the already-present but currently-unused major/minor `c` flag); water gets a texture upgrade while remaining unlit.
- All textures are CC0 (ambientCG.com / polyhaven.com), committed to `public/textures/`, no runtime fetch dependency — consistent with the existing static-site, no-API-key architecture.

## Non-Goals

- New landmarks (Central Market, Tuol Sleng, Olympic Stadium) — separate follow-on spec, reuses this system's materials once built.
- Geometric fidelity improvements to existing landmark shapes.
- Real-time water reflection/refraction — noted as a possible future add-on, not built here.
- Procedural (code-generated) textures — owner explicitly chose downloaded images instead.
- Actual real-world aerial/satellite imagery for the ground — no source available without reintroducing a paid API dependency.

## Design

### 1. Texture sourcing & asset pipeline

Source: **ambientCG.com** and **polyhaven.com**, both fully CC0 (public domain, no attribution required), widely used in three.js projects. Files land in `public/textures/`, committed to the repo — same pattern as `public/data/`, no runtime dependency.

Budget: ~5 mass-building material tiles (residential / commercial / tower-glass / religious / generic-concrete, ~512px) packed into one atlas image, ~12-15 landmark-specific textures (gold tile, laterite stone, glass, stucco, concrete, paving — reused across landmarks that share a material, e.g. palace roof and NagaWorld roof both use the gold material), 1-2 ground textures, 1-2 road textures (major/minor), 1 water texture. Diffuse + roughness map per texture; normal maps only where they visibly matter (brick, concrete, stone) — skip on flat glass. Rough total: 3-6MB uncompressed, acceptable for a portfolio static site.

Process: textures are not downloaded speculatively. Once this spec is approved, the exact file list (filename, source URL, size) will be searched and presented for one batch confirmation before anything is pulled into the repo.

### 2. Mass building materials (~22k procedural buildings)

Building *kind* (0-4: generic/residential/commercial/tower/religious) is static per building — never changes at runtime (unlike day/night state) — so atlas selection is **baked directly into UV coordinates** at geometry-build time in `buildTileGeometry.ts`, not carried as a new runtime vertex attribute.

Mechanics:
- Pack the 5 kind textures into one atlas image, laid out side by side (5 equal-width columns).
- After `ExtrudeGeometry` is built for each building, generate real UVs (currently deleted — `geom.deleteAttribute('uv')` — this line is removed): wall faces get world-scale mapping (U = cumulative distance along the wall in meters, V = height in meters, divided by a texture-repeat-in-meters constant) so tall buildings don't stretch the brick pattern; roof/cap faces get footprint-plane UVs (U=x, V=z, same divisor). Wall vs. roof is determined the same way `aWindow`'s wall flag already is (`Math.abs(normal.y) < 0.5`).
- Shift every UV by the building's kind-slot: `u = u / 5 + (kind / 5)`.
- Material becomes `MeshStandardMaterial` (PBR — required to respond correctly to real shadows, see Section 4) with `map`/`roughnessMap` pointing at the atlas. `vertexColors` stays enabled — three.js multiplies texture sample × vertex color, so the existing per-building jitter tint keeps providing variation on top of only 5 unique textures, without needing more unique textures.
- The night-window `onBeforeCompile` hook (`cityMaterial.ts`) carries over; its injection points (`#include <common>`, `#include <begin_vertex>`, `#include <dithering_fragment>`) exist in `MeshStandardMaterial`'s shader chunks too, but need verification during implementation since Standard's shader graph differs from Lambert's beyond those chunk names.

LOD1 (the far/box tier, beyond 1500m) is unaffected — stays flat vertex-color `MeshLambertMaterial`, no texture, no atlas. Matches the existing distance-based effort split (LOD1 already drops per-building silhouette detail for a plain AABB box).

### 3. Landmark materials (9 components)

All 9 landmark components already share one `MAT` module (`src/scene/landmarks/materials.ts`) with named materials (`MAT.gold`, `MAT.glass`, `MAT.laterite`, etc.). Each becomes `MeshStandardMaterial({ map, roughnessMap, roughness, metalness })` pointing at a real texture — one texture load per named material, reused across every landmark that references it (e.g. Royal Palace roof and NagaWorld roof both use `MAT.gold` — one texture, no duplication).

Rough texture-to-material mapping:
- `MAT.gold` / `MAT.goldDark` → gold roof tile (Royal Palace, Wat Phnom, NagaWorld)
- `MAT.laterite` → laterite stone (Independence Monument)
- `MAT.glass` / `MAT.glassDark` → glass curtain-wall (Vattanac, The Peak, Morgan Enmaison, NagaWorld towers)
- `MAT.white` / `MAT.cream` → stucco/plaster (palace walls, vihara)
- `MAT.concrete` → concrete (podiums, bridge deck, Naga3 construction)
- `MAT.pavement` → paving stone (plazas, monument base)
- `MAT.treeGreen` / `MAT.green` → **stays flat color** — foliage textures don't read meaningfully on the low-poly spheres/cones used for trees and the Wat Phnom hill at this scale; not worth the asset.

Geometry note: primitive shapes (Box/Cylinder/Cone/Lathe geometries, used by most landmark parts) already ship usable default UVs from three.js — no work needed. The exception is `src/lib/loft.ts` (the custom cross-section-loft geometry used for the Vattanac/Morgan/Peak tower shapes) — it currently builds only `position` + `normal` attributes, no UVs. Needs the same world-scale UV generation approach as mass-building walls (V = cumulative height / divisor, U = position around the profile perimeter / divisor) — shared logic, not new design.

Night-mode emissive glow (`Lighting.tsx`, the `GLOWING` array lerping `material.emissive`/`emissiveIntensity`) is unchanged — `MeshStandardMaterial` supports `emissive` the same way `MeshLambertMaterial` did.

### 4. Shadows

Enabled via R3F's `<Canvas shadows>` (PCFSoft shadow map type). The sun (`directionalLight` in `Lighting.tsx`) gets `castShadow`.

The shadow camera's orthographic frustum cannot cover the full 8km bbox — spread that thin, shadow resolution would be too blocky to read as a shadow. Instead: a tight frustum (~300-500m box) that **follows the camera's look-at target**, repositioned every frame by tracking `CameraControls`' current target — the same technique open-world games use to snap a limited shadow frustum to the player instead of the whole world.

Cast/receive assignment:
- Near-camera detail tiles (LOD0, <1500m): cast + receive.
- Far tiles (LOD1, boxes, >1500m): neither — consistent with the existing "don't spend budget on distant tiles" pattern already established in Phase 4/5 of the base build.
- Landmarks: cast + receive, always (small count, cheap, and they're the visual focal points regardless of camera distance).
- Ground: receive only (doesn't cast).
- Water: excluded entirely from the shadow system — it's deliberately unlit (`MeshBasicMaterial`) to avoid visible z-fighting between overlapping OSM water polygons (see `Ground.tsx` comment); shadows on unlit flat water without proper reflection setup wouldn't read as intended, and fixing that is out of scope (see Non-Goals: real-time water reflection).

Day/night interaction needs no special-casing: the sun's intensity already lerps toward near-zero at night in the existing `Lighting.tsx` crossfade, so shadows naturally fade to faint/near-absent under moonlight rather than needing an explicit on/off switch.

**Risk, stated plainly:** shadow maps are one of the more expensive real-time GPU features. This scopes the cost down (limited frustum, limited casters) but frustum size and shadow map resolution will very likely need tuning against actual measured frame rate once built — not assumed correct on the first pass. Use the same profiling approach as the base build's Phase 5 (`gl.info.render`, FPS sampling via the existing scratchpad screenshot/perf tooling).

### 5. Ground, roads, water

**Ground:** swap the flat-color `groundMaterial` for a tileable realistic ground texture (dirt/pavement-style), using `THREE.RepeatWrapping` with a repeat count sized so individual tiles read at roughly 20-30m each across the 14km ground plane (avoids the "one stretched image" look).

**Roads:** the weakest-looking part of the current scene — thin unlit `LineSegments`, no width, no material. Upgrading to real ribbon geometry: triangulated quad strips extruded along each polyline in `Ground.tsx`, replacing the current `THREE.BufferGeometry` + `lineSegments` approach. This finally makes use of `roads.json`'s `c` field (major/minor flag, present since Phase 1 but never consumed by the renderer) — major roads render wider and with a distinct texture tint from minor roads, instead of every street looking identical. Roads get a `MeshStandardMaterial` with an asphalt texture and `receiveShadow` (they're part of the ground plane conceptually).

**Water:** stays unlit (`MeshBasicMaterial`) — the z-fighting-avoidance reason doesn't go away. Swaps flat color for a tileable water texture for a modest, contained visual improvement. Full real-time reflection/refraction would look meaningfully better but is a separate, much larger feature — explicitly not built here (see Non-Goals).

## Data flow / files touched

- `public/textures/*` — new committed texture assets (atlas + landmark + ground/road/water textures)
- `src/lib/buildTileGeometry.ts` — UV generation (wall/roof world-scale mapping + atlas offset baking) added to `extrudeBuilding()`; `boxBuilding()` (LOD1) unchanged
- `src/scene/cityMaterial.ts` — `MeshLambertMaterial` → `MeshStandardMaterial`, atlas texture wired in, `onBeforeCompile` hook re-verified against Standard's shader chunks
- `src/lib/loft.ts` — UV generation added to `loftGeometry()`
- `src/scene/landmarks/materials.ts` — each `MAT.*` entry becomes a textured `MeshStandardMaterial`
- `src/scene/Lighting.tsx` — shadow-casting sun config, per-frame shadow-frustum-follows-camera logic
- `src/scene/Ground.tsx` / `src/scene/groundMaterials.ts` — ground texture, road ribbon geometry + major/minor texturing, water texture
- `src/App.tsx` / `src/scene/CityScene.tsx` — `<Canvas shadows>`, `castShadow`/`receiveShadow` props wired onto the relevant meshes

## Verification

- Visual: screenshot comparison (reusing the existing scratchpad puppeteer screenshot tooling) at the same camera poses used during the base build's Phase 2/3/4 verification, before/after this spec's changes — overview, street-level, landmark close-ups, night mode.
- Perf: `gl.info.render` draw-call/triangle counts and FPS sampling (reusing the Phase 5 `perf.mjs` script) at overview/street-level/night, checked against the base build's existing 45-60fps mid-range-GPU target — shadow map cost is the main risk to that budget (see Section 4 risk note).
- Load time: total texture asset weight checked against the 3-6MB budget stated in Section 1; cold-load-to-interactive timing re-measured the same way as the base build's Phase 5 verification.
- Data correctness: none of this touches `scripts/build-data.mjs` or the committed JSON in `public/data/` — no data pipeline re-verification needed, only rendering-layer changes.
