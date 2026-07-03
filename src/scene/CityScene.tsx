import { useEffect, useRef, useState } from 'react';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { loadCityData, type CityData } from '../lib/loadCityData';
import { lngLatToLocal } from '../lib/projection';
import { useAppStore } from '../state/useAppStore';
import Ground from './Ground';
import CityTiles from './CityTiles';
import Landmarks from './landmarks';
import { LANDMARK_DEFS } from './landmarks';
import Lighting from './Lighting';

export default function CityScene() {
  const [data, setData] = useState<CityData | null>(null);
  const controls = useRef<CameraControlsImpl | null>(null);
  const selected = useAppStore((s) => s.selectedLandmark);

  useEffect(() => {
    loadCityData().then(setData).catch(console.error);
  }, []);

  // fly to the selected landmark
  useEffect(() => {
    const def = LANDMARK_DEFS.find((l) => l.id === selected);
    if (!def || !controls.current) return;
    const [x, z] = lngLatToLocal(def.anchor.lng, def.anchor.lat);
    const [ox, oy, oz] = def.cameraOffset;
    controls.current.setLookAt(x + ox, oy, z + oz, x, def.lookHeight, z, true);
  }, [selected]);

  return (
    <>
      <Lighting />

      {data && (
        <>
          <Ground data={data} />
          <CityTiles data={data} />
          <Landmarks />
        </>
      )}

      <CameraControls
        minDistance={50}
        maxDistance={8000}
        maxPolarAngle={Math.PI * 0.47}
        makeDefault
        ref={(c) => {
          controls.current = c;
          // debug/scripting handle (e.g. headless verification shots)
          (window as unknown as { __controls?: unknown }).__controls = c;
          c?.setBoundary(
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
