/**
 * SimHandle — the ONLY surface render/ui may touch
 * (TECHNICAL_ARCHITECTURE.md §3–4): commands in, events + read-only world out.
 * Message-shaped by design so the sim can move into a Web Worker later
 * without an API rewrite.
 */

import { createEmitter, type Emitter } from "@/shared/events";
import { getPlaceableDef } from "@/content/catalog";
import {
  executeCommand,
  revertPatch,
  applyPatch,
  UNDO_DEPTH,
  type Command,
  type DispatchResult,
  type Patch,
} from "./commands";
import { addExpense, noteExpense, noteIncome, rolloverLedger } from "./economy";
import { checkMilestones, computeRating, MILESTONES } from "./rating";
import { serializeWorld } from "./save/serialize";
import type { SaveFile } from "./save/schema";
import { behaviorSystem } from "./systems/behavior";
import { needsSystem } from "./systems/needs";
import { rideOpsSystem } from "./systems/rideOps";
import { resetSpawnWarnings, spawningSystem } from "./systems/spawning";
import { dayOfTime } from "./world/time";
import type { PlacedEntity, World } from "./world/world";

export interface SimEvents {
  "entity-added": { entity: PlacedEntity };
  "entity-removed": { id: number };
  /** Tile indices whose surface changed (auto-tiling re-renders neighbors too). */
  "surface-changed": { indices: number[] };
  "cash-changed": { cash: number };
  "day-changed": { day: number };
  "stack-changed": { undo: number; redo: number };
  "command-rejected": { reason: string };
  // ── Phase 2: the living park ──
  "sale": { source: "entry" | "rides" | "stalls"; cents: number; x: number; z: number };
  "guests-changed": { count: number; lifetime: number };
  "rating-changed": { value: number };
  "milestone": { tier: number; name: string; award: number };
  "notify": { tone: "info" | "success" | "warning" | "danger"; message: string };
}

export interface SimHandle {
  readonly world: World;
  readonly events: Emitter<SimEvents>;
  /** Advance the simulation by whole ticks. */
  tick(ticks: number): void;
  dispatch(cmd: Command): DispatchResult;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  serialize(): SaveFile;
}

const RATING_CADENCE = 20; // recompute every 2 s of sim time

export function createSimHandle(world: World): SimHandle {
  const events = createEmitter<SimEvents>();
  const undoStack: Patch[] = [];
  const redoStack: Patch[] = [];
  resetSpawnWarnings();

  const emitStack = (): void =>
    events.emit("stack-changed", { undo: undoStack.length, redo: redoStack.length });

  const emitPatch = (patch: Patch, reverted: boolean): void => {
    const added = reverted ? patch.entitiesRemoved : patch.entitiesAdded;
    const removed = reverted ? patch.entitiesAdded : patch.entitiesRemoved;
    for (const e of removed) events.emit("entity-removed", { id: e.id });
    for (const e of added) events.emit("entity-added", { entity: e });
    if (patch.tileChanges.length > 0) {
      events.emit("surface-changed", { indices: patch.tileChanges.map((c) => c.idx) });
    }
    if (patch.cashDelta !== 0) events.emit("cash-changed", { cash: world.cash });
  };

  const runDayRollover = (newDay: number): void => {
    // Upkeep for open rides.
    for (const [id, ride] of world.rides) {
      if (!ride.open) continue;
      const entity = world.placeables.get(id);
      if (!entity) continue;
      const cfg = getPlaceableDef(entity.defId).ride;
      if (cfg) addExpense(world, "upkeep", cfg.runningPerDay);
    }
    // Overnight cleaning fairy trims a third of the litter (janitors: Phase 3).
    if (world.litter.length > 0) {
      world.litter.splice(0, Math.ceil(world.litter.length / 3));
    }
    rolloverLedger(world, newDay);
    events.emit("cash-changed", { cash: world.cash });
    events.emit("day-changed", { day: newDay });
  };

  return {
    world,
    events,
    tick(ticks) {
      for (let t = 0; t < ticks; t++) {
        const prevDay = dayOfTime(world.time);
        world.time += 1;

        // Interpolation baseline: previous-tick positions.
        const g = world.guests;
        g.px.set(g.x.subarray(0, g.count));
        g.pz.set(g.z.subarray(0, g.count));

        // Systems pipeline (TECHNICAL_ARCHITECTURE §5).
        spawningSystem(world, events);
        behaviorSystem(world, events);
        rideOpsSystem(world, events);
        needsSystem(world);

        if (world.time % RATING_CADENCE === 0) {
          const before = world.rating.value;
          computeRating(world);
          if (world.rating.value !== before) {
            events.emit("rating-changed", { value: world.rating.value });
          }
          const tier = checkMilestones(world);
          if (tier >= 0) {
            const milestone = MILESTONES[tier];
            if (milestone) {
              // Award moves cash directly; kept out of the operating P&L.
              world.cash += milestone.award;
              events.emit("cash-changed", { cash: world.cash });
              events.emit("milestone", { tier, name: milestone.name, award: milestone.award });
            }
          }
        }

        const day = dayOfTime(world.time);
        if (day !== prevDay) runDayRollover(day);
      }
    },
    dispatch(cmd) {
      const result = executeCommand(world, cmd);
      if (!result.ok) {
        events.emit("command-rejected", { reason: result.reason });
        return result;
      }
      if (result.patch) {
        // Ledger reporting for build cash-flow.
        if (result.patch.cashDelta < 0) {
          noteExpense(world, "construction", -result.patch.cashDelta);
        } else if (result.patch.cashDelta > 0) {
          noteIncome(world, "refunds", result.patch.cashDelta);
        }
        undoStack.push(result.patch);
        if (undoStack.length > UNDO_DEPTH) undoStack.shift();
        redoStack.length = 0;
        emitPatch(result.patch, false);
        emitStack();
      }
      return result;
    },
    undo() {
      const patch = undoStack.pop();
      if (!patch) return false;
      revertPatch(world, patch);
      if (patch.cashDelta < 0) noteIncome(world, "refunds", -patch.cashDelta);
      else if (patch.cashDelta > 0) noteExpense(world, "construction", patch.cashDelta);
      redoStack.push(patch);
      emitPatch(patch, true);
      emitStack();
      return true;
    },
    redo() {
      const patch = redoStack.pop();
      if (!patch) return false;
      applyPatch(world, patch);
      if (patch.cashDelta < 0) noteExpense(world, "construction", -patch.cashDelta);
      else if (patch.cashDelta > 0) noteIncome(world, "refunds", patch.cashDelta);
      undoStack.push(patch);
      emitPatch(patch, false);
      emitStack();
      return true;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    serialize: () => serializeWorld(world),
  };
}
