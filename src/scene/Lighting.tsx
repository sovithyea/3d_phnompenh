import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../state/useAppStore';
import { nightUniform } from './cityMaterial';
import { MAT } from './landmarks/materials';
import {
  waterMaterial, roadMaterial, groundMaterial,
  WATER_DAY, WATER_NIGHT, ROAD_DAY, ROAD_NIGHT, GROUND_DAY, GROUND_NIGHT,
} from './groundMaterials';

const DAY = {
  sky: new THREE.Color('#cfe0ee'),
  hemiSky: new THREE.Color('#bfd9ff'),
  hemiGround: new THREE.Color('#c8b89a'),
  sun: new THREE.Color('#fff5e8'),
  hemiIntensity: 0.9,
  sunIntensity: 1.6,
};
const NIGHT = {
  sky: new THREE.Color('#0a1020'),
  hemiSky: new THREE.Color('#1a2438'),
  hemiGround: new THREE.Color('#141210'),
  sun: new THREE.Color('#b8c8e8'), // moon
  hemiIntensity: 0.22,
  sunIntensity: 0.25,
};

// Landmark materials that glow at night (emissive intensity driven by nightT)
const GLOWING: [THREE.MeshLambertMaterial, string][] = [
  [MAT.glass, '#2a3c52'],
  [MAT.glassDark, '#243448'],
  [MAT.gold, '#4a3a10'],
  [MAT.goldDark, '#3a2e0c'],
];
for (const [mat, color] of GLOWING) {
  mat.emissive = new THREE.Color(color);
  mat.emissiveIntensity = 0;
}

export default function Lighting() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const nightT = useRef(0);
  const scene = useThree((s) => s.scene);

  if (!scene.fog) {
    scene.fog = new THREE.Fog(DAY.sky.clone(), 3000, 14000);
    scene.background = DAY.sky.clone();
  }

  useFrame((_, dt) => {
    const target = useAppStore.getState().night ? 1 : 0;
    const t = (nightT.current = THREE.MathUtils.damp(nightT.current, target, 3, dt));
    nightUniform.value = t;
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(DAY.hemiIntensity, NIGHT.hemiIntensity, t);
      hemi.current.color.lerpColors(DAY.hemiSky, NIGHT.hemiSky, t);
      hemi.current.groundColor.lerpColors(DAY.hemiGround, NIGHT.hemiGround, t);
    }
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(DAY.sunIntensity, NIGHT.sunIntensity, t);
      sun.current.color.lerpColors(DAY.sun, NIGHT.sun, t);
    }
    (scene.background as THREE.Color).lerpColors(DAY.sky, NIGHT.sky, t);
    (scene.fog as THREE.Fog).color.lerpColors(DAY.sky, NIGHT.sky, t);
    for (const [mat] of GLOWING) mat.emissiveIntensity = t;
    waterMaterial.color.lerpColors(WATER_DAY, WATER_NIGHT, t);
    roadMaterial.color.lerpColors(ROAD_DAY, ROAD_NIGHT, t);
    groundMaterial.color.lerpColors(GROUND_DAY, GROUND_NIGHT, t);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity]} />
      <directionalLight
        ref={sun}
        position={[2000, 4000, 1200]}
        intensity={DAY.sunIntensity}
        color={DAY.sun}
      />
    </>
  );
}
