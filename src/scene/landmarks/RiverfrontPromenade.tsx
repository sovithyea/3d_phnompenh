import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeoms } from '../../lib/loft';
import { lngLatToLocal } from '../../lib/projection';
import { MAT } from './materials';

// Sisowath Quay / Chaktomuk riverfront promenade — pavement strip along the
// Tonle Sap west bank with flag poles and trees. Absolute coordinates.
const BANK: [number, number][] = [
  [104.93168, 11.5766],
  [104.93208, 11.5728],
  [104.9325, 11.569],
  [104.9326, 11.5655],
  [104.9318, 11.5615],
];
const STRIP_W = 28;

export default function RiverfrontPromenade() {
  const { strips, poles, trees } = useMemo(() => {
    const pts = BANK.map(([lng, lat]) => lngLatToLocal(lng, lat));
    const strips: { pos: [number, number, number]; rotY: number; len: number }[] = [];
    const poleGeoms: THREE.BufferGeometry[] = [];
    const treeGeoms: THREE.BufferGeometry[] = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[i + 1];
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const ux = dx / len, uz = dz / len;
      const px = -uz, pz = ux; // perpendicular (land side, west of south-running bank)
      strips.push({
        pos: [(x0 + x1) / 2, 0.5, (z0 + z1) / 2],
        rotY: Math.atan2(-uz, ux),
        len,
      });
      // flag poles on river edge, trees on land edge
      for (let s = 25; s < len; s += 50) {
        const x = x0 + ux * s, z = z0 + uz * s;
        poleGeoms.push(
          new THREE.CylinderGeometry(0.18, 0.18, 9, 6).translate(x - px * 11, 4.5, z - pz * 11),
        );
        treeGeoms.push(
          new THREE.SphereGeometry(3.4, 8, 6).translate(x + px * 11, 4.6, z + pz * 11),
          new THREE.CylinderGeometry(0.35, 0.45, 3.2, 6).translate(x + px * 11, 1.6, z + pz * 11),
        );
      }
    }
    return {
      strips,
      poles: mergeGeoms(poleGeoms),
      trees: mergeGeoms(treeGeoms),
    };
  }, []);

  return (
    <group>
      {strips.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-y={s.rotY} material={MAT.pavement}>
          <boxGeometry args={[s.len + 2, 1, STRIP_W]} />
        </mesh>
      ))}
      <mesh geometry={poles} material={MAT.white} />
      <mesh geometry={trees} material={MAT.treeGreen} />
    </group>
  );
}
