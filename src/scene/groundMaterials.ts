import * as THREE from 'three';

// Module singletons so Lighting can crossfade them with nightT.
// Water is unlit (see Ground.tsx: coplanar OSM water polys), so it must be
// dimmed manually at night.
export const WATER_DAY = new THREE.Color('#4a6f8a');
export const WATER_NIGHT = new THREE.Color('#132433');
export const ROAD_DAY = new THREE.Color('#8a8478');
export const ROAD_NIGHT = new THREE.Color('#3a4048');
export const GROUND_DAY = new THREE.Color('#c8c0ae');
export const GROUND_NIGHT = new THREE.Color('#23262c');

export const waterMaterial = new THREE.MeshBasicMaterial({ color: WATER_DAY.clone() });
export const roadMaterial = new THREE.LineBasicMaterial({ color: ROAD_DAY.clone() });
export const groundMaterial = new THREE.MeshLambertMaterial({ color: GROUND_DAY.clone() });
