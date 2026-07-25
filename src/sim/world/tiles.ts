/**
 * Tile-layer storage for the world grid (TECHNICAL_ARCHITECTURE.md §6).
 * Flat typed arrays indexed by z * size + x. 0/empty is always "none".
 */

export const SURFACE_NONE = 0;
export const SURFACE_PATH = 1;
export const SURFACE_QUEUE = 2;
export type Surface = typeof SURFACE_NONE | typeof SURFACE_PATH | typeof SURFACE_QUEUE;

export interface TileMap {
  readonly size: number;
  /** 1 = owned by the player. */
  readonly owned: Uint8Array;
  /** SURFACE_* enum per tile. */
  readonly surface: Uint8Array;
  /** Occupying placeable id (0 = none). Footprints stamp every covered tile. */
  readonly occupant: Uint32Array;
}

export function createTileMap(size: number): TileMap {
  return {
    size,
    owned: new Uint8Array(size * size),
    surface: new Uint8Array(size * size),
    occupant: new Uint32Array(size * size),
  };
}

export const tileIndex = (map: TileMap, x: number, z: number): number => z * map.size + x;

export const inBounds = (map: TileMap, x: number, z: number): boolean =>
  x >= 0 && z >= 0 && x < map.size && z < map.size;

export const isOwned = (map: TileMap, x: number, z: number): boolean =>
  inBounds(map, x, z) && map.owned[tileIndex(map, x, z)] === 1;

export const getSurface = (map: TileMap, x: number, z: number): Surface =>
  inBounds(map, x, z) ? ((map.surface[tileIndex(map, x, z)] ?? 0) as Surface) : SURFACE_NONE;

export const getOccupant = (map: TileMap, x: number, z: number): number =>
  inBounds(map, x, z) ? (map.occupant[tileIndex(map, x, z)] ?? 0) : 0;

export function setOwnedRect(
  map: TileMap,
  x0: number,
  z0: number,
  w: number,
  d: number,
  value: 0 | 1,
): void {
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      if (inBounds(map, x, z)) map.owned[tileIndex(map, x, z)] = value;
    }
  }
}
