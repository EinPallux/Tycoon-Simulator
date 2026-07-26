/**
 * Ride operation cycle: idle → loading → running → unloading → idle
 * (GAME_DESIGN.md §4.3, §8-lite for Phase 2 — no breakdowns yet).
 * Also positions queued guests along their queue chain and handles patience.
 */

import type { Emitter } from "@/shared/events";
import { getPlaceableDef } from "@/content/catalog";
import { LEAVE_HOUR, QUEUE_PATIENCE_SEC, XP } from "../balance/guests";
import { VALUE_EMA_ALPHA } from "../balance/economy";
import {
  BREAKDOWN_BASE_PER_DAY,
  RELIABILITY_DECAY_PER_CYCLE,
} from "../balance/phase3";
import { addIncome } from "../economy";
import { EMOTE, GUEST_STATE, pushThought, setEmote } from "../entities/guests";
import { hasPerk } from "../research";
import { SURFACE_PATH } from "../world/tiles";
import { rideConfigOf } from "../rides";
import { adjacentPathTiles, queueChainFor } from "../world/pathfind";
import { rotatedFootprint } from "../validate";
import { TICKS_PER_DAY, timeOfDay01 } from "../world/time";
import { DIFFICULTY_PRESETS, type RideState, type World } from "../world/world";
import type { SimEvents } from "../api";

const LOADING_TICKS = 30; // 3 s
const UNLOADING_TICKS = 18; // 1.8 s
/** Idle dispatch wait: run even part-full after this long with ≥1 rider. */
const DISPATCH_WAIT_TICKS = 70;

export function breakdownChancePerTick(world: World, ride: RideState): number {
  let mult = DIFFICULTY_PRESETS[world.meta.difficulty].breakdownMult; // §15.7
  if (hasPerk(world, "predictive")) mult *= 0.4;
  else if (hasPerk(world, "preventive-care")) mult *= 0.65;
  return (BREAKDOWN_BASE_PER_DAY * (2 - ride.reliability / 100) * mult) / TICKS_PER_DAY;
}

export function rideOpsSystem(world: World, events: Emitter<SimEvents>): void {
  const t01 = timeOfDay01(world.time);
  const closingTime = t01 > LEAVE_HOUR || t01 < 0.3;

  for (const [entityId, ride] of world.rides) {
    const entity = world.placeables.get(entityId);
    if (!entity) continue;
    const def = getPlaceableDef(entity.defId);
    const cfg = rideConfigOf(world, entityId);
    if (!cfg) continue;

    positionQueue(world, ride, entity.x, entity.z, entity.rot, def.footprint);
    handlePatience(world, ride, def.name);

    // Night: stop taking queue joins seriously; finish the last cycle.
    if (closingTime && ride.queue.length > 0) {
      flushQueue(world, ride, "Park's winding down — home time.");
    }

    if (!ride.open) {
      // Closed: send everyone away.
      flushQueue(world, ride, "It just closed. Typical.");
      if (ride.riders.length > 0 && ride.phase !== "running") ejectRiders(world, ride, entity);
      if (ride.phase !== "broken") ride.phase = "idle";
      continue;
    }

    // Broken: wait for a mechanic (or a paid contractor via repairT ticks).
    if (ride.phase === "broken") {
      flushQueue(world, ride, `${def.name} is doing interpretive dance. I'm off.`);
      if (ride.repairT > 0) {
        ride.repairT--;
        if (ride.repairT === 0) {
          ride.phase = "idle";
          ride.reliability = Math.min(100, ride.reliability + 70);
          events.emit("ride-fixed", { id: entityId, name: def.name });
        }
      }
      continue;
    }

    // Wear + random malfunction while operating.
    if (ride.phase === "running") {
      if (world.rng.chance(breakdownChancePerTick(world, ride))) {
        ride.phase = "broken";
        ride.repairT = 0;
        world.tallies.breakdowns++;
        world.tallies.lastBreakdownAt = world.time;
        ejectRiders(world, ride, entity);
        events.emit("ride-broken", { id: entityId, name: def.name });
        events.emit("notify", {
          tone: "warning",
          message: `💥 ${def.name} broke down mid-cycle! A mechanic (or $${(250).toFixed(0)} contractor) can fix it.`,
        });
        continue;
      }
    }

    switch (ride.phase) {
      case "idle": {
        if (ride.queue.length === 0) break;
        ride.phase = "loading";
        ride.phaseT = LOADING_TICKS;
        break;
      }
      case "loading": {
        // Board from the queue front while there's room.
        while (ride.riders.length < cfg.capacity && ride.queue.length > 0) {
          const guestId = ride.queue.shift() as number;
          const slot = world.guests.slotOf.get(guestId);
          const cold = world.guests.cold.get(guestId);
          if (slot === undefined || !cold) continue;
          if (cold.money < ride.price) {
            world.guests.state[slot] = GUEST_STATE.strolling;
            continue;
          }
          cold.money -= ride.price;
          addIncome(world, "rides", ride.price);
          ride.incomeToday += ride.price;
          events.emit("sale", {
            source: "rides",
            cents: ride.price,
            x: entity.x,
            z: entity.z,
          });
          // Ticket value verdict: price vs excitement (perceived $ ≈ E×0.9).
          const fair = ride.price <= cfg.excitement * 90 * 1.35;
          world.rating.valueEma =
            world.rating.valueEma * (1 - VALUE_EMA_ALPHA) + (fair ? 1 : 0) * VALUE_EMA_ALPHA;
          ride.riders.push(guestId);
          world.guests.state[slot] = GUEST_STATE.riding;
          // Park riders at the ride's center while on board.
          const [w, d] = rotatedFootprint(def, entity.rot);
          world.guests.x[slot] = entity.x + w / 2;
          world.guests.z[slot] = entity.z + d / 2;
        }
        ride.phaseT--;
        const full = ride.riders.length >= cfg.capacity;
        const waitedLongEnough = ride.phaseT <= -DISPATCH_WAIT_TICKS;
        if ((ride.phaseT <= 0 && full) || (waitedLongEnough && ride.riders.length > 0)) {
          ride.phase = "running";
          ride.phaseT = Math.round(cfg.cycleSec * 10);
        } else if (ride.phaseT <= 0 && ride.riders.length === 0) {
          ride.phase = "idle";
        }
        break;
      }
      case "running": {
        ride.phaseT--;
        if (ride.phaseT <= 0) {
          ride.phase = "unloading";
          ride.phaseT = UNLOADING_TICKS;
        }
        break;
      }
      case "unloading": {
        ride.phaseT--;
        if (ride.phaseT <= 0) {
          if (def.coasterFamily) world.tallies.coasterRiders += ride.riders.length;
          const clubBonus = world.events.active?.kind === "coaster-club" && def.coasterFamily ? 2 : 0;
          finishRide(
            world,
            ride,
            entity.x,
            entity.z,
            entity.rot,
            def.footprint,
            def.name,
            cfg.excitement + clubBonus,
          );
          ride.reliability = Math.max(0, ride.reliability - RELIABILITY_DECAY_PER_CYCLE);
          ride.phase = "idle";
        }
        break;
      }
    }
  }
}

/** Stand queued guests along the chain (slot i = chain tile i, ride-outward). */
function positionQueue(
  world: World,
  ride: RideState,
  x: number,
  z: number,
  rot: number,
  footprint: readonly [number, number],
): void {
  if (ride.queue.length === 0) return;
  const [w, d] = rot % 2 === 0 ? footprint : ([footprint[1], footprint[0]] as const);
  const { chain, joinPath } = queueChainFor(world, x, z, w, d);
  const size = world.tiles.size;
  const anchor = chain.length > 0 ? chain : joinPath !== null ? [joinPath] : [];
  for (let i = 0; i < ride.queue.length; i++) {
    const guestId = ride.queue[i] as number;
    const slot = world.guests.slotOf.get(guestId);
    if (slot === undefined) continue;
    const tileIdx = anchor[Math.min(i, Math.max(0, anchor.length - 1))];
    if (tileIdx === undefined) continue;
    const overflow = Math.max(0, i - (anchor.length - 1));
    const tx = (tileIdx % size) + 0.5 + ((guestId * 131) % 40) / 100 - 0.2;
    const tz = Math.floor(tileIdx / size) + 0.5 + overflow * 0.001 + ((guestId * 37) % 40) / 100 - 0.2;
    // Ease toward the slot (queue shuffling look).
    const gx = world.guests.x[slot] as number;
    const gz = world.guests.z[slot] as number;
    world.guests.x[slot] = gx + (tx - gx) * 0.12;
    world.guests.z[slot] = gz + (tz - gz) * 0.12;
  }
}

function handlePatience(world: World, ride: RideState, rideName: string): void {
  const patienceMult = DIFFICULTY_PRESETS[world.meta.difficulty].patienceMult; // §15.7
  // Guests beyond the first `capacity` accumulate impatience.
  for (let i = 0; i < ride.queue.length; i++) {
    const guestId = ride.queue[i] as number;
    const slot = world.guests.slotOf.get(guestId);
    const cold = world.guests.cold.get(guestId);
    if (slot === undefined || !cold) continue;
    world.guests.timer[slot] = (world.guests.timer[slot] as number) + 1;
    const limit = QUEUE_PATIENCE_SEC * 10 * cold.patience * patienceMult * (i < 4 ? 1.6 : 1);
    if ((world.guests.timer[slot] as number) > limit) {
      ride.queue.splice(i, 1);
      i--;
      world.guests.state[slot] = GUEST_STATE.strolling;
      world.guests.timer[slot] = 0;
      world.guests.xp[slot] = (world.guests.xp[slot] as number) + XP.queueBail;
      setEmote(world.guests, slot, EMOTE.angry);
      pushThought(cold, `I grew a beard queuing for ${rideName}.`);
    }
  }
}

function flushQueue(world: World, ride: RideState, thought: string): void {
  for (const guestId of ride.queue) {
    const slot = world.guests.slotOf.get(guestId);
    const cold = world.guests.cold.get(guestId);
    if (slot === undefined) continue;
    world.guests.state[slot] = GUEST_STATE.strolling;
    world.guests.timer[slot] = 0;
    if (cold) pushThought(cold, thought);
  }
  ride.queue.length = 0;
}

function ejectRiders(world: World, ride: RideState, entity: { x: number; z: number }): void {
  for (const guestId of ride.riders) {
    const slot = world.guests.slotOf.get(guestId);
    if (slot === undefined) continue;
    world.guests.state[slot] = GUEST_STATE.strolling;
    world.guests.x[slot] = entity.x + 0.5;
    world.guests.z[slot] = entity.z + 0.5;
  }
  ride.riders.length = 0;
}

function finishRide(
  world: World,
  ride: RideState,
  x: number,
  z: number,
  rot: number,
  footprint: readonly [number, number],
  rideName: string,
  excitement: number,
): void {
  const [w, d] = rot % 2 === 0 ? footprint : ([footprint[1], footprint[0]] as const);
  const exits = adjacentPathTiles(world, x, z, w, d);
  const size = world.tiles.size;
  // Prefer a real PATH exit — dumping riders onto the queue traps them in a
  // ride-again loop when the queue is the ride's only walkable neighbor.
  let exitTile: number | null = null;
  let queueFallback: number | null = null;
  for (const tileIdx of exits) {
    if ((world.tiles.surface[tileIdx] ?? 0) === SURFACE_PATH) {
      exitTile = tileIdx;
      break;
    }
    if (queueFallback === null) queueFallback = tileIdx;
  }
  if (exitTile === null) exitTile = queueFallback;
  for (const guestId of ride.riders) {
    const slot = world.guests.slotOf.get(guestId);
    const cold = world.guests.cold.get(guestId);
    if (slot === undefined || !cold) continue;
    ride.lifetimeRiders++;
    cold.ridesRidden++;
    const g = world.guests;
    g.fun[slot] = Math.min(100, (g.fun[slot] as number) + 24 + excitement * 4);
    // Thrill match: close to preference = joy; way above = queasy grumble.
    const tolerance = 3 + cold.thrill * 6;
    if (excitement >= tolerance - 2.5) {
      g.xp[slot] = (g.xp[slot] as number) + XP.greatRide;
      setEmote(g, slot, EMOTE.star);
      pushThought(cold, `${rideName} was AMAZING!`);
    } else {
      g.xp[slot] = (g.xp[slot] as number) + XP.greatRide * 0.4;
      setEmote(g, slot, EMOTE.happy);
      pushThought(cold, `${rideName} was nice. Gentle, but nice.`);
    }
    if (exitTile !== null) {
      g.x[slot] = (exitTile % size) + 0.5;
      g.z[slot] = Math.floor(exitTile / size) + 0.5;
    } else {
      g.x[slot] = x + w / 2;
      g.z[slot] = z + d + 0.5;
    }
    g.state[slot] = GUEST_STATE.strolling;
    g.timer[slot] = world.rng.int(4, 14);
  }
  ride.riders.length = 0;
}
