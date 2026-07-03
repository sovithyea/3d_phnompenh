import { useMemo } from 'react';
import * as THREE from 'three';
import { lngLatToLocal } from '../../lib/projection';
import { MAT } from './materials';

// NagaWorld complex. Anchored at Naga 1 (casino/hotel); Naga 2 and the
// Naga 3 construction site (on hold, completion ≥2029 — 2026 shows a site,
// not a tower) are placed by their real offsets from the anchor.
const ANCHOR: [number, number] = [104.93723, 11.55563];
const NAGA2: [number, number] = [104.93435, 11.55583];
const NAGA3: [number, number] = [104.93301, 11.55331];

function offsetFrom(anchor: [number, number], p: [number, number]): [number, number] {
  const [ax, az] = lngLatToLocal(anchor[0], anchor[1]);
  const [px, pz] = lngLatToLocal(p[0], p[1]);
  return [px - ax, pz - az];
}

function Crane({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 30, 0]} material={MAT.craneYellow}>
        <boxGeometry args={[2.4, 60, 2.4]} />
      </mesh>
      <mesh position={[14, 58, 0]} material={MAT.craneYellow}>
        <boxGeometry args={[36, 2, 2]} />
      </mesh>
      <mesh position={[-7, 60, 0]} material={MAT.craneYellow}>
        <boxGeometry args={[10, 2.5, 2.5]} />
      </mesh>
    </group>
  );
}

export default function NagaWorld() {
  const [n2x, n2z] = useMemo(() => offsetFrom(ANCHOR, NAGA2), []);
  const [n3x, n3z] = useMemo(() => offsetFrom(ANCHOR, NAGA3), []);
  const barrel = useMemo(() => {
    const g = new THREE.CylinderGeometry(14, 14, 96, 24, 1, false, 0, Math.PI);
    g.rotateZ(Math.PI / 2); // half-cylinder vault, axis along x
    return g;
  }, []);

  return (
    <group>
      {/* Naga 1: gold podium + vaulted hotel slab */}
      <group>
        <mesh position={[0, 10, 0]} material={MAT.gold}>
          <boxGeometry args={[110, 20, 85]} />
        </mesh>
        <mesh position={[0, 35, 0]} material={MAT.cream}>
          <boxGeometry args={[96, 30, 40]} />
        </mesh>
        <mesh geometry={barrel} position={[0, 50, 0]} material={MAT.goldDark} />
      </group>
      {/* Naga 2: taller glass slab + rounded crown */}
      <group position={[n2x, 0, n2z]}>
        <mesh position={[0, 9, 0]} material={MAT.gold}>
          <boxGeometry args={[80, 18, 60]} />
        </mesh>
        <mesh position={[0, 52, 0]} material={MAT.glassDark}>
          <boxGeometry args={[64, 70, 34]} />
        </mesh>
        <mesh position={[0, 87, 0]} rotation-z={Math.PI / 2} material={MAT.gold}>
          <cylinderGeometry args={[17, 17, 64, 20, 1, false, 0, Math.PI]} />
        </mesh>
      </group>
      {/* Naga 3: construction site — pad, core stub, tower cranes */}
      <group position={[n3x, 0, n3z]}>
        <mesh position={[0, 0.5, 0]} material={MAT.concrete}>
          <boxGeometry args={[120, 1, 110]} />
        </mesh>
        <mesh position={[0, 11, 0]} material={MAT.steel}>
          <boxGeometry args={[40, 22, 36]} />
        </mesh>
        <Crane position={[-35, 0, 30]} rotation={0.7} />
        <Crane position={[30, 0, -32]} rotation={-1.8} />
      </group>
    </group>
  );
}
