import { useMemo } from 'react';
import * as THREE from 'three';
import { loftGeometry, roundedRectProfile } from '../../lib/loft';
import { MAT } from './materials';

// The Peak / Shangri-La complex: 236m hotel tower + twin 205m residence
// towers on a shared podium (real spacing ~70m north-south).
function tower(w: number, d: number, h: number): THREE.BufferGeometry {
  return loftGeometry(roundedRectProfile(w, d, 6), [
    { y: 0, sx: 1, sz: 1 },
    { y: h * 0.92, sx: 1, sz: 1 },
    { y: h * 0.96, sx: 0.85, sz: 0.85 },
    { y: h, sx: 0.7, sz: 0.7 },
  ]);
}

export default function ThePeak() {
  const hotel = useMemo(() => tower(42, 42, 236), []);
  const twin = useMemo(() => tower(34, 34, 205), []);

  return (
    <group>
      <mesh position={[0, 12.5, -20]} material={MAT.concrete}>
        <boxGeometry args={[90, 25, 190]} />
      </mesh>
      <mesh geometry={hotel} position={[0, 0, 70]} material={MAT.glassDark} />
      <mesh geometry={twin} position={[0, 0, -1]} material={MAT.glass} />
      <mesh geometry={twin} position={[0, 0, -69]} material={MAT.glass} />
    </group>
  );
}
