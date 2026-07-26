/**
 * Theming zones (GAME_DESIGN.md §10.3): ≥8 same-theme scenery pieces
 * clustered together with ≥1 ride nearby form a named zone — +excitement
 * for zone rides, +mood for guests inside, a banner in the world.
 *
 * Zones are DERIVED state: recomputed after any placeable change (edit-rate,
 * not per-tick). Identity = theme + cluster bbox min corner; player names
 * (world.zoneNames) persist by that key and survive small edits.
 */

import { getPlaceableDef } from "@/content/catalog";
import { ZONE_NAMES } from "@/content/goals";
import type { World, Zone } from "../world/world";

/** Chebyshev distance ≤ CLUSTER_GAP links two pieces into one cluster. */
const CLUSTER_GAP = 3;
/** Rides within this many tiles of the cluster bbox join the zone. */
const RIDE_REACH = 4;
export const ZONE_MIN_PIECES = 8;
/** Excitement bonus for rides inside a zone. */
export const ZONE_EXCITEMENT_BONUS = 0.5;

interface TaggedPiece {
  id: number;
  x: number;
  z: number;
  theme: string;
}

export function recomputeZones(world: World): { formed: Zone[] } {
  const pieces: TaggedPiece[] = [];
  for (const entity of world.placeables.values()) {
    const def = getPlaceableDef(entity.defId);
    if (def.category === "scenery" && def.themeTag) {
      pieces.push({ id: entity.id, x: entity.x, z: entity.z, theme: def.themeTag });
    }
  }

  // Union-find per theme over proximity.
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let root = i;
    while (parent.get(root) !== root) root = parent.get(root) as number;
    let cur = i;
    while (cur !== root) {
      const next = parent.get(cur) as number;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  for (let i = 0; i < pieces.length; i++) parent.set(i, i);
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i] as TaggedPiece;
    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j] as TaggedPiece;
      if (a.theme !== b.theme) continue;
      if (Math.abs(a.x - b.x) <= CLUSTER_GAP && Math.abs(a.z - b.z) <= CLUSTER_GAP) union(i, j);
    }
  }

  const clusters = new Map<number, TaggedPiece[]>();
  for (let i = 0; i < pieces.length; i++) {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(pieces[i] as TaggedPiece);
    clusters.set(root, list);
  }

  const previousKeys = new Set(world.zones.map((z) => z.key));
  const zones: Zone[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.length < ZONE_MIN_PIECES) continue;
    const theme = (cluster[0] as TaggedPiece).theme;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const piece of cluster) {
      x0 = Math.min(x0, piece.x);
      z0 = Math.min(z0, piece.z);
      x1 = Math.max(x1, piece.x);
      z1 = Math.max(z1, piece.z);
    }
    // Rides whose footprint anchor falls within reach of the bbox.
    const rideIds: number[] = [];
    for (const entity of world.placeables.values()) {
      const def = getPlaceableDef(entity.defId);
      if (!def.ride && !def.coasterFamily) continue;
      if (
        entity.x >= x0 - RIDE_REACH &&
        entity.x <= x1 + RIDE_REACH &&
        entity.z >= z0 - RIDE_REACH &&
        entity.z <= z1 + RIDE_REACH
      ) {
        rideIds.push(entity.id);
      }
    }
    if (rideIds.length === 0) continue;
    rideIds.sort((a, b) => a - b);
    const key = `${theme}:${x0},${z0}`;
    const suggested = ZONE_NAMES[theme] ?? ["Zone"];
    const name =
      world.zoneNames[key] ?? (suggested[zones.length % suggested.length] as string);
    zones.push({ key, theme, name, pieces: cluster.length, x0, z0, x1, z1, rideIds });
  }
  zones.sort((a, b) => (a.key < b.key ? -1 : 1));
  world.zones = zones;

  const formed = zones.filter((z) => !previousKeys.has(z.key));
  world.tallies.zonesFormed += formed.length;
  return { formed };
}

/** Zone containing a ride entity, if any (first match). */
export function zoneOfRide(world: World, entityId: number): Zone | null {
  for (const zone of world.zones) {
    if (zone.rideIds.includes(entityId)) return zone;
  }
  return null;
}

/** Is a world position inside any zone's (slightly padded) bounds? */
export function zoneAt(world: World, x: number, z: number): Zone | null {
  for (const zone of world.zones) {
    if (x >= zone.x0 - 1 && x <= zone.x1 + 2 && z >= zone.z0 - 1 && z <= zone.z1 + 2) return zone;
  }
  return null;
}
