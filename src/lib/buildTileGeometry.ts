import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildingRec } from './loadCityData';
import { ringsToShape } from './shapes';
import { tileIndex, tileKey, tileCenter, centroidOf } from './tiles';

// kind → base color (0 generic, 1 residential, 2 commercial, 3 tower, 4 religious)
const PALETTE: [number, number, number][] = [
  [184, 176, 160], // generic — warm concrete
  [199, 178, 153], // residential — tan
  [168, 176, 184], // commercial — cool gray
  [138, 168, 198], // tower — glass blue
  [214, 178, 112], // religious — gold
];

// Default building height is 6.4m — a nonzero cutoff here would erase most of
// the city at distance. Boxes are cheap; keep everything.
const LOW_LOD_MIN_HEIGHT = 0;

export type CityTile = {
  key: string;
  center: [number, number];
  detail: THREE.BufferGeometry;
  low: THREE.BufferGeometry;
};

// Paint per-vertex color + aWindow (seed, wall flag) attributes.
// Call AFTER the geometry is in world orientation (y = up): walls are
// vertices whose normal is near-horizontal.
function paintAttributes(geom: THREE.BufferGeometry, kind: number, seed: number) {
  const count = geom.getAttribute('position').count;
  const normal = geom.getAttribute('normal');
  const color = new Uint8Array(count * 3);
  const win = new Uint8Array(count * 2);
  const jitter = 0.88 + ((seed * 37) % 64) / 256; // deterministic 0.88–1.13
  const [r, g, b] = PALETTE[kind];
  const cr = Math.min(255, r * jitter);
  const cg = Math.min(255, g * jitter);
  const cb = Math.min(255, b * jitter);
  const s = (seed * 131) % 256;
  for (let i = 0; i < count; i++) {
    color[i * 3] = cr;
    color[i * 3 + 1] = cg;
    color[i * 3 + 2] = cb;
    win[i * 2] = s;
    win[i * 2 + 1] = Math.abs(normal.getY(i)) < 0.5 ? 255 : 0;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(color, 3, true));
  geom.setAttribute('aWindow', new THREE.BufferAttribute(win, 2, true));
}

function extrudeBuilding(b: BuildingRec): THREE.BufferGeometry {
  const geom = new THREE.ExtrudeGeometry(ringsToShape(b.r), {
    depth: b.h,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geom.rotateX(-Math.PI / 2); // shape XY + extrude Z → world XZ + height Y
  // ExtrudeGeometry emits uv/uv1 sized per-shape; drop so tiles merge cleanly
  geom.deleteAttribute('uv');
  return geom;
}

function boxBuilding(b: BuildingRec): THREE.BufferGeometry {
  const outer = b.r[0];
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < outer.length; i += 2) {
    minX = Math.min(minX, outer[i]);
    maxX = Math.max(maxX, outer[i]);
    minZ = Math.min(minZ, outer[i + 1]);
    maxZ = Math.max(maxZ, outer[i + 1]);
  }
  const geom = new THREE.BoxGeometry(maxX - minX, b.h, maxZ - minZ);
  geom.deleteAttribute('uv');
  geom.translate((minX + maxX) / 2, b.h / 2, (minZ + maxZ) / 2);
  return geom;
}

// Group buildings into TILE_SIZE tiles; per tile, merge one detail geometry
// (true footprint extrusions) and one low geometry (AABB boxes, small
// buildings dropped). Geometries are tile-center-relative so drei <Detailed>
// distance switching works per tile.
export function buildCityTiles(buildings: BuildingRec[]): CityTile[] {
  const groups = new Map<string, { ix: number; iz: number; items: [BuildingRec, number][] }>();
  buildings.forEach((b, i) => {
    const [cx, cz] = centroidOf(b.r[0]);
    const [ix, iz] = tileIndex(cx, cz);
    const key = tileKey(ix, iz);
    let g = groups.get(key);
    if (!g) {
      g = { ix, iz, items: [] };
      groups.set(key, g);
    }
    g.items.push([b, i]);
  });

  const tiles: CityTile[] = [];
  for (const [key, { ix, iz, items }] of groups) {
    const [tcx, tcz] = tileCenter(ix, iz);
    const detailParts: THREE.BufferGeometry[] = [];
    const lowParts: THREE.BufferGeometry[] = [];
    for (const [b, seed] of items) {
      const d = extrudeBuilding(b);
      paintAttributes(d, b.k, seed);
      d.translate(-tcx, 0, -tcz);
      detailParts.push(d);
      if (b.h >= LOW_LOD_MIN_HEIGHT) {
        const l = boxBuilding(b);
        paintAttributes(l, b.k, seed);
        l.translate(-tcx, 0, -tcz);
        lowParts.push(l);
      }
    }
    const detail = mergeGeometries(detailParts, false);
    detailParts.forEach((g) => g.dispose());
    let low: THREE.BufferGeometry;
    if (lowParts.length) {
      low = mergeGeometries(lowParts, false);
      lowParts.forEach((g) => g.dispose());
    } else {
      low = new THREE.BufferGeometry(); // tile of only small buildings — nothing far away
    }
    // ExtrudeGeometry/BoxGeometry are indexed by default, so mergeGeometries()
    // produces an indexed result here. THREE.BufferGeometry.setIndex() (called
    // internally with a plain array) auto-promotes to Uint32Array once the
    // index exceeds 65,535 (arrayNeedsUint32 check), so this doesn't silently
    // wrap around on this three.js version — confirmed by reading
    // node_modules/three/src/core/BufferGeometry.js and
    // examples/jsm/utils/BufferGeometryUtils.js. Logged as a heads-up only:
    // a 65k+ vertex tile means Uint32 indices (2x the index memory) and is
    // worth knowing about even though it renders correctly.
    for (const [label, g] of [['detail', detail], ['low', low]] as const) {
      if (g.attributes.position.count > 65536) {
        console.warn(
          `tile ${key} ${label}: ${g.attributes.position.count} vertices (>65536, using 32-bit indices)`,
        );
      }
    }
    detail.computeBoundingSphere();
    low.computeBoundingSphere();
    tiles.push({ key, center: [tcx, tcz], detail, low });
  }
  return tiles;
}
