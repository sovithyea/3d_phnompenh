// Landmark suppression zones + anchors.
// Zones: lng/lat bbox [minLng, minLat, maxLng, maxLat] — any OSM building whose
// centroid falls inside is DROPPED from buildings.json (the hand-modeled landmark
// replaces it). Zones are geographic, not OSM-id-based, so they survive OSM churn.
// build-data.mjs logs the drop count per zone — sanity-check after every run.
//
// Anchors: lng/lat point where the parametric landmark component is placed.
// Filled during Phase 3; empty zones = nothing suppressed yet.

export const LANDMARKS = [
  // { id: 'vattanac', zone: [lng0, lat0, lng1, lat1], anchor: { lng, lat }, rotation: 0 },
];
