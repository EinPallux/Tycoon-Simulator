/**
 * A* pathfinding over the walkable graph: path/queue tiles plus the entrance
 * tile (guests' door to the world). Grids are small (≤60×60 owned area), so a
 * plain binary-heap A* with typed-array scores is plenty fast for hundreds of
 * guests re-planning occasionally.
 */

import { getSurface, SURFACE_NONE, SURFACE_PATH, SURFACE_QUEUE, type TileMap } from "./tiles";
import type { World } from "./world";
import { DIRS } from "./pathgraph";

export function isWalkable(world: World, x: number, z: number): boolean {
  if (x === world.entrance.x && z === world.entrance.z) return true;
  const s = getSurface(world.tiles, x, z);
  return s === SURFACE_PATH || s === SURFACE_QUEUE;
}

/** Path tiles only (queues are for queuing, not strolling). */
export function isStrollable(world: World, x: number, z: number): boolean {
  if (x === world.entrance.x && z === world.entrance.z) return true;
  return getSurface(world.tiles, x, z) === SURFACE_PATH;
}

/**
 * A* from start tile to ANY tile in `goals` (as tile indices).
 * Returns the tile-index path INCLUDING start and goal, or null.
 * `strollOnly` keeps guests off queue tiles during normal travel.
 */
export function findPath(
  world: World,
  startX: number,
  startZ: number,
  goals: ReadonlySet<number>,
  strollOnly = true,
): number[] | null {
  const map: TileMap = world.tiles;
  const size = map.size;
  const start = startZ * size + startX;
  if (goals.size === 0) return null;
  if (goals.has(start)) return [start];

  const walkable = strollOnly ? isStrollable : isWalkable;
  if (!walkable(world, startX, startZ)) return null;

  // Pick any goal as the heuristic anchor (multi-goal: nearest-ish).
  let anchorX = 0;
  let anchorZ = 0;
  for (const g of goals) {
    anchorX = g % size;
    anchorZ = Math.floor(g / size);
    break;
  }

  const INF = 0x7fffffff;
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  // Binary heap of [f, tile].
  const heap: number[] = [];
  const heapTiles: number[] = [];
  const push = (f: number, tile: number): void => {
    let i = heap.length;
    heap.push(f);
    heapTiles.push(tile);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((heap[p] ?? INF) <= (heap[i] ?? INF)) break;
      [heap[p], heap[i]] = [heap[i] as number, heap[p] as number];
      [heapTiles[p], heapTiles[i]] = [heapTiles[i] as number, heapTiles[p] as number];
      i = p;
    }
  };
  const pop = (): number => {
    const tile = heapTiles[0] as number;
    const lastF = heap.pop() as number;
    const lastT = heapTiles.pop() as number;
    if (heap.length > 0) {
      heap[0] = lastF;
      heapTiles[0] = lastT;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && (heap[l] ?? INF) < (heap[m] ?? INF)) m = l;
        if (r < heap.length && (heap[r] ?? INF) < (heap[m] ?? INF)) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i] as number, heap[m] as number];
        [heapTiles[m], heapTiles[i]] = [heapTiles[i] as number, heapTiles[m] as number];
        i = m;
      }
    }
    return tile;
  };

  const h = (tile: number): number => {
    const x = tile % size;
    const z = Math.floor(tile / size);
    return Math.abs(x - anchorX) + Math.abs(z - anchorZ);
  };

  gScore.set(start, 0);
  push(h(start), start);
  let iterations = 0;

  while (heap.length > 0 && iterations++ < 20_000) {
    const current = pop();
    if (goals.has(current)) {
      const path = [current];
      let node = current;
      while (cameFrom.has(node)) {
        node = cameFrom.get(node) as number;
        path.push(node);
      }
      path.reverse();
      return path;
    }
    const cx = current % size;
    const cz = Math.floor(current / size);
    const g = gScore.get(current) ?? INF;
    for (const [dx, dz] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      // Goal tiles are enterable even when not strollable (e.g. queue heads).
      const nIdx = nz * size + nx;
      if (!walkable(world, nx, nz) && !goals.has(nIdx)) continue;
      const tentative = g + 1;
      if (tentative < (gScore.get(nIdx) ?? INF)) {
        gScore.set(nIdx, tentative);
        cameFrom.set(nIdx, current);
        push(tentative + h(nIdx), nIdx);
      }
    }
  }
  return null;
}

/** Walkable path tiles adjacent to an entity footprint (as tile indices). */
export function adjacentPathTiles(
  world: World,
  x: number,
  z: number,
  w: number,
  d: number,
): Set<number> {
  const result = new Set<number>();
  const size = world.tiles.size;
  const consider = (tx: number, tz: number): void => {
    if (getSurface(world.tiles, tx, tz) === SURFACE_PATH) result.add(tz * size + tx);
  };
  for (let dx = 0; dx < w; dx++) {
    consider(x + dx, z - 1);
    consider(x + dx, z + d);
  }
  for (let dz = 0; dz < d; dz++) {
    consider(x - 1, z + dz);
    consider(x + w, z + dz);
  }
  return result;
}

/**
 * The queue chain serving an entity: starting from queue tiles adjacent to
 * the footprint, walk outward through connected queue tiles until the chain
 * meets a path tile (the "join point"). Returns tile indices ordered from the
 * ride edge outward, plus the joining path tile (or null when the chain
 * doesn't reach a path).
 */
export function queueChainFor(
  world: World,
  x: number,
  z: number,
  w: number,
  d: number,
): { chain: number[]; joinPath: number | null } {
  const size = world.tiles.size;
  const isQueue = (tx: number, tz: number): boolean =>
    getSurface(world.tiles, tx, tz) === SURFACE_QUEUE;

  // Find the queue tile touching the footprint (first found = head).
  let head = -1;
  outer: for (let dx = 0; dx < w; dx++) {
    for (const [tx, tz] of [
      [x + dx, z - 1],
      [x + dx, z + d],
    ] as const) {
      if (isQueue(tx, tz)) {
        head = tz * size + tx;
        break outer;
      }
    }
  }
  if (head === -1) {
    for (let dz = 0; dz < d && head === -1; dz++) {
      for (const [tx, tz] of [
        [x - 1, z + dz],
        [x + w, z + dz],
      ] as const) {
        if (isQueue(tx, tz)) {
          head = tz * size + tx;
          break;
        }
      }
    }
  }
  if (head === -1) return { chain: [], joinPath: null };

  const chain: number[] = [head];
  const seen = new Set<number>([head]);
  let current = head;
  for (let steps = 0; steps < 64; steps++) {
    const cx = current % size;
    const cz = Math.floor(current / size);
    let next = -1;
    let join: number | null = null;
    for (const [dx, dz] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      const nIdx = nz * size + nx;
      if (seen.has(nIdx)) continue;
      const s = getSurface(world.tiles, nx, nz);
      if (s === SURFACE_QUEUE) next = nIdx;
      else if (s === SURFACE_PATH) join = nIdx;
      void SURFACE_NONE;
    }
    if (next !== -1) {
      chain.push(next);
      seen.add(next);
      current = next;
    } else {
      return { chain, joinPath: join };
    }
  }
  return { chain, joinPath: null };
}
