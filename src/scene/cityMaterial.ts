import * as THREE from 'three';

// Single shared material for all city tiles — one shader program, vertex
// colors carry per-building variation. The night-window emissive pass
// (onBeforeCompile, driven by uNight + aWindow attribute) lands in Phase 4.
export const nightUniform = { value: 0 };

export function createCityMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}
