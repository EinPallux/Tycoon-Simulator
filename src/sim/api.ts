/**
 * SimHandle — the ONLY surface render/ui may touch
 * (TECHNICAL_ARCHITECTURE.md §3–4): commands in, events + read-only world out.
 * Message-shaped by design so the sim can move into a Web Worker later
 * without an API rewrite.
 */

import { createEmitter, type Emitter } from "@/shared/events";
import {
  executeCommand,
  revertPatch,
  applyPatch,
  UNDO_DEPTH,
  type Command,
  type DispatchResult,
  type Patch,
} from "./commands";
import { serializeWorld } from "./save/serialize";
import type { SaveFile } from "./save/schema";
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

export function createSimHandle(world: World): SimHandle {
  const events = createEmitter<SimEvents>();
  const undoStack: Patch[] = [];
  const redoStack: Patch[] = [];

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

  return {
    world,
    events,
    tick(ticks) {
      const prevDay = dayOfTime(world.time);
      world.time += ticks;
      const day = dayOfTime(world.time);
      if (day !== prevDay) events.emit("day-changed", { day });
      // Phase 2 onward: the systems pipeline runs here
      // (spawning → movement → needs → economy → rating → …).
    },
    dispatch(cmd) {
      const result = executeCommand(world, cmd);
      if (!result.ok) {
        events.emit("command-rejected", { reason: result.reason });
        return result;
      }
      undoStack.push(result.patch);
      if (undoStack.length > UNDO_DEPTH) undoStack.shift();
      redoStack.length = 0;
      emitPatch(result.patch, false);
      emitStack();
      return result;
    },
    undo() {
      const patch = undoStack.pop();
      if (!patch) return false;
      revertPatch(world, patch);
      redoStack.push(patch);
      emitPatch(patch, true);
      emitStack();
      return true;
    },
    redo() {
      const patch = redoStack.pop();
      if (!patch) return false;
      applyPatch(world, patch);
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
