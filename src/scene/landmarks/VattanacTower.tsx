import { useMemo } from 'react';
import { loftGeometry, roundedRectProfile } from '../../lib/loft';
import { MAT } from './materials';

// Vattanac Capital, 187m — the "naga-back" sail: rounded-rect loft that
// leans and tapers into a curved crest. OSM has no height for it, hence
// the suppression zone + this model.
export default function VattanacTower() {
  const tower = useMemo(() => {
    const profile = roundedRectProfile(56, 34, 9);
    return loftGeometry(profile, [
      { y: 0, sx: 1, sz: 1 },
      { y: 50, sx: 1.03, sz: 1, ox: 1 },
      { y: 100, sx: 1.0, sz: 0.97, ox: 4 },
      { y: 135, sx: 0.93, sz: 0.93, ox: 9 },
      { y: 160, sx: 0.82, sz: 0.88, ox: 15 },
      { y: 176, sx: 0.66, sz: 0.82, ox: 21 },
      { y: 184, sx: 0.45, sz: 0.74, ox: 26 },
      { y: 187, sx: 0.28, sz: 0.66, ox: 29 },
    ]);
  }, []);

  return (
    <group>
      <mesh geometry={tower} material={MAT.glass} />
      {/* podium */}
      <mesh position={[-15, 9, 0]} material={MAT.concrete}>
        <boxGeometry args={[95, 18, 55]} />
      </mesh>
    </group>
  );
}
