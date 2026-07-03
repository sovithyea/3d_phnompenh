import { useAppStore } from '../state/useAppStore';
import { LANDMARK_DEFS } from '../scene/landmarks';

export default function Hud() {
  const night = useAppStore((s) => s.night);
  const toggleNight = useAppStore((s) => s.toggleNight);
  const selected = useAppStore((s) => s.selectedLandmark);
  const setSelected = useAppStore((s) => s.setSelectedLandmark);

  return (
    <div className="hud">
      <div className="hud-panel">
        <h1>Phnom Penh 3D · 2026</h1>
        <button className="hud-toggle" onClick={toggleNight}>
          {night ? '☀ Day' : '☾ Night'}
        </button>
        <ul>
          {LANDMARK_DEFS.map((l) => (
            <li key={l.id}>
              <button
                className={selected === l.id ? 'active' : ''}
                onClick={() => setSelected(l.id)}
              >
                {l.title}
              </button>
            </li>
          ))}
        </ul>
        <p className="hud-credit">
          Building data © OpenStreetMap contributors (ODbL)
        </p>
      </div>
    </div>
  );
}
