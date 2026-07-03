// Landmark suppression zones — lng/lat bboxes [minLng, minLat, maxLng, maxLat].
// Any OSM building whose footprint centroid falls inside is DROPPED from
// buildings.json; the hand-modeled landmark (src/scene/landmarks/) replaces it.
// Geographic zones (not OSM ids) survive OSM churn. build-data.mjs logs the
// drop count per zone — sanity-check after every data:build.
//
// Anchor coordinates verified against OSM 2026-07 (named ways/nodes in cache):
//   Royal Palace       way/1315431760  @ 104.93050,11.56348
//   Wat Phnom Pagoda   way/175005909   @ 104.92321,11.57613
//   Independence Mon.  way/311065501   @ 104.92819,11.55644
//   Vattanac Capital   way/222340979   @ 104.91889,11.57342 (no OSM height!)
//   NagaWorld 1        node/11616129197 @ 104.93723,11.55563
//   NagaWorld 2        node/11616129198 @ 104.93435,11.55583
//   NagaWorld 3 site   way/662330483   @ 104.93301,11.55331 (under construction 2026)
//   The Peak/Shangri-La way/637925504-6 @ 104.9383,11.5524-11.5536 (h=236/204.7/204.7)
//   Morgan Enmaison 1/2 way/1251742652-3 @ 104.9364-104.9369,11.5931 (h=216/244)
//   Chroy Changvar Br. way/91370410    104.91848,11.58600 → 104.92476,11.58839

export const LANDMARKS = [
  { id: 'royal-palace', zone: [104.9288, 11.5608, 104.933, 11.5665] },
  { id: 'wat-phnom', zone: [104.9222, 11.5752, 104.9243, 11.5772] },
  { id: 'independence-monument', zone: [104.9277, 11.556, 104.9287, 11.5569] },
  { id: 'vattanac', zone: [104.9183, 11.5729, 104.9195, 11.574] },
  { id: 'nagaworld-1', zone: [104.936, 11.5548, 104.938, 11.5566] },
  { id: 'nagaworld-2', zone: [104.9337, 11.555, 104.9354, 11.5567] },
  { id: 'naga3-site', zone: [104.9322, 11.5524, 104.934, 11.5542] },
  { id: 'the-peak', zone: [104.9376, 11.5518, 104.939, 11.5542] },
  { id: 'morgan-enmaison', zone: [104.9352, 11.5924, 104.9376, 11.5938] },
  // riverfront promenade has no building footprints to suppress
];

// Roads whose real-world way is replaced by a hand-modeled landmark (the
// Chroy Changvar deck arcs up to 11m — the flat OSM road line at y=0.2
// would otherwise render underneath it as a duplicate, reading as a
// misaligned/phantom road across the water). Zone covers both spans
// (way/91370410, 104.91848,11.58600 -> 104.92476,11.58839) plus the ~20m
// twin-span offset and approach curves.
export const ROAD_SUPPRESS_ZONES = [
  { id: 'chroy-changvar-bridge', zone: [104.9175, 11.585, 104.9255, 11.5895] },
];
