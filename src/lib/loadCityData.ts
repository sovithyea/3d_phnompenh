// Loads the static assets produced by scripts/build-data.mjs.
// Coordinates are already local meters (see lib/projection.ts) — no runtime projection.

export type BuildingRec = {
  h: number; // height, meters
  k: number; // kind: 0 generic, 1 residential, 2 commercial, 3 tower, 4 religious
  r: number[][]; // rings as flat [x1,z1,x2,z2,...]; first = outer, rest = holes
};

export type RoadRec = { c: number; p: number[] }; // c: 1 major / 0 minor; p flat polyline

export type CityData = {
  buildings: BuildingRec[];
  roads: RoadRec[];
  water: number[][][]; // polygons → rings → flat coords
};

async function fetchJson<T>(name: string): Promise<T> {
  // BASE_URL prefix is required on GitHub Pages (/3d_phnompenh/ base path)
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!res.ok) throw new Error(`failed to load ${name}.json: HTTP ${res.status}`);
  return res.json();
}

let promise: Promise<CityData> | null = null;

export function loadCityData(): Promise<CityData> {
  promise ??= (async () => {
    const [b, r, w] = await Promise.all([
      fetchJson<{ buildings: BuildingRec[] }>('buildings'),
      fetchJson<{ roads: RoadRec[] }>('roads'),
      fetchJson<{ polys: number[][][] }>('water'),
    ]);
    return { buildings: b.buildings, roads: r.roads, water: w.polys };
  })();
  return promise;
}
