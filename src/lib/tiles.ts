import { TILE_SIZE } from '../config';

export function tileIndex(x: number, z: number): [number, number] {
  return [Math.floor(x / TILE_SIZE), Math.floor(z / TILE_SIZE)];
}

export function tileKey(ix: number, iz: number): string {
  return `${ix}_${iz}`;
}

export function tileCenter(ix: number, iz: number): [number, number] {
  return [(ix + 0.5) * TILE_SIZE, (iz + 0.5) * TILE_SIZE];
}

export function centroidOf(flat: number[]): [number, number] {
  let x = 0,
    z = 0;
  const n = flat.length / 2;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    z += flat[i + 1];
  }
  return [x / n, z / n];
}
