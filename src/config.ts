// [minLng, minLat, maxLng, maxLat] — central Phnom Penh core.
// Growing this later is safe: ORIGIN below is the projection anchor and never moves.
export const BBOX: [number, number, number, number] = [104.88, 11.52, 104.95, 11.6];

// Projection origin — permanent, decoupled from BBOX. Never change, even when bbox grows.
export const ORIGIN = { lng: 104.915, lat: 11.56 };

export const TILE_SIZE = 500; // meters
export const LEVEL_HEIGHT = 3.2; // meters per building level
export const DEFAULT_LEVELS = 2; // when OSM has no height/levels data
