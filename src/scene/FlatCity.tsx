// Phase 1 debug view: building footprints as flat merged polygons.
// Replaced by extruded CityTiles in Phase 2.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData } from '../lib/loadCityData';
import { ringsToShape } from '../lib/shapes';

export default function FlatCity({ data }: { data: CityData }) {
  const geometry = useMemo(() => {
    const geoms = data.buildings.map((b) => new THREE.ShapeGeometry(ringsToShape(b.r)));
    const merged = mergeGeometries(geoms, false);
    merged.rotateX(-Math.PI / 2);
    geoms.forEach((g) => g.dispose());
    return merged;
  }, [data]);

  return (
    <mesh geometry={geometry} position-y={0.3}>
      <meshLambertMaterial color="#7a7264" />
    </mesh>
  );
}
