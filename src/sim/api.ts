/**
 * SimHandle — the ONLY surface render/ui may touch
 * (TECHNICAL_ARCHITECTURE.md §3–4): commands in, events + read-only world out.
 * Message-shaped by design so the sim can move into a Web Worker later
 * without an API rewrite.
 */

import { createEmitter, type Emitter } from "@/shared/events";
import { getPlaceableDef } from "@/content/catalog";
import {
  DIFFICULTY_PRESETS,
  type PlacedEntity,
  type World,
} from "./world/world";
import {
  HANGOVER_DAYS,
  HANGOVER_MULT,
  HANGOVER_RATING,
  MISS_PENALTY,
  MISS_RATING_XP,
  RELIABILITY_DECAY_PER_DAY,
  SEIZE_REFUND_RATE,
  STAFF_ROLES,
  type WeatherKind,
} from "./balance/phase3";
import { coasterCost } from "./coaster/coaster";
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
import { hasPerk, researchDailyTick } from "./research";
import { rideConfigOf } from "./rides";
import { serializeWorld } from "./save/serialize";
import type { SaveFile } from "./save/schema";
import { behaviorSystem } from "./systems/behavior";
import { needsSystem } from "./systems/needs";
import { opportunitiesDayTick, opportunitiesSystem } from "./systems/opportunities";
import { rideOpsSystem } from "./systems/rideOps";
import { resetSpawnWarnings, spawningSystem } from "./systems/spawning";
import { staffSystem } from "./systems/staff";
import { eventsSystem, weatherSystem } from "./systems/weather";
import { recomputeZones } from "./systems/zones";
import { DAYS_PER_WEEK, dayOfTime } from "./world/time";

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
  // ── Phase 3: coasters & chaos ──
  "weather-changed": { kind: WeatherKind };
  "ride-broken": { id: number; name: string };
  "ride-fixed": { id: number; name: string };
  "research-done": { nodeId: string; name: string };
  "park-over": { reason: string };
  // ── Phase 4: progression & polish ──
  "opportunity-offered": { text: string };
  "opportunity-completed": { text: string; rewardText: string };
  "opportunity-expired": { text: string };
  "zone-formed": { name: string; theme: string };
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
    // Zones derive from placeables — refresh on any entity change.
    if (added.length > 0 || removed.length > 0) {
      const { formed } = recomputeZones(world);
      for (const zone of formed) {
        events.emit("zone-formed", { name: zone.name, theme: zone.theme });
        events.emit("notify", {
          tone: "success",
          message: `🏰 A themed zone formed: ${zone.name}! Zone rides get +excitement.`,
        });
      }
    }
  };

  const runDayRollover = (newDay: number): void => {
    // Upkeep + daily wear for open rides.
    const upkeepMult = hasPerk(world, "efficient-ops") ? 0.85 : 1;
    for (const [id, ride] of world.rides) {
      ride.reliability = Math.max(0, ride.reliability - RELIABILITY_DECAY_PER_DAY);
      if (!ride.open) continue;
      if (!world.placeables.get(id)) continue;
      const cfg = rideConfigOf(world, id);
      if (cfg) addExpense(world, "upkeep", Math.round(cfg.runningPerDay * upkeepMult));
    }
    // With janitors on the payroll the overnight fairy retires.
    const hasJanitor = world.staff.some((s) => s.role === "janitor");
    if (world.litter.length > 0 && !hasJanitor) {
      world.litter.splice(0, Math.ceil(world.litter.length / 3));
    }
    // Weekly wages.
    if (newDay % DAYS_PER_WEEK === 1 && world.staff.length > 0) {
      let wages = 0;
      for (const staff of world.staff) wages += STAFF_ROLES[staff.role].wage;
      addExpense(world, "wages", wages);
      events.emit("notify", {
        tone: "info",
        message: `💼 Payday: $${(wages / 100).toFixed(0)} in wages for ${world.staff.length} staff.`,
      });
    }
    // Daily loan interest (APR by difficulty + tranche premiums).
    if (world.debt > 0) {
      const apr =
        DIFFICULTY_PRESETS[world.meta.difficulty].interestApr + world.loans.tranches * 0.015;
      const interest = Math.max(1, Math.round((world.debt * apr) / 364));
      if (world.cash >= interest) {
        addExpense(world, "interest", interest);
        world.loans.missedPayments = 0;
      } else {
        handleMissedPayment(interest);
      }
    }
    // Hold-style Opportunities advance on completed days.
    opportunitiesDayTick(world);
    // Research lab.
    const finished = researchDailyTick(world);
    if (finished) {
      world.tallies.researchCompleted++;
      events.emit("research-done", { nodeId: finished.id, name: finished.name });
      events.emit("notify", {
        tone: "success",
        message: `🔬 Research complete: ${finished.name} — ${finished.blurb}`,
      });
    }
    // Marketing campaign end + hangover.
    if (world.marketing.active && world.time >= world.marketing.active.endsAt) {
      world.marketing.active = null;
      if (world.rating.value < HANGOVER_RATING) {
        world.marketing.hangoverUntil = world.time + HANGOVER_DAYS * 900;
        events.emit("notify", {
          tone: "warning",
          message: `📉 The ads over-promised (rating < ${HANGOVER_RATING}) — expect a ${Math.round((1 - HANGOVER_MULT) * 100)}% arrival dip for ${HANGOVER_DAYS} days.`,
        });
      } else {
        events.emit("notify", { tone: "info", message: "📣 Marketing campaign wrapped up." });
      }
    }
    rolloverLedger(world, newDay);
    events.emit("cash-changed", { cash: world.cash });
    events.emit("day-changed", { day: newDay });
  };

  const handleMissedPayment = (interest: number): void => {
    world.loans.missedPayments++;
    world.cash -= MISS_PENALTY;
    noteExpense(world, "interest", MISS_PENALTY);
    for (let i = 0; i < world.guests.count; i++) {
      world.guests.xp[i] = (world.guests.xp[i] as number) + MISS_RATING_XP / 10;
    }
    if (world.loans.missedPayments < 3) {
      events.emit("notify", {
        tone: "danger",
        message: `🏦 You couldn't pay $${(interest / 100).toFixed(0)} interest (miss ${world.loans.missedPayments}/3). The bank added a $${(MISS_PENALTY / 100).toFixed(0)} penalty and is drafting strongly-worded letters.`,
      });
      return;
    }
    // Repossession: seize the most valuable asset, or fold the park.
    let bestId = -1;
    let bestValue = 0;
    for (const [id, entity] of world.placeables) {
      const def = getPlaceableDef(entity.defId);
      const coaster = world.coasters.get(id);
      const value = coaster ? coasterCost(coaster.family, coaster.pieces) : def.cost;
      if (value > bestValue) {
        bestValue = value;
        bestId = id;
      }
    }
    if (bestId >= 0 && bestValue > 0) {
      const entity = world.placeables.get(bestId);
      const name = entity ? getPlaceableDef(entity.defId).name : "an asset";
      const result = executeCommand(world, { type: "remove-entity", id: bestId });
      if (result.ok && result.patch) {
        // The bank keeps its cut of the auction.
        const refund = result.patch.cashDelta;
        const bankCut = Math.round(refund * (1 - SEIZE_REFUND_RATE));
        world.cash -= bankCut;
        const paydown = Math.min(world.debt, Math.round(refund * SEIZE_REFUND_RATE));
        world.debt -= paydown;
        world.cash -= paydown;
        world.loans.missedPayments = 2; // one more chance before the next seizure
        events.emit("entity-removed", { id: bestId });
        events.emit("notify", {
          tone: "danger",
          message: `🏦 The bank seized and auctioned ${name}! $${(paydown / 100).toFixed(0)} went to your debt. Pay your interest!`,
        });
        return;
      }
    }
    if (!world.loans.bankrupt) {
      world.loans.bankrupt = true;
      events.emit("park-over", {
        reason: "The bank owns the fun now — nothing left to seize and the interest keeps coming.",
      });
    }
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
        weatherSystem(world, events);
        eventsSystem(world, events);
        spawningSystem(world, events);
        behaviorSystem(world, events);
        rideOpsSystem(world, events);
        staffSystem(world);
        needsSystem(world);
        opportunitiesSystem(world, events);

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
      } else {
        // Settings commands may still move cash (loans, hires, repairs).
        events.emit("cash-changed", { cash: world.cash });
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
