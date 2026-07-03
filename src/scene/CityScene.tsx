import { useEffect, useState } from 'react';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { loadCityData, type CityData } from '../lib/loadCityData';
import Ground from './Ground';
import CityTiles from './CityTiles';

export default function CityScene() {
  const [data, setData] = useState<CityData | null>(null);

  useEffect(() => {
    loadCityData().then(setData).catch(console.error);
  }, []);

  return (
    <>
      <color attach="background" args={['#cfe0ee']} />
      <hemisphereLight args={['#bfd9ff', '#c8b89a', 0.9]} />
      <directionalLight position={[2000, 4000, 1200]} intensity={1.6} color="#fff5e8" />

      {data && (
        <>
          <Ground data={data} />
          <CityTiles data={data} />
        </>
      )}

      <CameraControls
        minDistance={50}
        maxDistance={8000}
        maxPolarAngle={Math.PI * 0.47}
        makeDefault
        ref={(controls) => {
          // debug/scripting handle (e.g. headless verification shots)
          (window as unknown as { __controls?: unknown }).__controls = controls;
          controls?.setBoundary(
            new THREE.Box3(
              new THREE.Vector3(-6000, 0, -6000),
              new THREE.Vector3(6000, 3000, 6000),
            ),
          );
        }}
      />
    </>
  );
}
