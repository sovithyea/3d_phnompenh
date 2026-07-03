import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeoms } from '../../lib/loft';
import { MAT } from './materials';

// Independence Monument — ~37m lotus tower of shrinking octagonal tiers
// ringed with naga finials, dark laterite. Sits on its roundabout.
export default function IndependenceMonument() {
  const monument = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(new THREE.CylinderGeometry(17, 18, 4, 8).translate(0, 2, 0));
    let y = 4;
    let r = 12.5;
    const tierHs = [6, 5.5, 5, 4.5, 4];
    for (const h of tierHs) {
      parts.push(new THREE.CylinderGeometry(r * 0.82, r, h, 8).translate(0, y + h / 2, 0));
      // naga finial ring on the tier shoulder
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        parts.push(
          new THREE.ConeGeometry(0.8, 3.2, 6).translate(r * 0.95 * Math.cos(a), y + 1.6, r * 0.95 * Math.sin(a)),
        );
      }
      y += h;
      r *= 0.72;
    }
    parts.push(new THREE.ConeGeometry(r, 8, 8).translate(0, y + 4, 0)); // crowning bud
    return mergeGeoms(parts);
  }, []);

  return (
    <group>
      <mesh position={[0, 0.4, 0]} material={MAT.pavement}>
        <cylinderGeometry args={[42, 42, 0.8, 32]} />
      </mesh>
      <mesh geometry={monument} material={MAT.laterite} />
    </group>
  );
}
