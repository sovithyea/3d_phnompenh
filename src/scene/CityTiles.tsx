import { useMemo } from 'react';
import { Detailed } from '@react-three/drei';
import type { CityData } from '../lib/loadCityData';
import { buildCityTiles } from '../lib/buildTileGeometry';
import { createCityMaterial } from './cityMaterial';

const LOD_SWITCH = 1500; // meters camera→tile distance for detail→low swap

export default function CityTiles({ data }: { data: CityData }) {
  const tiles = useMemo(() => buildCityTiles(data.buildings), [data]);
  const material = useMemo(createCityMaterial, []);

  return (
    <>
      {tiles.map((t) => (
        <Detailed key={t.key} distances={[0, LOD_SWITCH]} position={[t.center[0], 0, t.center[1]]}>
          <mesh geometry={t.detail} material={material} />
          <mesh geometry={t.low} material={material} />
        </Detailed>
      ))}
    </>
  );
}
