import * as THREE from 'three';

// Cross-section loft: sweep a 2D profile (XZ plane) through vertical sections.
// Used by the parametric skyscrapers (Vattanac, Morgan, Peak).
export type LoftSection = {
  y: number;
  sx: number; // profile scale x
  sz: number; // profile scale z
  ox?: number; // profile offset x (lean)
  oz?: number;
};

// Rounded-rectangle profile, CCW, centered at origin. r = corner radius.
export function roundedRectProfile(w: number, d: number, r: number, cornerSegs = 3): [number, number][] {
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  const pts: [number, number][] = [];
  const corner = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= cornerSegs; i++) {
      const a = a0 + (i / cornerSegs) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  };
  corner(hw, hd, 0);
  corner(-hw, hd, Math.PI / 2);
  corner(-hw, -hd, Math.PI);
  corner(hw, -hd, Math.PI * 1.5);
  return pts;
}

export function loftGeometry(profile: [number, number][], sections: LoftSection[]): THREE.BufferGeometry {
  const n = profile.length;
  const positions: number[] = [];
  const indices: number[] = [];

  const ringAt = (s: LoftSection) =>
    profile.map(([px, pz]) => [px * s.sx + (s.ox ?? 0), s.y, pz * s.sz + (s.oz ?? 0)]);

  const rings = sections.map(ringAt);
  for (const ring of rings) for (const p of ring) positions.push(p[0], p[1], p[2]);

  // side quads between consecutive rings
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + j1;
      const c = (i + 1) * n + j1;
      const d = (i + 1) * n + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // caps (fan-triangulated via ShapeUtils to handle any convex-ish profile)
  const vec2s = profile.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(vec2s, []);
  const topBase = (rings.length - 1) * n;
  for (const [a, b, c] of tris) {
    indices.push(topBase + a, topBase + b, topBase + c); // top
    indices.push(c, b, a); // bottom, reversed
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  const nonIndexed = geom.toNonIndexed(); // flat shading-friendly normals
  nonIndexed.computeVertexNormals();
  geom.dispose();
  return nonIndexed;
}

// Box walls + triangular-prism pitched roof, ridge along the x axis.
// Returns geometry centered at origin in x/z, base at y=0.
export function pitchedRoofBox(
  w: number,
  d: number,
  wallH: number,
  roofH: number,
  overhang = 1.5,
): THREE.BufferGeometry {
  const wall = new THREE.BoxGeometry(w, wallH, d);
  wall.translate(0, wallH / 2, 0);

  const shape = new THREE.Shape();
  const hd = d / 2 + overhang;
  shape.moveTo(-hd, 0);
  shape.lineTo(hd, 0);
  shape.lineTo(0, roofH);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
  roof.rotateY(-Math.PI / 2); // extrusion axis z → x, ridge along x
  roof.translate(-(w / 2 + overhang), wallH, 0);

  const merged = mergeGeoms([wall, roof]);
  return merged;
}

export function mergeGeoms(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // local minimal merge (positions+normals only) to avoid attribute mismatches
  const parts = geoms.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g;
    return ni;
  });
  let total = 0;
  for (const p of parts) total += p.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let off = 0;
  for (const p of parts) {
    const pa = p.getAttribute('position');
    const na = p.getAttribute('normal');
    pos.set(pa.array as Float32Array, off * 3);
    nor.set(na.array as Float32Array, off * 3);
    off += pa.count;
    p.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
