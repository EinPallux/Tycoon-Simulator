/**
 * Ride-config resolver: flat rides read static content; coaster stations
 * resolve their computed stats. Everything downstream (rideOps, goal
 * choice, inspectors) uses this one lens.
 */

import { getPlaceableDef } from "@/content/catalog";
import type { RideConfig } from "@/content/types";
import { FAMILY_INFO } from "./coaster/coaster";
import type { World } from "./world/world";

export function rideConfigOf(world: World, entityId: number): RideConfig | null {
  const entity = world.placeables.get(entityId);
  if (!entity) return null;
  const def = getPlaceableDef(entity.defId);
  if (def.ride) return def.ride;
  if (def.coasterFamily) {
    const coaster = world.coasters.get(entityId);
    if (!coaster) return null;
    const info = FAMILY_INFO[coaster.family];
    return {
      kind: "carousel", // unused for coasters (render has its own layer)
      capacity: 12,
      cycleSec: Math.max(8, coaster.totalTime),
      excitement: coaster.stats.excitement,
      intensity: coaster.stats.intensity,
      nausea: coaster.stats.nausea,
      ticket: info.ticket,
      runningPerDay: info.runningPerDay,
    };
  }
  return null;
}
