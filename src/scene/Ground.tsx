import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData } from '../lib/loadCityData';
import { ringsToShape } from '../lib/shapes';

const GROUND_SIZE = 14000;

export default function Ground({ data }: { data: CityData }) {
  const waterGeometry = useMemo(() => {
    const geoms = data.water.map((rings) => new THREE.ShapeGeometry(ringsToShape(rings)));
    const merged = mergeGeometries(geoms, false);
    merged.rotateX(-Math.PI / 2);
    geoms.forEach((g) => g.dispose());
    return merged;
  }, [data]);

  const roadGeometry = useMemo(() => {
    // one LineSegments geometry for all roads: consecutive point pairs
    const positions: number[] = [];
    for (const { p } of data.roads) {
      for (let i = 0; i + 3 < p.length; i += 2) {
        positions.push(p[i], 0, p[i + 1], p[i + 2], 0, p[i + 3]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [data]);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshLambertMaterial color="#c8c0ae" />
      </mesh>
      <mesh geometry={waterGeometry} position-y={-0.2}>
        <meshLambertMaterial color="#4a6f8a" />
      </mesh>
      <lineSegments geometry={roadGeometry} position-y={0.1}>
        <lineBasicMaterial color="#8a8478" />
      </lineSegments>
    </>
  );
}
