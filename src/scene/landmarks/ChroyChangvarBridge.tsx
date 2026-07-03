import { useMemo } from 'react';
import { lngLatToLocal } from '../../lib/projection';
import { MAT } from './materials';

// Chroy Changvar (Cambodia–Japan Friendship) Bridge over the Tonle Sap —
// girder bridge: gently arched deck on pier pairs, no pylons or cables.
// Endpoints from OSM way/91370410; the parallel 2015 twin span is offset.
const A: [number, number] = [104.91848, 11.586];
const B: [number, number] = [104.92476, 11.58839];
const SEGMENTS = 12;
const DECK_W = 13;
const RISE = 11; // deck height at midspan
const ENDS = 4; // deck height at banks

// This component uses absolute city coordinates (registry places it at origin).
export default function ChroyChangvarBridge() {
  const spans = useMemo(() => {
    const [ax, az] = lngLatToLocal(A[0], A[1]);
    const [bx, bz] = lngLatToLocal(B[0], B[1]);
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const px = -uz, pz = ux; // perpendicular for the twin span

    const heightAt = (t: number) => ENDS + (RISE - ENDS) * Math.sin(Math.PI * t);

    const decks: { pos: [number, number, number]; rotY: number; pitch: number; len: number }[] = [];
    const piers: [number, number, number][] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const t0 = i / SEGMENTS, t1 = (i + 1) / SEGMENTS;
      const x0 = ax + dx * t0, z0 = az + dz * t0, y0 = heightAt(t0);
      const x1 = ax + dx * t1, z1 = az + dz * t1, y1 = heightAt(t1);
      const segLen = Math.hypot(len / SEGMENTS, y1 - y0);
      decks.push({
        pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
        rotY: Math.atan2(-uz, ux),
        pitch: Math.atan2(y1 - y0, len / SEGMENTS),
        len: segLen,
      });
      if (i > 0) piers.push([x0, y0 / 2, z0]);
    }
    return { decks, piers, perp: [px, pz] as [number, number] };
  }, []);

  const offsets: [number, number][] = [
    [0, 0],
    [spans.perp[0] * 20, spans.perp[1] * 20], // twin 2015 span
  ];

  return (
    <group>
      {offsets.map(([ox, oz], k) => (
        <group key={k} position={[ox, 0, oz]}>
          {spans.decks.map((d, i) => (
            <group key={i} position={d.pos} rotation-y={d.rotY} rotation-z={d.pitch}>
              <mesh material={MAT.concrete}>
                <boxGeometry args={[d.len + 0.5, 2.2, DECK_W]} />
              </mesh>
              <mesh position={[0, 1.6, DECK_W / 2 - 0.4]} material={MAT.steel}>
                <boxGeometry args={[d.len + 0.5, 1.2, 0.4]} />
              </mesh>
              <mesh position={[0, 1.6, -DECK_W / 2 + 0.4]} material={MAT.steel}>
                <boxGeometry args={[d.len + 0.5, 1.2, 0.4]} />
              </mesh>
            </group>
          ))}
          {spans.piers.map(([x, y, z], i) => (
            <group key={`p${i}`} position={[x, y, z]}>
              <mesh position={[0, 0, -DECK_W / 3]} material={MAT.concrete}>
                <cylinderGeometry args={[1.6, 1.8, y * 2 + 2, 10]} />
              </mesh>
              <mesh position={[0, 0, DECK_W / 3]} material={MAT.concrete}>
                <cylinderGeometry args={[1.6, 1.8, y * 2 + 2, 10]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
