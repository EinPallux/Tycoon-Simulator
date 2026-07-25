/**
 * Path-network helpers: neighbor masks for auto-tiling and BFS connectivity
 * (guest pathfinding builds on this from Phase 2).
 *
 * Canonical piece semantics (visual rotation offsets belong in the asset
 * manifest, never here):
 *  - straight: runs north-south at rot 0
 *  - corner:   connects north + east at rot 0
 *  - split:    T connecting west + east + south at rot 0 (missing north)
 *  - crossing: all four
 *  - end:      dead end opening north at rot 0
 */

import { getSurface, SURFACE_NONE, type Surface, type TileMap } from "./tiles";

export const N = 1; // -z
export const E = 2; // +x
export const S = 4; // +z
export const W = 8; // -x

export const DIRS: ReadonlyArray<readonly [dx: number, dz: number, bit: number]> = [
  [0, -1, N],
  [1, 0, E],
  [0, 1, S],
  [-1, 0, W],
];

/** Bitmask of same-surface neighbors for the tile. */
export function neighborMask(map: TileMap, x: number, z: number, surface: Surface): number {
  let mask = 0;
  for (const [dx, dz, bit] of DIRS) {
    if (getSurface(map, x + dx, z + dz) === surface) mask |= bit;
  }
  return mask;
}

export type PathPiece = "straight" | "corner" | "split" | "crossing" | "end";

export interface PathTileVisual {
  piece: PathPiece;
  /** Rotation in 90° clockwise steps (0..3), applied around +y. */
  rot: number;
}

/** Map a 4-neighbor mask to piece + rotation per the canonical semantics. */
export function pieceForMask(mask: number): PathTileVisual {
  switch (mask) {
    // isolated tile — render a straight stub
    case 0:
      return { piece: "straight", rot: 0 };
    // dead ends (one neighbor); end opens toward its neighbor
    case N:
      return { piece: "end", rot: 0 };
    case E:
      return { piece: "end", rot: 1 };
    case S:
      return { piece: "end", rot: 2 };
    case W:
      return { piece: "end", rot: 3 };
    // straights
    case N | S:
      return { piece: "straight", rot: 0 };
    case E | W:
      return { piece: "straight", rot: 1 };
    // corners (rot 0 connects N+E, then clockwise)
    case N | E:
      return { piece: "corner", rot: 0 };
    case E | S:
      return { piece: "corner", rot: 1 };
    case S | W:
      return { piece: "corner", rot: 2 };
    case W | N:
      return { piece: "corner", rot: 3 };
    // splits (rot 0 = missing N, then rotate so the missing side turns clockwise)
    case W | E | S:
      return { piece: "split", rot: 0 };
    case N | S | W:
      return { piece: "split", rot: 1 };
    case W | E | N:
      return { piece: "split", rot: 2 };
    case N | S | E:
      return { piece: "split", rot: 3 };
    case N | E | S | W:
      return { piece: "crossing", rot: 0 };
    default:
      return { piece: "straight", rot: 0 };
  }
}

/** Tiles reachable from (startX, startZ) walking the same surface type. */
export function reachableFrom(
  map: TileMap,
  startX: number,
  startZ: number,
  surface: Surface,
): Set<number> {
  const result = new Set<number>();
  if (surface === SURFACE_NONE || getSurface(map, startX, startZ) !== surface) return result;
  const queue: number[] = [startZ * map.size + startX];
  result.add(queue[0] ?? 0);
  while (queue.length > 0) {
    const idx = queue.pop() as number;
    const x = idx % map.size;
    const z = Math.floor(idx / map.size);
    for (const [dx, dz] of DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      const nIdx = nz * map.size + nx;
      if (!result.has(nIdx) && getSurface(map, nx, nz) === surface) {
        result.add(nIdx);
        queue.push(nIdx);
      }
    }
  }
  return result;
}
