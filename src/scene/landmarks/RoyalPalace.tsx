import { useMemo } from 'react';
import * as THREE from 'three';
import { pitchedRoofBox, mergeGeoms } from '../../lib/loft';
import { MAT } from './materials';

// Royal Palace complex — white perimeter wall, gold multi-tier roofed halls,
// Throne Hall spire (~59m). Stylized compound, not a survey model.

// Khmer hall: stacked shrinking pitched roofs over a white box.
function hallGeometry(w: number, d: number, wallH: number): { walls: THREE.BufferGeometry; roof: THREE.BufferGeometry } {
  const walls = new THREE.BoxGeometry(w, wallH, d);
  walls.translate(0, wallH / 2, 0);
  const tiers: THREE.BufferGeometry[] = [];
  let tw = w, td = d, base = wallH;
  for (let i = 0; i < 3; i++) {
    const roofH = td * 0.28;
    const tier = pitchedRoofBox(tw, td, 0.01, roofH, 2);
    tier.translate(0, base, 0);
    tiers.push(tier);
    base += roofH * 0.55;
    tw *= 0.78;
    td *= 0.7;
  }
  return { walls, roof: mergeGeoms(tiers) };
}

function spireGeometry(totalH: number): THREE.BufferGeometry {
  // stacked shrinking cones — Khmer prasat spire
  const pts: THREE.Vector2[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(5.5 * Math.pow(1 - t, 1.4) + 0.1, t * totalH));
  }
  return new THREE.LatheGeometry(pts, 12);
}

function Hall({
  position,
  size,
  rotation = 0,
}: {
  position: [number, number, number];
  size: [number, number, number]; // w, d, wallH
  rotation?: number;
}) {
  const { walls, roof } = useMemo(() => hallGeometry(size[0], size[1], size[2]), [size]);
  return (
    <group position={position} rotation-y={rotation}>
      <mesh geometry={walls} material={MAT.white} />
      <mesh geometry={roof} material={MAT.gold} />
    </group>
  );
}

export default function RoyalPalace() {
  const spire = useMemo(() => spireGeometry(30), []);
  const wallGeom = useMemo(() => {
    // perimeter wall ring ~ 380 x 280 m
    const w = 380, d = 280, t = 2, h = 4.5;
    const parts = [
      new THREE.BoxGeometry(w, h, t).translate(0, h / 2, -d / 2),
      new THREE.BoxGeometry(w, h, t).translate(0, h / 2, d / 2),
      new THREE.BoxGeometry(t, h, d).translate(-w / 2, h / 2, 0),
      new THREE.BoxGeometry(t, h, d).translate(w / 2, h / 2, 0),
    ];
    return mergeGeoms(parts);
  }, []);

  return (
    <group>
      <mesh geometry={wallGeom} material={MAT.white} />
      {/* grounds */}
      <mesh position={[0, 0.3, 0]} material={MAT.cream}>
        <boxGeometry args={[378, 0.6, 278]} />
      </mesh>
      {/* Throne Hall — center, spire on top */}
      <Hall position={[0, 0, -30]} size={[64, 30, 12]} />
      <mesh geometry={spire} position={[0, 26, -30]} material={MAT.gold} />
      {/* Silver Pagoda compound (south) */}
      <Hall position={[-60, 0, 95]} size={[44, 22, 10]} />
      {/* Chanchhaya Pavilion (east, riverfront side) */}
      <Hall position={[130, 0, -40]} size={[34, 18, 8]} />
      {/* Khemarin Palace (north) */}
      <Hall position={[80, 0, -100]} size={[38, 20, 9]} />
    </group>
  );
}
