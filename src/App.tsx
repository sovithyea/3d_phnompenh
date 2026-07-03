import { Canvas } from '@react-three/fiber';
import CityScene from './scene/CityScene';

export default function App() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* near=10: city-scale depth precision — near=1 z-fights ground/water beyond ~2km */}
      <Canvas camera={{ position: [2500, 1800, 3000], near: 10, far: 20000, fov: 50 }}>
        <CityScene />
      </Canvas>
    </div>
  );
}
