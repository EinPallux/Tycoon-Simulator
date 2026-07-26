/**
 * Ride-config resolver: flat rides read static content; coaster stations
 * resolve their computed stats. Everything downstream (rideOps, goal
 * choice, inspectors) uses this one lens.
 */

import { getPlaceableDef } from "@/content/catalog";
import type { RideConfig } from "@/content/types";
import { FAMILY_INFO } from "./coaster/coaster";
import { ZONE_EXCITEMENT_BONUS } from "./systems/zones";
import type { World } from "./world/world";

export function rideConfigOf(world: World, entityId: number): RideConfig | null {
  const entity = world.placeables.get(entityId);
  if (!entity) return null;
  const def = getPlaceableDef(entity.defId);
  const zoneBonus = zoneBonusOf(world, entityId);
  if (def.ride) {
    if (zoneBonus === 0) return def.ride;
    return { ...def.ride, excitement: Math.min(10, def.ride.excitement + zoneBonus) };
  }
  if (def.coasterFamily) {
    const coaster = world.coasters.get(entityId);
    if (!coaster) return null;
    const info = FAMILY_INFO[coaster.family];
    return {
      kind: "carousel", // unused for coasters (render has its own layer)
      capacity: 12,
      cycleSec: Math.max(8, coaster.totalTime),
      excitement: Math.min(10, coaster.stats.excitement + zoneBonus),
      intensity: coaster.stats.intensity,
      nausea: coaster.stats.nausea,
      ticket: info.ticket,
      runningPerDay: info.runningPerDay,
    };
  }
  return null;
}

/** Themed-zone excitement bonus for a ride (GAME_DESIGN.md §10.3). */
export function zoneBonusOf(world: World, entityId: number): number {
  for (const zone of world.zones) {
    if (zone.rideIds.includes(entityId)) return ZONE_EXCITEMENT_BONUS;
  }
  return 0;
}
