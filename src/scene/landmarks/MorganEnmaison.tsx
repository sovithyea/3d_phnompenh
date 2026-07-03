import { useMemo } from 'react';
import * as THREE from 'three';
import { loftGeometry, roundedRectProfile } from '../../lib/loft';
import { MAT } from './materials';

// Morgan Enmaison, Chroy Changvar riverfront — Enmaison 2 (244m, tallest
// building in Cambodia as of 2026) + Enmaison 1 (216m) + a mid-rise.
function setbackTower(w: number, d: number, h: number): THREE.BufferGeometry {
  return loftGeometry(roundedRectProfile(w, d, 4), [
    { y: 0, sx: 1, sz: 1 },
    { y: h * 0.72, sx: 1, sz: 1 },
    { y: h * 0.73, sx: 0.88, sz: 0.92 },
    { y: h * 0.9, sx: 0.88, sz: 0.92 },
    { y: h * 0.91, sx: 0.74, sz: 0.84 },
    { y: h, sx: 0.6, sz: 0.76 },
  ]);
}

export default function MorganEnmaison() {
  const t244 = useMemo(() => setbackTower(40, 30, 244), []);
  const t216 = useMemo(() => setbackTower(38, 28, 216), []);

  return (
    <group>
      <mesh position={[0, 8, 0]} material={MAT.concrete}>
        <boxGeometry args={[150, 16, 60]} />
      </mesh>
      <mesh geometry={t244} material={MAT.glass} />
      <mesh geometry={t216} position={[56, 0, 4]} material={MAT.glassDark} />
      {/* Enmaison 7 mid-rise */}
      <mesh position={[-52, 26, 2]} material={MAT.glassDark}>
        <boxGeometry args={[34, 52, 26]} />
      </mesh>
    </group>
  );
}
