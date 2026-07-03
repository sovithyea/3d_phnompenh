import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_SIZE = 12000; // meters, covers bbox with margin

export default function CityScene() {
  return (
    <>
      <color attach="background" args={['#cfe0ee']} />
      <hemisphereLight args={['#bfd9ff', '#c8b89a', 0.9]} />
      <directionalLight position={[2000, 4000, 1200]} intensity={1.6} color="#fff5e8" />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshLambertMaterial color="#c8c0ae" />
      </mesh>

      {/* placeholder at projection origin — removed in phase 2 */}
      <mesh position={[0, 50, 0]}>
        <boxGeometry args={[100, 100, 100]} />
        <meshLambertMaterial color="#8899aa" />
      </mesh>

      <CameraControls
        minDistance={50}
        maxDistance={8000}
        maxPolarAngle={Math.PI * 0.47}
        makeDefault
        ref={(controls) => {
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
