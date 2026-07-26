/**
 * Guest behavior FSM (GAME_DESIGN.md §5.3):
 * approach → enter (pay) → stroll ↔ travel → queue/buy/ride → … → leave.
 * Movement follows tile paths at walk speed with per-guest lateral jitter.
 */

import type { Emitter } from "@/shared/events";
import { getPlaceableDef } from "@/content/catalog";
import type { PlaceableDef } from "@/content/types";
import {
  LEAVE_HOUR,
  LITTER_CHANCE,
  BIN_RADIUS,
  MAX_LITTER,
  MOOD_LEAVE,
  NEED_LOW,
  RESTORE,
  BLADDER_PER_MEAL,
  BLADDER_PER_DRINK,
  WALK_SPEED,
  WALK_SPEED_TIRED,
  XP,
} from "../balance/guests";
import { VALUE_EMA_ALPHA } from "../balance/economy";
import { addExpense, addIncome } from "../economy";
import { EMOTE, GUEST_STATE, pushThought, removeGuest, setEmote } from "../entities/guests";
import { rideConfigOf } from "../rides";
import { adjacentPathTiles, findPath, isStrollable, queueChainFor } from "../world/pathfind";
import { rotatedFootprint } from "../validate";
import { timeOfDay01 } from "../world/time";
import type { World } from "../world/world";
import type { SimEvents } from "../api";

const TICK_DT = 0.1; // seconds per tick

/** Deterministic per-guest lateral jitter (−0.28..0.28). */
const jitterOf = (id: number, axis: 0 | 1): number => {
  let h = (id * 2654435761 + axis * 40503) >>> 0;
  h ^= h >> 13;
  return ((h % 1000) / 1000 - 0.5) * 0.56;
};

export function behaviorSystem(world: World, events: Emitter<SimEvents>): void {
  const g = world.guests;
  const leaveTime =
    timeOfDay01(world.time) > LEAVE_HOUR ||
    timeOfDay01(world.time) < 0.3 ||
    world.weather.current === "storm";

  // Iterate backwards: removals swap from the end.
  for (let i = g.count - 1; i >= 0; i--) {
    const id = g.ids[i] as number;
    const cold = g.cold.get(id);
    if (!cold) continue;

    switch (g.state[i]) {
      case GUEST_STATE.approaching:
        stepApproaching(world, events, i, id);
        break;
      case GUEST_STATE.strolling:
        stepStrolling(world, i, id, leaveTime);
        break;
      case GUEST_STATE.traveling:
        stepTraveling(world, events, i, id);
        break;
      case GUEST_STATE.buying:
        stepBuying(world, events, i, id);
        break;
      case GUEST_STATE.leaving:
        stepLeaving(world, i, id);
        break;
      case GUEST_STATE.departing:
        stepDeparting(world, events, i, id);
        break;
      // queuing + riding are advanced by rideOps.
    }
  }
}

// ── Movement helpers ─────────────────────────────────────────────────────

function moveToward(world: World, slot: number, tx: number, tz: number): boolean {
  const g = world.guests;
  const speed =
    ((g.energy[slot] as number) < 20 ? WALK_SPEED_TIRED : WALK_SPEED) * TICK_DT;
  const dx = tx - (g.x[slot] as number);
  const dz = tz - (g.z[slot] as number);
  const dist = Math.hypot(dx, dz);
  if (dist <= speed) {
    g.x[slot] = tx;
    g.z[slot] = tz;
    return true;
  }
  g.x[slot] = (g.x[slot] as number) + (dx / dist) * speed;
  g.z[slot] = (g.z[slot] as number) + (dz / dist) * speed;
  g.heading[slot] = Math.atan2(dx, dz);
  return false;
}

/** Advance along cold.path; returns true when the final tile is reached. */
function followPath(world: World, slot: number, id: number): boolean {
  const g = world.guests;
  const cold = g.cold.get(id);
  if (!cold || cold.path.length === 0) return true;
  const size = world.tiles.size;
  const idx = cold.path[Math.min(cold.pathStep, cold.path.length - 1)] as number;
  const tx = (idx % size) + 0.5 + jitterOf(id, 0);
  const tz = Math.floor(idx / size) + 0.5 + jitterOf(id, 1);
  if (moveToward(world, slot, tx, tz)) {
    if (cold.pathStep >= cold.path.length - 1) {
      cold.path = [];
      cold.pathStep = 0;
      return true;
    }
    cold.pathStep++;
  }
  return false;
}

function guestTile(world: World, slot: number): number {
  const size = world.tiles.size;
  return (
    Math.floor(world.guests.z[slot] as number) * size + Math.floor(world.guests.x[slot] as number)
  );
}

// ── States ───────────────────────────────────────────────────────────────

function stepApproaching(
  world: World,
  events: Emitter<SimEvents>,
  slot: number,
  id: number,
): void {
  const g = world.guests;
  const ex = world.entrance.x + 0.5;
  const ez = world.entrance.z + 0.5;
  if (!moveToward(world, slot, ex + jitterOf(id, 0) * 0.5, ez)) return;

  // At the gate: pay entry, then step onto the park path.
  const cold = g.cold.get(id);
  if (!cold) return;
  const price = world.economy.entryPrice;
  cold.money -= price;
  addIncome(world, "entry", price);
  world.lifetimeGuests++;
  events.emit("sale", { source: "entry", cents: price, x: ex, z: ez });
  events.emit("guests-changed", { count: g.count, lifetime: world.lifetimeGuests });

  // Entry value verdict feeds the rating's value term.
  const fair = price <= (6 + 0.02 * world.rating.value) * 100 * 1.15;
  world.rating.valueEma =
    world.rating.valueEma * (1 - VALUE_EMA_ALPHA) + (fair ? 1 : 0) * VALUE_EMA_ALPHA;
  if (!fair) {
    g.xp[slot] = (g.xp[slot] as number) + XP.tooExpensive;
    setEmote(g, slot, EMOTE.expensive);
    pushThought(cold, `${formatMoneyLocal(price)} just to get in?!`);
  } else {
    pushThought(cold, "Here we go — best day ever!");
  }
  g.state[slot] = GUEST_STATE.strolling;
  g.timer[slot] = 6; // brief look-around
}

function stepStrolling(world: World, slot: number, id: number, leaveTime: boolean): void {
  const g = world.guests;
  const cold = g.cold.get(id);
  if (!cold) return;

  if ((g.timer[slot] as number) > 0) {
    g.timer[slot] = (g.timer[slot] as number) - 1;
    return;
  }

  // Time to go home?
  if (
    leaveTime ||
    (g.mood[slot] as number) < MOOD_LEAVE ||
    cold.money < 200
  ) {
    if (beginLeaving(world, slot, id)) return;
  }

  const goal = chooseGoal(world, slot, id);
  if (goal) {
    cold.target = goal.entityId;
    cold.path = goal.path;
    cold.pathStep = 0;
    g.state[slot] = GUEST_STATE.traveling;
    return;
  }

  // Nothing to do: wander to a random path tile nearby.
  const wander = randomStrollTarget(world, slot);
  if (wander) {
    cold.target = 0;
    cold.path = wander;
    cold.pathStep = 0;
    g.state[slot] = GUEST_STATE.traveling;
  } else {
    g.timer[slot] = 10;
  }
}

function stepTraveling(
  world: World,
  events: Emitter<SimEvents>,
  slot: number,
  id: number,
): void {
  const g = world.guests;
  if (!followPath(world, slot, id)) return;
  const cold = g.cold.get(id);
  if (!cold) return;

  // Litter awareness on arrival tiles (cheap, occasional).
  noticeLitter(world, slot);

  if (cold.target === 0) {
    g.state[slot] = GUEST_STATE.strolling;
    g.timer[slot] = world.rng.int(4, 16);
    return;
  }
  const entity = world.placeables.get(cold.target);
  if (!entity) {
    cold.target = 0;
    g.state[slot] = GUEST_STATE.strolling;
    return;
  }
  const def = getPlaceableDef(entity.defId);
  if (def.category === "ride") {
    const ride = world.rides.get(entity.id);
    const rideCfg = rideConfigOf(world, entity.id);
    if (!ride || !rideCfg || !ride.open || ride.phase === "broken") {
      cold.target = 0;
      g.state[slot] = GUEST_STATE.strolling;
      return;
    }
    const capacity = rideCfg.capacity;
    if (ride.queue.length >= capacity * 2 + 4 || cold.money < ride.price) {
      if (cold.money < ride.price) {
        g.xp[slot] = (g.xp[slot] as number) + XP.cantAfford;
        setEmote(g, slot, EMOTE.expensive);
        pushThought(cold, `${def.name} is beyond my budget…`);
      } else {
        g.xp[slot] = (g.xp[slot] as number) + XP.queueBail;
        pushThought(cold, `The line for ${def.name} is absurd.`);
      }
      cold.target = 0;
      g.state[slot] = GUEST_STATE.strolling;
      return;
    }
    ride.queue.push(id);
    g.state[slot] = GUEST_STATE.queuing;
    g.timer[slot] = 0;
    void events;
    return;
  }
  // Stalls, benches: stand and do the thing.
  g.state[slot] = GUEST_STATE.buying;
  g.timer[slot] = def.category === "stall" ? 22 : 40; // benches take longer
}

function stepBuying(world: World, events: Emitter<SimEvents>, slot: number, id: number): void {
  const g = world.guests;
  if ((g.timer[slot] as number) > 0) {
    g.timer[slot] = (g.timer[slot] as number) - 1;
    return;
  }
  const cold = g.cold.get(id);
  if (!cold) return;
  const entity = world.placeables.get(cold.target);
  cold.target = 0;
  g.state[slot] = GUEST_STATE.strolling;
  g.timer[slot] = 5;
  if (!entity) return;
  const def = getPlaceableDef(entity.defId);

  if (def.id === "scenery/bench") {
    g.energy[slot] = Math.min(100, (g.energy[slot] as number) + RESTORE.rest);
    return;
  }
  const stallCfg = def.stall;
  const stallState = world.stalls.get(entity.id);
  if (!stallCfg || !stallState) return;

  const price = stallState.price;
  if (price > 0 && cold.money < price) {
    g.xp[slot] = (g.xp[slot] as number) + XP.cantAfford;
    setEmote(g, slot, EMOTE.expensive);
    pushThought(cold, `I can't afford ${stallCfg.item.toLowerCase()}s anymore.`);
    return;
  }
  cold.money -= price;
  if (price > 0) {
    addIncome(world, "stalls", price);
    stallState.incomeToday += price;
  }
  addExpense(world, "goods", stallCfg.cogs);
  stallState.salesToday++;
  events.emit("sale", {
    source: "stalls",
    cents: price,
    x: g.x[slot] as number,
    z: g.z[slot] as number,
  });

  // Price verdict vs the item's reference price.
  const fair = price <= stallCfg.price * 1.3;
  world.rating.valueEma =
    world.rating.valueEma * (1 - VALUE_EMA_ALPHA) + (fair ? 1 : 0) * VALUE_EMA_ALPHA;
  if (!fair) {
    g.xp[slot] = (g.xp[slot] as number) + XP.tooExpensive;
    pushThought(cold, `${formatMoneyLocal(price)} for a ${stallCfg.item.toLowerCase()}?!`);
  }

  switch (stallCfg.satisfies) {
    case "hunger":
      g.hunger[slot] = Math.min(100, (g.hunger[slot] as number) + RESTORE.food);
      g.bladder[slot] = Math.min(100, (g.bladder[slot] as number) + BLADDER_PER_MEAL);
      g.xp[slot] = (g.xp[slot] as number) + XP.goodSnack;
      setEmote(g, slot, EMOTE.happy);
      pushThought(cold, `That ${stallCfg.item.toLowerCase()} hit the spot!`);
      dropLitter(world, slot, id);
      break;
    case "thirst":
      g.thirst[slot] = Math.min(100, (g.thirst[slot] as number) + RESTORE.drink);
      g.bladder[slot] = Math.min(100, (g.bladder[slot] as number) + BLADDER_PER_DRINK);
      g.xp[slot] = (g.xp[slot] as number) + XP.goodSnack;
      dropLitter(world, slot, id);
      break;
    case "bladder":
      g.bladder[slot] = 4;
      g.xp[slot] = (g.xp[slot] as number) + XP.toiletRelief;
      pushThought(cold, "Much better.");
      break;
    case "fun":
      g.fun[slot] = Math.min(100, (g.fun[slot] as number) + 22);
      g.xp[slot] = (g.xp[slot] as number) + XP.goodSnack;
      setEmote(g, slot, EMOTE.heart);
      pushThought(cold, `A ${stallCfg.item.toLowerCase()}! It's SO fluffy.`);
      break;
    case "info":
      g.fun[slot] = Math.min(100, (g.fun[slot] as number) + 6);
      setEmote(g, slot, EMOTE.idea);
      break;
  }
}

function stepLeaving(world: World, slot: number, id: number): void {
  if (!followPath(world, slot, id)) return;
  world.guests.state[slot] = GUEST_STATE.departing;
}

function stepDeparting(
  world: World,
  events: Emitter<SimEvents>,
  slot: number,
  id: number,
): void {
  const g = world.guests;
  const outX = world.entrance.x + 0.5 + jitterOf(id, 0);
  const outZ = world.entrance.z + 4.2;
  if (!moveToward(world, slot, outX, outZ)) return;
  removeGuest(g, id);
  events.emit("guests-changed", { count: g.count, lifetime: world.lifetimeGuests });
}

export function beginLeaving(world: World, slot: number, id: number): boolean {
  const g = world.guests;
  const cold = g.cold.get(id);
  if (!cold) return false;
  const size = world.tiles.size;
  const entranceIdx = world.entrance.z * size + world.entrance.x;
  const path = findPath(
    world,
    Math.floor(g.x[slot] as number),
    Math.floor(g.z[slot] as number),
    new Set([entranceIdx]),
    false,
  );
  if (!path) {
    // Stranded (path demolished under them): walk straight out anyway.
    g.state[slot] = GUEST_STATE.departing;
    return true;
  }
  cold.target = 0;
  cold.path = path;
  cold.pathStep = 0;
  g.state[slot] = GUEST_STATE.leaving;
  if ((g.mood[slot] as number) > 60) pushThought(cold, "What a day. I'll be back!");
  else pushThought(cold, "Heading home.");
  return true;
}

// ── Goal choice ──────────────────────────────────────────────────────────

interface Goal {
  entityId: number;
  path: number[];
}

function chooseGoal(world: World, slot: number, id: number): Goal | null {
  const g = world.guests;
  const cold = g.cold.get(id);
  if (!cold) return null;

  // Priority: urgent needs first, then fun.
  const tolerance = 3 + cold.thrill * 6;
  const wants: ((def: PlaceableDef, entityId: number) => boolean)[] = [];
  if ((g.bladder[slot] as number) > 100 - NEED_LOW)
    wants.push((d) => d.stall?.satisfies === "bladder");
  if ((g.hunger[slot] as number) < NEED_LOW) wants.push((d) => d.stall?.satisfies === "hunger");
  if ((g.thirst[slot] as number) < NEED_LOW) wants.push((d) => d.stall?.satisfies === "thirst");
  if ((g.energy[slot] as number) < NEED_LOW) wants.push((d) => d.id === "scenery/bench");
  // Fun: any ride (incl. coasters) within this guest's intensity comfort.
  wants.push((d, entityId) => {
    if (d.category !== "ride") return false;
    const cfg = rideConfigOf(world, entityId);
    return cfg !== null && cfg.intensity <= tolerance + 1.5;
  });

  for (const want of wants) {
    const candidates: { entityId: number; goals: Set<number> }[] = [];
    for (const entity of world.placeables.values()) {
      const def = getPlaceableDef(entity.defId);
      if (!want(def, entity.id)) continue;
      if (def.category === "ride") {
        const ride = world.rides.get(entity.id);
        if (!ride || !ride.open || ride.phase === "broken") continue;
        if (cold.money < ride.price) continue;
      }
      if (def.stall) {
        const stallState = world.stalls.get(entity.id);
        if (stallState && stallState.price > cold.money) continue;
      }
      const [w, d] = rotatedFootprint(def, entity.rot);
      const { chain, joinPath } =
        def.category === "ride"
          ? queueChainFor(world, entity.x, entity.z, w, d)
          : { chain: [], joinPath: null };
      const goals =
        chain.length > 0 && joinPath !== null
          ? new Set([joinPath])
          : adjacentPathTiles(world, entity.x, entity.z, w, d);
      if (goals.size === 0) continue;
      candidates.push({ entityId: entity.id, goals });
    }
    if (candidates.length === 0) continue;
    // Try up to 3 (rng-picked) candidates for a reachable path.
    for (let attempt = 0; attempt < Math.min(3, candidates.length); attempt++) {
      const pick = candidates[world.rng.int(0, candidates.length - 1)];
      if (!pick) break;
      const path = findPath(
        world,
        Math.floor(g.x[slot] as number),
        Math.floor(g.z[slot] as number),
        pick.goals,
      );
      if (path) return { entityId: pick.entityId, path };
    }
  }
  return null;
}

function randomStrollTarget(world: World, slot: number): number[] | null {
  const g = world.guests;
  const size = world.tiles.size;
  const cx = Math.floor(g.x[slot] as number);
  const cz = Math.floor(g.z[slot] as number);
  // Sample a few random path tiles in a radius; walk to the first reachable.
  for (let attempt = 0; attempt < 4; attempt++) {
    const tx = cx + world.rng.int(-7, 7);
    const tz = cz + world.rng.int(-7, 7);
    if (!isStrollable(world, tx, tz)) continue;
    const path = findPath(world, cx, cz, new Set([tz * size + tx]));
    if (path && path.length > 1) return path;
  }
  return null;
}

// ── Litter ───────────────────────────────────────────────────────────────

function binNearby(world: World, x: number, z: number): boolean {
  for (const entity of world.placeables.values()) {
    if (entity.defId !== "scenery/bin") continue;
    if (Math.hypot(entity.x + 0.5 - x, entity.z + 0.5 - z) <= BIN_RADIUS) return true;
  }
  return false;
}

function dropLitter(world: World, slot: number, id: number): void {
  const g = world.guests;
  const x = g.x[slot] as number;
  const z = g.z[slot] as number;
  if (binNearby(world, x, z)) return;
  if (!world.rng.chance(LITTER_CHANCE)) return;
  if (world.litter.length >= MAX_LITTER) return;
  world.litter.push({ idx: guestTile(world, slot), seed: (id * 7919) % 997 });
}

function noticeLitter(world: World, slot: number): void {
  const g = world.guests;
  const tile = guestTile(world, slot);
  let count = 0;
  for (const item of world.litter) if (item.idx === tile) count++;
  if (count > 0) {
    g.xp[slot] = (g.xp[slot] as number) + XP.litterSeen * Math.min(count, 3);
  }
}

const formatMoneyLocal = (cents: number): string => `$${Math.round(cents / 100)}`;
