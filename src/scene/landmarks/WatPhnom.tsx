import { useMemo } from 'react';
import * as THREE from 'three';
import { pitchedRoofBox, mergeGeoms } from '../../lib/loft';
import { MAT } from './materials';

// Wat Phnom — the 27m hill Phnom Penh is named for, vihara + white stupa on top.
export default function WatPhnom() {
  const stupa = useMemo(() => {
    const pts = [
      [0, 0], [9, 0], [8.2, 3], [5.5, 6], [4.5, 9], [3, 13],
      [1.6, 20], [0.7, 27], [0.15, 33], [0, 34],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 16);
  }, []);

  const vihara = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [
      new THREE.BoxGeometry(26, 8, 13).translate(0, 4, 0),
    ];
    let tw = 26, td = 13, base = 8;
    for (let i = 0; i < 2; i++) {
      const rh = td * 0.32;
      parts.push(pitchedRoofBox(tw, td, 0.01, rh, 1.5).translate(0, base, 0));
      base += rh * 0.6;
      tw *= 0.8;
      td *= 0.72;
    }
    return mergeGeoms(parts);
  }, []);

  return (
    <group>
      {/* the hill (cone is center-origin — lift half its height) */}
      <mesh position={[0, 13.5, 0]} material={MAT.green}>
        <coneGeometry args={[50, 27, 28]} />
      </mesh>
      <group position={[0, 27, 0]}>
        <mesh geometry={vihara} position={[6, 0, 0]} material={MAT.cream} />
        <mesh geometry={stupa} position={[-18, 0, 0]} material={MAT.white} />
      </group>
    </group>
  );
}
