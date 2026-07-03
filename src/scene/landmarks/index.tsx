import type { ComponentType } from 'react';
import { lngLatToLocal } from '../../lib/projection';
import VattanacTower from './VattanacTower';
import ThePeak from './ThePeak';
import MorganEnmaison from './MorganEnmaison';
import NagaWorld from './NagaWorld';
import RoyalPalace from './RoyalPalace';
import WatPhnom from './WatPhnom';
import IndependenceMonument from './IndependenceMonument';
import ChroyChangvarBridge from './ChroyChangvarBridge';
import RiverfrontPromenade from './RiverfrontPromenade';

export type LandmarkDef = {
  id: string;
  title: string;
  blurb: string;
  anchor: { lng: number; lat: number };
  cameraOffset: [number, number, number]; // camera position relative to anchor
  lookHeight: number; // aim point height above ground
  absolute?: boolean; // component positions itself in city coords
  Component: ComponentType;
};

export const LANDMARK_DEFS: LandmarkDef[] = [
  {
    id: 'royal-palace',
    title: 'Royal Palace',
    blurb: 'Official residence of the King of Cambodia, built 1866.',
    anchor: { lng: 104.9305, lat: 11.56348 },
    cameraOffset: [420, 260, 300],
    lookHeight: 20,
    Component: RoyalPalace,
  },
  {
    id: 'wat-phnom',
    title: 'Wat Phnom',
    blurb: 'The 27m temple hill the city is named after (1372).',
    anchor: { lng: 104.92321, lat: 11.57613 },
    cameraOffset: [260, 160, 260],
    lookHeight: 30,
    Component: WatPhnom,
  },
  {
    id: 'independence-monument',
    title: 'Independence Monument',
    blurb: 'Lotus-shaped stupa (1958) marking independence from France.',
    anchor: { lng: 104.92819, lat: 11.55644 },
    cameraOffset: [160, 80, 160],
    lookHeight: 18,
    Component: IndependenceMonument,
  },
  {
    id: 'vattanac',
    title: 'Vattanac Capital Tower',
    blurb: '187m dragon-back tower, completed 2014.',
    anchor: { lng: 104.91889, lat: 11.57342 },
    cameraOffset: [350, 220, 350],
    lookHeight: 90,
    Component: VattanacTower,
  },
  {
    id: 'nagaworld',
    title: 'NagaWorld',
    blurb: 'Casino-resort complex; Naga 3 still under construction in 2026.',
    anchor: { lng: 104.93723, lat: 11.55563 },
    cameraOffset: [-380, 240, 300],
    lookHeight: 40,
    Component: NagaWorld,
  },
  {
    id: 'the-peak',
    title: 'The Peak & Shangri-La',
    blurb: '236m hotel tower with twin 205m residences (2020s).',
    anchor: { lng: 104.9383, lat: 11.553 },
    cameraOffset: [-400, 280, 350],
    lookHeight: 120,
    Component: ThePeak,
  },
  {
    id: 'morgan-enmaison',
    title: 'Morgan Enmaison',
    blurb: '244m Enmaison 2 — tallest completed building in Cambodia (2026).',
    anchor: { lng: 104.9364, lat: 11.5931 },
    cameraOffset: [-380, 280, 380],
    lookHeight: 120,
    Component: MorganEnmaison,
  },
  {
    id: 'chroy-changvar-bridge',
    title: 'Chroy Changvar Bridge',
    blurb: 'Cambodia–Japan Friendship Bridge over the Tonle Sap (1966).',
    anchor: { lng: 104.92162, lat: 11.5872 },
    cameraOffset: [-100, 180, 420],
    lookHeight: 8,
    absolute: true,
    Component: ChroyChangvarBridge,
  },
  {
    id: 'riverfront',
    title: 'Sisowath Quay Riverfront',
    blurb: 'Promenade at the Chaktomuk confluence of the Tonle Sap, Mekong and Bassac.',
    anchor: { lng: 104.9325, lat: 11.569 },
    cameraOffset: [-350, 260, 100],
    lookHeight: 5,
    absolute: true,
    Component: RiverfrontPromenade,
  },
];

export default function Landmarks() {
  return (
    <>
      {LANDMARK_DEFS.map((l) => {
        const [x, z] = lngLatToLocal(l.anchor.lng, l.anchor.lat);
        return (
          <group
            key={l.id}
            position={l.absolute ? [0, 0, 0] : [x, 0, z]}
            userData={{ landmarkId: l.id }}
          >
            <l.Component />
          </group>
        );
      })}
    </>
  );
}
