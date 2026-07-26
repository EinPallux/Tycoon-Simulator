/**
 * Player commands — the ONLY entry points that mutate the world
 * (TECHNICAL_ARCHITECTURE.md §6). Every executed command produces a Patch:
 * a complete, data-only description of what changed (tiles, entities, cash),
 * which makes undo/redo a single generic apply/revert routine.
 */

import { getPlaceableDef, SURFACES } from "@/content/catalog";
import {
  CAMPAIGNS,
  CONTRACTOR_REPAIR_COST,
  CONTRACTOR_REPAIR_TICKS,
  CREDIT_LIMIT_RATE,
  LOAN_TRANCHE,
  MAX_STAFF,
  RENOVATE_COST_RATE,
  STAFF_ROLES,
  type CampaignKind,
  type StaffRole,
} from "./balance/phase3";
import {
  coasterCost,
  computeRun,
  computeStats,
  validateCircuit,
  type Coaster,
  type CoasterFamily,
  type PlacedPiece,
} from "./coaster/coaster";
import { pieceTiles } from "./coaster/pieces";
import { GUEST_STATE } from "./entities/guests";
import { hasPerk, isCoasterUnlocked, isDefUnlocked } from "./research";
import { canPlaceEntity, canPlaceSurface, footprintTiles } from "./validate";
import {
  SURFACE_NONE,
  SURFACE_PATH,
  SURFACE_QUEUE,
  tileIndex,
  type Surface,
} from "./world/tiles";
import { TICKS_PER_DAY } from "./world/time";
import type { PlacedEntity, RideState, StallState, World } from "./world/world";
import { TICKS_PER_SEC } from "./world/time";

export const UNDO_DEPTH = 20;
/** Full-refund grace window for demolishing scenery (GAME_DESIGN.md §4.1). */
export const REFUND_GRACE_TICKS = 30 * TICKS_PER_SEC;
export const DEMOLISH_REFUND = 0.5;

export type Command =
  | { type: "paint-surface"; surface: Surface; tiles: ReadonlyArray<readonly [number, number]> }
  | { type: "erase-surface"; tiles: ReadonlyArray<readonly [number, number]> }
  | { type: "place-entity"; defId: string; x: number; z: number; rot: number }
  | { type: "remove-entity"; id: number }
  | { type: "move-entity"; id: number; x: number; z: number; rot: number }
  | { type: "build-coaster"; family: CoasterFamily; pieces: PlacedPiece[] }
  // Settings commands — instant, not undoable (no Patch pushed).
  | { type: "set-ride-open"; id: number; open: boolean }
  | { type: "set-price"; id: number; price: number }
  | { type: "set-entry-price"; price: number }
  | { type: "hire-staff"; role: StaffRole }
  | { type: "fire-staff"; id: number }
  | { type: "set-research"; branch: "thrill" | "family" | "food" | "ops" | null }
  | { type: "set-research-funding"; level: number }
  | { type: "take-loan" }
  | { type: "repay-loan" }
  | { type: "start-campaign"; kind: CampaignKind }
  | { type: "call-repair"; id: number }
  | { type: "renovate-ride"; id: number };

export interface TileChange {
  idx: number;
  prev: number;
  next: number;
}

/** Complete reversible record of one executed command. */
export interface Patch {
  label: string;
  /** Applied to world.cash on do (negative = money spent). */
  cashDelta: number;
  tileChanges: TileChange[];
  entitiesAdded: PlacedEntity[];
  entitiesRemoved: PlacedEntity[];
  /** Runtime-state snapshots (rides/stalls) so undo & move keep settings. */
  rideSnapshots?: RideState[];
  stallSnapshots?: StallState[];
  /** Coaster records tied to station entities in this patch. */
  coasterSnapshots?: Coaster[];
}

export type DispatchResult =
  | { ok: true; patch: Patch }
  | { ok: true; patch: null } // settings command — nothing to undo
  | { ok: false; reason: string };

// ── Entity stamping & runtime state lifecycle ────────────────────────────

function stampEntity(world: World, e: PlacedEntity, value: number): void {
  const def = getPlaceableDef(e.defId);
  for (const [tx, tz] of footprintTiles(def, e.x, e.z, e.rot)) {
    world.tiles.occupant[tileIndex(world.tiles, tx, tz)] = value;
  }
}

function addEntity(world: World, e: PlacedEntity, patch?: Patch): void {
  world.placeables.set(e.id, e);
  stampEntity(world, e, e.id);
  const def = getPlaceableDef(e.defId);
  if ((def.ride || def.coasterFamily) && !world.rides.has(e.id)) {
    const snapshot = patch?.rideSnapshots?.find((s) => s.entityId === e.id);
    const coaster = patch?.coasterSnapshots?.find((c) => c.entityId === e.id);
    if (def.coasterFamily && coaster) world.coasters.set(e.id, coaster);
    const defaultTicket = def.ride?.ticket ?? 450;
    world.rides.set(
      e.id,
      snapshot
        ? { ...snapshot, riders: [], queue: [], phase: "idle", phaseT: 0, repairT: 0 }
        : {
            entityId: e.id,
            open: true,
            price: defaultTicket,
            phase: "idle",
            phaseT: 0,
            riders: [],
            queue: [],
            lifetimeRiders: 0,
            incomeToday: 0,
            reliability: 100,
            repairT: 0,
          },
    );
  }
  if (def.stall && !world.stalls.has(e.id)) {
    const snapshot = patch?.stallSnapshots?.find((s) => s.entityId === e.id);
    world.stalls.set(
      e.id,
      snapshot
        ? { ...snapshot }
        : { entityId: e.id, price: def.stall.price, salesToday: 0, incomeToday: 0 },
    );
  }
}

/** Send everyone attached to a ride back onto the paths. */
function releaseRideGuests(world: World, id: number): void {
  const ride = world.rides.get(id);
  if (!ride) return;
  const entity = world.placeables.get(id);
  for (const guestId of [...ride.queue, ...ride.riders]) {
    const slot = world.guests.slotOf.get(guestId);
    if (slot === undefined) continue;
    world.guests.state[slot] = GUEST_STATE.strolling;
    world.guests.timer[slot] = 0;
    if (entity) {
      world.guests.x[slot] = entity.x + 0.5;
      world.guests.z[slot] = entity.z + 1.5;
    }
    const cold = world.guests.cold.get(guestId);
    if (cold) cold.target = 0;
  }
  ride.queue.length = 0;
  ride.riders.length = 0;
}

function removeEntity(world: World, e: PlacedEntity): void {
  releaseRideGuests(world, e.id);
  world.rides.delete(e.id);
  world.stalls.delete(e.id);
  world.coasters.delete(e.id);
  // Guests heading here retarget on arrival (target lookup fails safely).
  world.placeables.delete(e.id);
  stampEntity(world, e, 0);
}

/** Capture runtime snapshots for entities a patch will remove. */
function snapshotRuntime(world: World, entities: PlacedEntity[], patch: Patch): void {
  for (const e of entities) {
    const ride = world.rides.get(e.id);
    if (ride) {
      (patch.rideSnapshots ??= []).push({ ...ride, riders: [], queue: [] });
    }
    const stall = world.stalls.get(e.id);
    if (stall) (patch.stallSnapshots ??= []).push({ ...stall });
    const coaster = world.coasters.get(e.id);
    if (coaster) (patch.coasterSnapshots ??= []).push(coaster);
  }
}

// ── Command execution ────────────────────────────────────────────────────

export function executeCommand(world: World, cmd: Command): DispatchResult {
  switch (cmd.type) {
    case "paint-surface":
      return execPaintSurface(world, cmd.surface, cmd.tiles);
    case "erase-surface":
      return execEraseSurface(world, cmd.tiles);
    case "place-entity":
      return execPlaceEntity(world, cmd.defId, cmd.x, cmd.z, cmd.rot);
    case "build-coaster":
      return execBuildCoaster(world, cmd.family, cmd.pieces);
    case "remove-entity":
      return execRemoveEntity(world, cmd.id);
    case "move-entity":
      return execMoveEntity(world, cmd.id, cmd.x, cmd.z, cmd.rot);
    case "set-ride-open": {
      const ride = world.rides.get(cmd.id);
      if (!ride) return { ok: false, reason: "No such ride" };
      ride.open = cmd.open;
      return { ok: true, patch: null };
    }
    case "set-price": {
      const price = Math.max(0, Math.round(cmd.price));
      const ride = world.rides.get(cmd.id);
      if (ride) {
        ride.price = price;
        return { ok: true, patch: null };
      }
      const stall = world.stalls.get(cmd.id);
      if (stall) {
        stall.price = price;
        return { ok: true, patch: null };
      }
      return { ok: false, reason: "Nothing priceable selected" };
    }
    case "set-entry-price": {
      world.economy.entryPrice = Math.max(0, Math.round(cmd.price));
      return { ok: true, patch: null };
    }
    case "hire-staff": {
      if (world.staff.length >= MAX_STAFF) return { ok: false, reason: "The break room is full" };
      const role = STAFF_ROLES[cmd.role];
      if (world.cash < role.hireFee) return { ok: false, reason: "Not enough cash" };
      world.cash -= role.hireFee;
      const names = ["Bo", "Ada", "Gus", "Fern", "Ivo", "Sal", "Pim", "Uma", "Rex", "Lia"];
      const name = `${world.rng.pick(names)} (${role.name})`;
      world.staff.push({
        id: world.staffIds.nextId(),
        role: cmd.role,
        name,
        x: world.entrance.x + 0.5,
        z: world.entrance.z - 0.5,
        px: world.entrance.x + 0.5,
        pz: world.entrance.z - 0.5,
        heading: 0,
        path: [],
        pathStep: 0,
        jobTarget: -1,
        workT: 0,
        hiredDay: Math.floor(world.time / TICKS_PER_DAY) + 1,
        jobsDone: 0,
      });
      return { ok: true, patch: null };
    }
    case "fire-staff": {
      const index = world.staff.findIndex((s) => s.id === cmd.id);
      if (index === -1) return { ok: false, reason: "They already left" };
      world.staff.splice(index, 1);
      return { ok: true, patch: null };
    }
    case "set-research": {
      world.research.active = cmd.branch;
      world.research.progressDays = 0;
      return { ok: true, patch: null };
    }
    case "set-research-funding": {
      world.research.funding = Math.max(0, Math.min(2, Math.round(cmd.level)));
      return { ok: true, patch: null };
    }
    case "take-loan": {
      const parkValue = computeParkValue(world);
      const limit = Math.round(parkValue * CREDIT_LIMIT_RATE);
      if (world.debt + LOAN_TRANCHE > limit + 1_000_000) {
        return { ok: false, reason: "The bank says your park isn't worth that much (yet)" };
      }
      world.debt += LOAN_TRANCHE;
      world.loans.tranches++;
      world.cash += LOAN_TRANCHE;
      return { ok: true, patch: null };
    }
    case "repay-loan": {
      if (world.debt <= 0) return { ok: false, reason: "You're debt-free already!" };
      const amount = Math.min(LOAN_TRANCHE, world.debt);
      if (world.cash < amount) return { ok: false, reason: "Not enough cash" };
      world.cash -= amount;
      world.debt -= amount;
      if (world.loans.tranches > 0) world.loans.tranches--;
      return { ok: true, patch: null };
    }
    case "start-campaign": {
      if (!hasPerk(world, "marketing"))
        return { ok: false, reason: "Research the Marketing Licence first (Operations)" };
      if (world.marketing.active) return { ok: false, reason: "A campaign is already running" };
      const campaign = CAMPAIGNS[cmd.kind];
      if (world.cash < campaign.cost) return { ok: false, reason: "Not enough cash" };
      world.cash -= campaign.cost;
      world.economy.today.expense.marketing += campaign.cost;
      world.economy.lifetimeExpense += campaign.cost;
      world.marketing.active = {
        kind: cmd.kind,
        endsAt: world.time + campaign.days * TICKS_PER_DAY,
      };
      return { ok: true, patch: null };
    }
    case "call-repair": {
      const ride = world.rides.get(cmd.id);
      if (!ride || ride.phase !== "broken") return { ok: false, reason: "Nothing to repair" };
      if (ride.repairT > 0) return { ok: false, reason: "Help is already on the way" };
      if (world.cash < CONTRACTOR_REPAIR_COST) return { ok: false, reason: "Not enough cash" };
      world.cash -= CONTRACTOR_REPAIR_COST;
      world.economy.today.expense.repairs += CONTRACTOR_REPAIR_COST;
      world.economy.lifetimeExpense += CONTRACTOR_REPAIR_COST;
      ride.repairT = CONTRACTOR_REPAIR_TICKS;
      return { ok: true, patch: null };
    }
    case "renovate-ride": {
      const ride = world.rides.get(cmd.id);
      const entity = world.placeables.get(cmd.id);
      if (!ride || !entity) return { ok: false, reason: "Nothing selected" };
      const def = getPlaceableDef(entity.defId);
      const coaster = world.coasters.get(cmd.id);
      const baseCost = coaster ? coasterCost(coaster.family, coaster.pieces) : def.cost;
      const cost = Math.round(baseCost * RENOVATE_COST_RATE);
      if (world.cash < cost) return { ok: false, reason: "Not enough cash" };
      world.cash -= cost;
      world.economy.today.expense.repairs += cost;
      world.economy.lifetimeExpense += cost;
      ride.reliability = 100;
      if (ride.phase === "broken") {
        ride.phase = "idle";
        ride.repairT = 0;
      }
      return { ok: true, patch: null };
    }
  }
}

export function computeParkValue(world: World): number {
  let value = Math.max(0, world.cash);
  for (const entity of world.placeables.values()) {
    value += getPlaceableDef(entity.defId).cost;
  }
  for (const coaster of world.coasters.values()) {
    value += coasterCost(coaster.family, coaster.pieces);
  }
  return value;
}

function execBuildCoaster(
  world: World,
  family: CoasterFamily,
  pieces: PlacedPiece[],
): DispatchResult {
  if (!isCoasterUnlocked(world, family)) {
    return { ok: false, reason: "Research this coaster type first" };
  }
  const circuit = validateCircuit(world, pieces);
  if (!circuit.ok) return { ok: false, reason: circuit.reason ?? "Invalid circuit" };

  const cost = coasterCost(family, pieces);
  if (world.cash < cost) return { ok: false, reason: "Not enough cash" };

  // The station occupies its two tiles as a regular placeable.
  const station = pieces[0] as PlacedPiece;
  const tiles = pieceTiles(station);
  const minX = Math.min(...tiles.map((t) => t[0]));
  const minZ = Math.min(...tiles.map((t) => t[1]));
  const defId = family === "mouse" ? "coaster/mouse" : "coaster/flume";
  const rot = station.entry.dir;
  const verdict = canPlaceEntity(world, defId, minX, minZ, rot);
  if (!verdict.ok) return { ok: false, reason: `Station: ${verdict.reason}` };

  const entity: PlacedEntity = {
    id: world.placeableIds.nextId(),
    defId,
    x: minX,
    z: minZ,
    rot,
    placedAt: world.time,
  };
  const run = computeRun(pieces);
  const coaster: Coaster = {
    entityId: entity.id,
    family,
    pieces,
    stats: computeStats(family, pieces),
    pieceSpeeds: run.pieceSpeeds,
    pieceTimes: run.pieceTimes,
    totalTime: run.totalTime,
  };
  const patch: Patch = {
    label: `Build ${family === "mouse" ? "Wild Mouse" : "Log Flume"} coaster`,
    cashDelta: -cost,
    tileChanges: [],
    entitiesAdded: [entity],
    entitiesRemoved: [],
    coasterSnapshots: [coaster],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execPaintSurface(
  world: World,
  surface: Surface,
  tiles: ReadonlyArray<readonly [number, number]>,
): DispatchResult {
  if (surface !== SURFACE_PATH && surface !== SURFACE_QUEUE)
    return { ok: false, reason: "Invalid surface" };
  const surfaceDef = surface === SURFACE_PATH ? SURFACES.path : SURFACES.queue;
  const changes: TileChange[] = [];
  const seen = new Set<number>();
  for (const [x, z] of tiles) {
    const verdict = canPlaceSurface(world, x, z, surface);
    if (!verdict.ok) continue; // skip invalid tiles inside a drag stroke
    const idx = tileIndex(world.tiles, x, z);
    if (seen.has(idx)) continue;
    seen.add(idx);
    changes.push({ idx, prev: SURFACE_NONE, next: surface });
  }
  if (changes.length === 0) return { ok: false, reason: "Nothing to build there" };
  const cost = changes.length * surfaceDef.costPerTile;
  if (world.cash < cost) return { ok: false, reason: "Not enough cash" };
  const patch: Patch = {
    label: `Build ${surfaceDef.name} ×${changes.length}`,
    cashDelta: -cost,
    tileChanges: changes,
    entitiesAdded: [],
    entitiesRemoved: [],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execEraseSurface(
  world: World,
  tiles: ReadonlyArray<readonly [number, number]>,
): DispatchResult {
  const changes: TileChange[] = [];
  const seen = new Set<number>();
  let refund = 0;
  for (const [x, z] of tiles) {
    const idx = tileIndex(world.tiles, x, z);
    if (seen.has(idx)) continue;
    const current = world.tiles.surface[idx] ?? SURFACE_NONE;
    if (current === SURFACE_NONE) continue;
    seen.add(idx);
    const surfaceDef = current === SURFACE_PATH ? SURFACES.path : SURFACES.queue;
    refund += Math.round(surfaceDef.costPerTile * DEMOLISH_REFUND);
    changes.push({ idx, prev: current, next: SURFACE_NONE });
  }
  if (changes.length === 0) return { ok: false, reason: "Nothing to remove there" };
  const patch: Patch = {
    label: `Remove path ×${changes.length}`,
    cashDelta: refund,
    tileChanges: changes,
    entitiesAdded: [],
    entitiesRemoved: [],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execPlaceEntity(
  world: World,
  defId: string,
  x: number,
  z: number,
  rot: number,
): DispatchResult {
  const def = getPlaceableDef(defId);
  if (def.coasterFamily) return { ok: false, reason: "Coasters are built with the track builder" };
  if (!isDefUnlocked(world, def)) return { ok: false, reason: "Research this first" };
  const verdict = canPlaceEntity(world, defId, x, z, rot);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const entity: PlacedEntity = {
    id: world.placeableIds.nextId(),
    defId,
    x,
    z,
    rot,
    placedAt: world.time,
  };
  const patch: Patch = {
    label: `Place ${def.name}`,
    cashDelta: -def.cost,
    tileChanges: [],
    entitiesAdded: [entity],
    entitiesRemoved: [],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execRemoveEntity(world: World, id: number): DispatchResult {
  const entity = world.placeables.get(id);
  if (!entity) return { ok: false, reason: "Nothing selected" };
  const def = getPlaceableDef(entity.defId);
  const withinGrace = world.time - entity.placedAt <= REFUND_GRACE_TICKS;
  const refundRate = def.category === "scenery" && withinGrace ? 1 : DEMOLISH_REFUND;
  const coaster = world.coasters.get(id);
  const baseValue = coaster ? coasterCost(coaster.family, coaster.pieces) : def.cost;
  const patch: Patch = {
    label: `Demolish ${def.name}`,
    cashDelta: Math.round(baseValue * refundRate),
    tileChanges: [],
    entitiesAdded: [],
    entitiesRemoved: [entity],
  };
  snapshotRuntime(world, [entity], patch);
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execMoveEntity(
  world: World,
  id: number,
  x: number,
  z: number,
  rot: number,
): DispatchResult {
  const entity = world.placeables.get(id);
  if (!entity) return { ok: false, reason: "Nothing selected" };
  if (world.coasters.has(id))
    return { ok: false, reason: "Coaster track is anchored — demolish and rebuild instead" };
  const def = getPlaceableDef(entity.defId);
  // Temporarily lift the entity so it doesn't collide with itself.
  stampEntity(world, entity, 0);
  const verdict = canPlaceEntity(world, entity.defId, x, z, rot);
  stampEntity(world, entity, entity.id);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const withinGrace = world.time - entity.placedAt <= REFUND_GRACE_TICKS;
  const moveCost = withinGrace ? 0 : Math.round(def.cost * 0.1);
  if (world.cash < moveCost) return { ok: false, reason: "Not enough cash" };
  const moved: PlacedEntity = { ...entity, x, z, rot };
  const patch: Patch = {
    label: `Move ${def.name}`,
    cashDelta: -moveCost,
    tileChanges: [],
    entitiesAdded: [moved],
    entitiesRemoved: [entity],
  };
  snapshotRuntime(world, [entity], patch);
  applyPatch(world, patch);
  return { ok: true, patch };
}

// ── Generic patch apply / revert (single undo implementation) ────────────

export function applyPatch(world: World, patch: Patch): void {
  world.cash += patch.cashDelta;
  for (const c of patch.tileChanges) world.tiles.surface[c.idx] = c.next;
  for (const e of patch.entitiesRemoved) removeEntity(world, e);
  for (const e of patch.entitiesAdded) addEntity(world, e, patch);
}

export function revertPatch(world: World, patch: Patch): void {
  world.cash -= patch.cashDelta;
  for (const c of patch.tileChanges) world.tiles.surface[c.idx] = c.prev;
  for (const e of patch.entitiesAdded) removeEntity(world, e);
  for (const e of patch.entitiesRemoved) addEntity(world, e, patch);
}
