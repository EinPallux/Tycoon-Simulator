/**
 * Opportunities engine (GAME_DESIGN.md §13): optional generated goals with
 * rewards. At most 2 active + 1 offered; offers surface every 2–4 game-days
 * (rating-scaled), expire quietly, and NEVER punish. Completion = fanfare.
 */

import type { Emitter } from "@/shared/events";
import { GOAL_TEMPLATES, goalTemplateById, type GoalTemplate } from "@/content/goals";
import { CAMPAIGNS } from "../balance/phase3";
import { TICKS_PER_DAY } from "../world/time";
import type { Opportunity, World } from "../world/world";
import type { SimEvents } from "../api";

const CHECK_EVERY = 50; // ticks (5 s) — cheap measures, snappy completion
const OFFER_LIFETIME = Math.round(TICKS_PER_DAY * 1.5);
const MAX_ACTIVE = 2;

export function opportunitiesSystem(world: World, events: Emitter<SimEvents>): void {
  if (world.time % CHECK_EVERY !== 0) return;
  const opp = world.opportunities;

  // Offer expiry — quiet, no drama.
  if (opp.offered && world.time >= opp.offerExpiresAt) {
    opp.offered = null;
    scheduleNext(world, 0.6);
  }

  // New offer?
  if (!opp.offered && world.time >= opp.nextOfferAt && opp.active.length < MAX_ACTIVE + 1) {
    const rolled = rollOffer(world);
    if (rolled) {
      opp.offered = rolled;
      opp.offerExpiresAt = world.time + OFFER_LIFETIME;
      events.emit("opportunity-offered", { text: rolled.text });
      events.emit("notify", {
        tone: "info",
        message: `💡 Opportunity: ${rolled.text} — check the Goals panel.`,
      });
    }
    scheduleNext(world, 1);
  }

  // Progress + completion + deadline expiry for active goals.
  for (let i = opp.active.length - 1; i >= 0; i--) {
    const active = opp.active[i] as Opportunity;
    const template = goalTemplateById(active.templateId);
    if (!template) {
      opp.active.splice(i, 1);
      continue;
    }
    if (isComplete(world, active, template)) {
      opp.active.splice(i, 1);
      opp.completed++;
      world.tallies.opportunitiesDone++;
      const rewardText = grantReward(world, active);
      events.emit("opportunity-completed", { text: active.text, rewardText });
      events.emit("notify", {
        tone: "success",
        message: `🎯 Opportunity complete: ${active.text}! Reward: ${rewardText}`,
      });
      continue;
    }
    if (active.deadlineAt > 0 && world.time >= active.deadlineAt) {
      opp.active.splice(i, 1);
      events.emit("opportunity-expired", { text: active.text });
      events.emit("notify", {
        tone: "info",
        message: `⏳ The moment passed: “${active.text}”. No harm done.`,
      });
    }
  }
}

/** Day-rollover hook: advance hold-days goals. */
export function opportunitiesDayTick(world: World): void {
  for (const active of world.opportunities.active) {
    if (active.kind !== "hold-days") continue;
    const template = goalTemplateById(active.templateId);
    if (!template?.holds) continue;
    active.progress = template.holds(world) ? active.progress + 1 : 0;
  }
}

export function isComplete(world: World, opp: Opportunity, template: GoalTemplate): boolean {
  switch (opp.kind) {
    case "reach":
      return template.measure(world, opp.baseline) >= opp.target;
    case "delta":
      return template.measure(world, opp.baseline) - opp.baseline >= opp.target;
    case "hold-days":
      return opp.progress >= opp.target;
  }
}

/** Displayed progress 0..1 for the Goals panel. */
export function opportunityProgress01(world: World, opp: Opportunity): number {
  const template = goalTemplateById(opp.templateId);
  if (!template) return 0;
  switch (opp.kind) {
    case "reach":
      return clamp01(template.measure(world, opp.baseline) / Math.max(1e-6, opp.target));
    case "delta":
      return clamp01(
        (template.measure(world, opp.baseline) - opp.baseline) / Math.max(1e-6, opp.target),
      );
    case "hold-days":
      return clamp01(opp.progress / Math.max(1, opp.target));
  }
}

export function opportunityProgressLabel(world: World, opp: Opportunity): string {
  const template = goalTemplateById(opp.templateId);
  if (!template) return "";
  const value =
    opp.kind === "hold-days"
      ? opp.progress
      : opp.kind === "delta"
        ? template.measure(world, opp.baseline) - opp.baseline
        : template.measure(world, opp.baseline);
  return template.format(Math.max(0, value), opp.target);
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function scheduleNext(world: World, factor: number): void {
  // 2–4 days, arriving a bit faster in higher-rated (busier) parks.
  const ratingScale = 1 - Math.min(0.35, world.rating.value / 2000);
  const days = (2 + world.rng.next() * 2) * ratingScale * factor;
  world.opportunities.nextOfferAt = world.time + Math.round(days * TICKS_PER_DAY);
}

export function rollOffer(world: World): Opportunity | null {
  const opp = world.opportunities;
  const activeIds = new Set(opp.active.map((a) => a.templateId));
  const eligible = GOAL_TEMPLATES.filter((t) => !activeIds.has(t.id) && t.eligible(world));
  if (eligible.length === 0) return null;
  const template = world.rng.pick(eligible);
  const rolled = template.roll(world, (min, max) => world.rng.int(min, max));
  return {
    id: ++opp.idCounter,
    templateId: template.id,
    category: template.category,
    text: rolled.text,
    kind: template.kind,
    target: rolled.target,
    baseline: rolled.baseline,
    progress: 0,
    deadlineAt: rolled.days > 0 ? world.time + Math.round(rolled.days * TICKS_PER_DAY) : 0,
    acceptedAt: 0,
    reward: rolled.reward,
  };
}

/** Apply the reward; returns the toast-friendly description. */
function grantReward(world: World, opp: Opportunity): string {
  switch (opp.reward.kind) {
    case "cash":
      world.cash += opp.reward.amount;
      return `$${Math.round(opp.reward.amount / 100).toLocaleString("en-US")}`;
    case "research": {
      // Fast-forward the active node; falls back to cash when nothing brews.
      if (world.research.active) {
        world.research.progressDays += 3;
        return "a research surge (+3 days of progress)";
      }
      world.cash += 250_000;
      return "$2,500 (no research running to boost)";
    }
    case "scenery": {
      const itemId = opp.reward.itemId;
      if (itemId && !world.bonusUnlocks.includes(itemId)) {
        world.bonusUnlocks.push(itemId);
        return "an exclusive scenery piece (check the Scenery tray)";
      }
      world.cash += 200_000;
      return "$2,000 (the exclusive piece was already yours)";
    }
    case "campaign": {
      if (!world.marketing.active) {
        world.marketing.active = {
          kind: "radio",
          endsAt: world.time + CAMPAIGNS.radio.days * TICKS_PER_DAY,
        };
        return "a free Radio Spots campaign";
      }
      world.cash += CAMPAIGNS.radio.cost;
      return `$${Math.round(CAMPAIGNS.radio.cost / 100).toLocaleString("en-US")} (a campaign already runs)`;
    }
  }
}
