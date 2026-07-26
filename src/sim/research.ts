/**
 * Research state helpers: unlock checks, perk flags, and the daily tick
 * (funding → progress-days → node completion).
 */

import {
  FUNDING_LEVELS,
  RESEARCH_BRANCHES,
  RESEARCH_GATED_SCENERY,
  STARTER_UNLOCKS,
  type ResearchNode,
} from "@/content/research";
import type { PlaceableDef } from "@/content/types";
import { addExpense } from "./economy";
import type { CoasterFamily } from "./coaster/coaster";
import type { World } from "./world/world";

export const hasPerk = (world: World, perk: string): boolean =>
  world.research.perks.includes(perk);

/** Everything a completed node granted, unioned across all branches. */
function unlockedIds(world: World): Set<string> {
  const ids = new Set<string>(STARTER_UNLOCKS);
  for (const branch of RESEARCH_BRANCHES) {
    const doneCount = world.research.done[branch.id];
    for (let i = 0; i < doneCount; i++) {
      const node = branch.nodes[i];
      if (node?.unlocks) for (const id of node.unlocks) ids.add(id);
    }
  }
  return ids;
}

export function isDefUnlocked(world: World, def: PlaceableDef): boolean {
  if (world.meta.freeplayUnlocks) return true;
  if (def.category === "scenery" && !RESEARCH_GATED_SCENERY.has(def.id)) return true;
  if (def.category === "stall" || def.category === "ride" || RESEARCH_GATED_SCENERY.has(def.id)) {
    return unlockedIds(world).has(def.id);
  }
  return true;
}

export function isCoasterUnlocked(world: World, family: CoasterFamily): boolean {
  if (world.meta.freeplayUnlocks) return true;
  for (const branch of RESEARCH_BRANCHES) {
    const doneCount = world.research.done[branch.id];
    for (let i = 0; i < doneCount; i++) {
      if (branch.nodes[i]?.unlocksCoasters?.includes(family)) return true;
    }
  }
  return false;
}

/** The node currently being researched (null when branch done/absent). */
export function activeNode(world: World): ResearchNode | null {
  const branchId = world.research.active;
  if (!branchId) return null;
  const branch = RESEARCH_BRANCHES.find((b) => b.id === branchId);
  if (!branch) return null;
  return branch.nodes[world.research.done[branchId]] ?? null;
}

/** Called once per day rollover; returns a completed node (for the toast). */
export function researchDailyTick(world: World): ResearchNode | null {
  const funding = FUNDING_LEVELS[world.research.funding] ?? FUNDING_LEVELS[1];
  const node = activeNode(world);
  if (!node || funding.speed === 0) return null;
  if (world.cash < funding.perDay) return null; // can't afford the lab today
  addExpense(world, "research", funding.perDay);
  world.research.progressDays += funding.speed;
  if (world.research.progressDays >= node.days) {
    world.research.progressDays = 0;
    const branchId = world.research.active;
    if (branchId) world.research.done[branchId]++;
    if (node.perk) world.research.perks.push(node.perk);
    return node;
  }
  return null;
}
