/**
 * Staff AI (GAME_DESIGN.md §7): janitors hunt litter, mechanics fix broken
 * rides, entertainers cheer the longest queue. Everyone walks the path
 * network; skill grows with jobs done.
 */

import {
  ENTERTAINER_RADIUS,
  REPAIR_TICKS_BASE,
  STAFF_WALK_SPEED,
  SWEEP_TICKS,
} from "../balance/phase3";
import { rotatedFootprint } from "../validate";
import { getPlaceableDef } from "@/content/catalog";
import { hasPerk } from "../research";
import { adjacentPathTiles, findPath, isStrollable } from "../world/pathfind";
import type { Staff, World } from "../world/world";

const TICK_DT = 0.1;

export function staffSystem(world: World): void {
  for (const staff of world.staff) {
    staff.px = staff.x;
    staff.pz = staff.z;
    if (staff.workT > 0) {
      staff.workT--;
      if (staff.workT === 0) finishJob(world, staff);
      continue;
    }
    if (staff.path.length > 0) {
      followPath(world, staff);
      continue;
    }
    pickJob(world, staff);
  }
}

function followPath(world: World, staff: Staff): void {
  const size = world.tiles.size;
  const idx = staff.path[Math.min(staff.pathStep, staff.path.length - 1)] as number;
  const tx = (idx % size) + 0.5;
  const tz = Math.floor(idx / size) + 0.5;
  const dx = tx - staff.x;
  const dz = tz - staff.z;
  const dist = Math.hypot(dx, dz);
  const step = STAFF_WALK_SPEED * TICK_DT;
  if (dist <= step) {
    staff.x = tx;
    staff.z = tz;
    if (staff.pathStep >= staff.path.length - 1) {
      staff.path = [];
      staff.pathStep = 0;
      arrive(world, staff);
    } else {
      staff.pathStep++;
    }
    return;
  }
  staff.x += (dx / dist) * step;
  staff.z += (dz / dist) * step;
  staff.heading = Math.atan2(dx, dz);
}

function arrive(world: World, staff: Staff): void {
  switch (staff.role) {
    case "janitor": {
      const tile = staffTile(world, staff);
      if (staff.jobTarget === tile && world.litter.some((l) => l.idx === tile)) {
        staff.workT = hasPerk(world, "golden-brooms") ? Math.ceil(SWEEP_TICKS / 2) : SWEEP_TICKS;
        return;
      }
      staff.jobTarget = -1;
      break;
    }
    case "mechanic": {
      const ride = world.rides.get(staff.jobTarget);
      if (ride && ride.phase === "broken" && ride.repairT <= 0) {
        const skill = 1 + Math.min(0.5, staff.jobsDone * 0.02);
        const perk = hasPerk(world, "swift-wrenches") ? 1.5 : 1;
        staff.workT = Math.max(20, Math.round(REPAIR_TICKS_BASE / (skill * perk)));
        ride.repairT = -1; // claimed by this mechanic
        return;
      }
      staff.jobTarget = -1;
      break;
    }
    case "entertainer":
      staff.workT = 60; // perform for 6 s, then re-evaluate
      return;
  }
}

function finishJob(world: World, staff: Staff): void {
  switch (staff.role) {
    case "janitor": {
      const tile = staffTile(world, staff);
      const before = world.litter.length;
      world.litter = world.litter.filter((l) => l.idx !== tile);
      if (world.litter.length < before) {
        staff.jobsDone++;
        world.tallies.litterSwept += before - world.litter.length;
      }
      staff.jobTarget = -1;
      break;
    }
    case "mechanic": {
      const ride = world.rides.get(staff.jobTarget);
      if (ride && ride.phase === "broken") {
        ride.phase = "idle";
        ride.repairT = 0;
        ride.reliability = Math.min(100, ride.reliability + 70);
        staff.jobsDone++;
        world.tallies.mechanicRepairs++;
      }
      staff.jobTarget = -1;
      break;
    }
    case "entertainer": {
      // Cheer everyone queued nearby: reset some patience, sprinkle joy.
      const g = world.guests;
      for (const ride of world.rides.values()) {
        for (const guestId of ride.queue) {
          const slot = g.slotOf.get(guestId);
          if (slot === undefined) continue;
          const dist = Math.hypot((g.x[slot] as number) - staff.x, (g.z[slot] as number) - staff.z);
          if (dist <= ENTERTAINER_RADIUS) {
            g.timer[slot] = Math.max(0, (g.timer[slot] as number) - 40);
            g.fun[slot] = Math.min(100, (g.fun[slot] as number) + 1.5);
            staff.jobsDone++;
          }
        }
      }
      staff.jobTarget = -1;
      break;
    }
  }
}

function pickJob(world: World, staff: Staff): void {
  const size = world.tiles.size;
  const fromX = Math.floor(staff.x);
  const fromZ = Math.floor(staff.z);

  if (staff.role === "janitor" && world.litter.length > 0) {
    // Nearest litter (manhattan) — small lists, plain scan is fine.
    let best = -1;
    let bestDist = Infinity;
    for (const item of world.litter) {
      const lx = item.idx % size;
      const lz = Math.floor(item.idx / size);
      const d = Math.abs(lx - fromX) + Math.abs(lz - fromZ);
      if (d < bestDist) {
        bestDist = d;
        best = item.idx;
      }
    }
    if (best >= 0) {
      const path = findPath(world, fromX, fromZ, new Set([best]), false);
      if (path) {
        staff.path = path;
        staff.pathStep = 0;
        staff.jobTarget = best;
        return;
      }
    }
  }

  if (staff.role === "mechanic") {
    for (const [id, ride] of world.rides) {
      if (ride.phase !== "broken" || ride.repairT !== 0) continue;
      const entity = world.placeables.get(id);
      if (!entity) continue;
      const def = getPlaceableDef(entity.defId);
      const [w, d] = rotatedFootprint(def, entity.rot);
      const goals = adjacentPathTiles(world, entity.x, entity.z, w, d);
      if (goals.size === 0) continue;
      const path = findPath(world, fromX, fromZ, goals, false);
      if (path) {
        staff.path = path;
        staff.pathStep = 0;
        staff.jobTarget = id;
        return;
      }
    }
  }

  if (staff.role === "entertainer") {
    // Head for the longest queue's join area.
    let bestRide: number | null = null;
    let bestLen = 2;
    for (const [id, ride] of world.rides) {
      if (ride.queue.length > bestLen) {
        bestLen = ride.queue.length;
        bestRide = id;
      }
    }
    if (bestRide !== null) {
      const entity = world.placeables.get(bestRide);
      if (entity) {
        const def = getPlaceableDef(entity.defId);
        const [w, d] = rotatedFootprint(def, entity.rot);
        const goals = adjacentPathTiles(world, entity.x, entity.z, w, d);
        const path = goals.size > 0 ? findPath(world, fromX, fromZ, goals, false) : null;
        if (path) {
          staff.path = path;
          staff.pathStep = 0;
          staff.jobTarget = bestRide;
          return;
        }
      }
    }
  }

  // Idle wander.
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = fromX + world.rng.int(-6, 6);
    const tz = fromZ + world.rng.int(-6, 6);
    if (!isStrollable(world, tx, tz)) continue;
    const path = findPath(world, fromX, fromZ, new Set([tz * size + tx]), false);
    if (path && path.length > 1) {
      staff.path = path;
      staff.pathStep = 0;
      return;
    }
  }
}

const staffTile = (world: World, staff: Staff): number =>
  Math.floor(staff.z) * world.tiles.size + Math.floor(staff.x);
