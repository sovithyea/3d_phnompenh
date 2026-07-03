import * as THREE from 'three';

// Build a THREE.Shape from rings in local meters.
// Shape space is XY; we map (x, z) → (x, -z) so that after the standard
// rotateX(-PI/2) the geometry lands correctly in world XZ (north = -z).
export function ringsToShape(rings: number[][]): THREE.Shape {
  const shape = new THREE.Shape();
  addRing(shape, rings[0]);
  for (let i = 1; i < rings.length; i++) {
    const hole = new THREE.Path();
    addRing(hole, rings[i]);
    shape.holes.push(hole);
  }
  return shape;
}

function addRing(path: THREE.Path, flat: number[]) {
  path.moveTo(flat[0], -flat[1]);
  for (let i = 2; i < flat.length; i += 2) {
    path.lineTo(flat[i], -flat[i + 1]);
  }
  path.closePath();
}
