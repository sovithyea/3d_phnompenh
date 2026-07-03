import { Canvas } from '@react-three/fiber';
import CityScene from './scene/CityScene';

export default function App() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [2500, 1800, 3000], near: 1, far: 20000, fov: 50 }}>
        <CityScene />
      </Canvas>
    </div>
  );
}
