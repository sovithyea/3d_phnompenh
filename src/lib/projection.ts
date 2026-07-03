import { ORIGIN } from '../config';

const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

// lng/lat → local meters. +x east, +z south (north = -z), y up.
// Must match scripts/config.mjs project() exactly (minus rounding).
export function lngLatToLocal(lng: number, lat: number): [number, number] {
  return [(lng - ORIGIN.lng) * M_PER_DEG_LNG, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
}

export function localToLngLat(x: number, z: number): [number, number] {
  return [ORIGIN.lng + x / M_PER_DEG_LNG, ORIGIN.lat - z / M_PER_DEG_LAT];
}
