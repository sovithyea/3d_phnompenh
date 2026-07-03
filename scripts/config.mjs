// Mirrors src/config.ts — scripts are plain Node, app is TS, so constants live twice.
// If you change BBOX here, change it there too. ORIGIN must NEVER change (see src/config.ts).

export const BBOX = [104.88, 11.52, 104.95, 11.6]; // minLng, minLat, maxLng, maxLat
export const ORIGIN = { lng: 104.915, lat: 11.56 };
export const LEVEL_HEIGHT = 3.2;
export const DEFAULT_LEVELS = 2;

const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

// lng/lat → local meters, Three.js convention: +x east, +z south (north = -z), y up.
// Simple equirectangular around ORIGIN: error < 0.1% over this extent.
export function project(lng, lat) {
  const x = (lng - ORIGIN.lng) * M_PER_DEG_LNG;
  const z = -(lat - ORIGIN.lat) * M_PER_DEG_LAT;
  return [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
}
