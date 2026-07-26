/**
 * Opportunity templates (GAME_DESIGN.md §13) — the "little bit guided" layer.
 * Every offer is generated FROM current park state (template + parameter fill)
 * so it always reads as a sensible next step, never homework. Declining is
 * free, expiry is quiet, completion is a party.
 *
 * Kinds:
 *  - "reach":     measure(world) must reach target once.
 *  - "delta":     measure(world) − baseline must reach target (cumulative).
 *  - "hold-days": progress increments each day rollover the predicate holds
 *                 (resets on violation); done at `target` days.
 */

import type { World } from "@/sim/world/world";
import { ledgerDayTotals } from "@/sim/economy";

export type GoalCategory = "growth" | "builder" | "economy" | "operations" | "visitors" | "care";
export type GoalKind = "reach" | "delta" | "hold-days";

export interface GoalReward {
  kind: "cash" | "research" | "scenery" | "campaign";
  /** Cents for cash; ignored otherwise. */
  amount: number;
  /** Scenery def id for "scenery" rewards. */
  itemId?: string;
}

export interface RolledGoal {
  text: string;
  target: number;
  baseline: number;
  /** Days until quiet expiry (0 = no deadline). */
  days: number;
  reward: GoalReward;
}

export interface GoalTemplate {
  id: string;
  category: GoalCategory;
  kind: GoalKind;
  eligible(world: World): boolean;
  roll(world: World, pickInt: (min: number, max: number) => number): RolledGoal;
  /** Current value toward target ("reach"/"delta"); unused for hold-days. */
  measure(world: World, baseline: number): number;
  /** Daily predicate for hold-days templates. */
  holds?(world: World): boolean;
  /** Progress label for the Goals panel ("62 / 80"). */
  format(value: number, target: number): string;
}

/** Reward-only cosmetic scenery (never buildable without the unlock). */
export const BONUS_SCENERY = [
  "scenery/golden-statue",
  "scenery/wonder-fountain",
  "scenery/penny-statue",
] as const;

const money = (cents: number): string => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

const cashReward = (cents: number): GoalReward => ({ kind: "cash", amount: cents });

/** Weekly profit so far: lifetime net minus the baseline net. */
const lifetimeNet = (world: World): number =>
  world.economy.lifetimeIncome - world.economy.lifetimeExpense;

const cleanliness01 = (world: World): number => world.rating.terms.cleanliness;

const avgMood = (world: World): number => {
  const g = world.guests;
  if (g.count === 0) return 0;
  let sum = 0;
  for (let i = 0; i < g.count; i++) sum += g.mood[i] as number;
  return sum / g.count;
};

const bestCoasterExcitement = (world: World): number => {
  let best = 0;
  for (const coaster of world.coasters.values()) {
    best = Math.max(best, coaster.stats.excitement);
  }
  return best;
};

const openCoasters = (world: World): number => {
  let n = 0;
  for (const id of world.coasters.keys()) {
    if (world.rides.get(id)?.open) n++;
  }
  return n;
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // ── Growth ─────────────────────────────────────────────────────────────
  {
    id: "growth-guests",
    category: "growth",
    kind: "reach",
    eligible: (w) => w.guests.count >= 10,
    roll: (w, pickInt) => {
      const target = Math.min(480, Math.ceil((w.tallies.peakGuests + pickInt(25, 45)) / 10) * 10);
      return {
        text: `Host ${target} guests at once`,
        target,
        baseline: 0,
        days: 0,
        reward: cashReward(target * 6_00),
      };
    },
    measure: (w) => w.guests.count,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  {
    id: "growth-rating",
    category: "growth",
    kind: "reach",
    eligible: (w) => w.rating.value >= 60 && w.rating.value < 820,
    roll: (w, pickInt) => {
      const target = Math.min(900, Math.ceil((w.rating.value + pickInt(60, 120)) / 25) * 25);
      return {
        text: `Reach park rating ${target}`,
        target,
        baseline: 0,
        days: 0,
        reward: { kind: "research", amount: 0 },
      };
    },
    measure: (w) => w.rating.value,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  // ── Builder ────────────────────────────────────────────────────────────
  {
    id: "builder-coaster",
    category: "builder",
    kind: "reach",
    eligible: (w) => w.cash > 900_000,
    roll: (w) => {
      const target = Math.min(8, Math.max(5, Math.round((bestCoasterExcitement(w) + 0.7) * 2) / 2));
      return {
        text: `Open a coaster with excitement ${target.toFixed(1)}+`,
        target,
        baseline: 0,
        days: 0,
        reward: cashReward(500_000),
      };
    },
    measure: (w) => {
      let best = 0;
      for (const [id, coaster] of w.coasters) {
        if (w.rides.get(id)?.open) best = Math.max(best, coaster.stats.excitement);
      }
      return best;
    },
    format: (v, t) => `${v.toFixed(1)} / ${t.toFixed(1)}`,
  },
  {
    id: "builder-zone",
    category: "builder",
    kind: "reach",
    eligible: (w) => w.zones.length < 4,
    roll: (w) => ({
      text: "Create a themed zone (8 same-theme pieces near a ride)",
      target: w.zones.length + 1,
      baseline: 0,
      days: 0,
      reward: { kind: "scenery", amount: 0, itemId: "scenery/wonder-fountain" },
    }),
    measure: (w) => w.zones.length,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  {
    id: "builder-scenery",
    category: "builder",
    kind: "delta",
    eligible: (w) => w.rating.terms.scenery < 0.55,
    roll: (w, pickInt) => {
      const target = pickInt(12, 20);
      return {
        text: `Plant ${target} new scenery pieces`,
        target,
        baseline: w.tallies.sceneryPlaced,
        days: 3,
        reward: cashReward(target * 4_000),
      };
    },
    measure: (w) => w.tallies.sceneryPlaced,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  // ── Economy ────────────────────────────────────────────────────────────
  {
    id: "economy-profit",
    category: "economy",
    kind: "delta",
    eligible: (w) => w.lifetimeGuests > 30,
    roll: (w) => {
      const daily = Math.max(200_00, ledgerDayTotals(w.economy.today).income);
      const target = Math.round((daily * 5) / 100_00) * 100_00;
      return {
        text: `Bank ${money(target)} profit in a week`,
        target,
        baseline: lifetimeNet(w),
        days: 7,
        reward: cashReward(Math.round(target * 0.35)),
      };
    },
    measure: (w) => lifetimeNet(w),
    format: (v, t) => `${money(Math.max(0, v))} / ${money(t)}`,
  },
  {
    id: "economy-stalls",
    category: "economy",
    kind: "delta",
    eligible: (w) => w.stalls.size >= 2 && w.guests.count >= 15,
    roll: (w, pickInt) => {
      const target = pickInt(4, 7) * 10;
      return {
        text: `Sell ${target} stall items in 2 days`,
        target,
        baseline: w.tallies.stallSales,
        days: 2,
        reward: cashReward(target * 3_00),
      };
    },
    measure: (w) => w.tallies.stallSales,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  // ── Operations ─────────────────────────────────────────────────────────
  {
    id: "ops-clean",
    category: "operations",
    kind: "hold-days",
    eligible: (w) => w.litter.length > 12,
    roll: () => ({
      text: "Keep cleanliness above 80% for 3 days",
      target: 3,
      baseline: 0,
      days: 8,
      reward: cashReward(300_000),
    }),
    measure: () => 0,
    holds: (w) => cleanliness01(w) >= 0.8,
    format: (v, t) => `${Math.round(v)} / ${t} days`,
  },
  {
    id: "ops-uptime",
    category: "operations",
    kind: "hold-days",
    eligible: (w) => w.rides.size >= 3,
    roll: () => ({
      text: "A full week without a single breakdown",
      target: 7,
      baseline: 0,
      days: 12,
      reward: cashReward(400_000),
    }),
    measure: () => 0,
    holds: (w) => w.time - w.tallies.lastBreakdownAt >= 900,
    format: (v, t) => `${Math.round(v)} / ${t} days`,
  },
  // ── Visitors (flavored) ────────────────────────────────────────────────
  {
    id: "visitors-coasterclub",
    category: "visitors",
    kind: "reach",
    eligible: (w) => (w.meta.freeplayUnlocks || w.research.done.thrill >= 3) && openCoasters(w) < 2,
    roll: () => ({
      text: "The Coaster Club wants a double bill — 2 coasters open",
      target: 2,
      baseline: 0,
      days: 6,
      reward: cashReward(650_000),
    }),
    measure: (w) => openCoasters(w),
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  {
    id: "visitors-vip",
    category: "visitors",
    kind: "reach",
    eligible: (w) => w.rating.value >= 250 && w.rating.value < 700,
    roll: (w, pickInt) => {
      const target = Math.ceil((w.rating.value + pickInt(40, 80)) / 10) * 10;
      return {
        text: `A critic is coming — rating ${target}+ before she arrives`,
        target,
        baseline: 0,
        days: 4,
        reward: { kind: "campaign", amount: 0 },
      };
    },
    measure: (w) => w.rating.value,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  // ── Care ───────────────────────────────────────────────────────────────
  {
    id: "care-mood",
    category: "care",
    kind: "reach",
    eligible: (w) => w.guests.count >= 20 && avgMood(w) < 74,
    roll: () => ({
      text: "Get average guest mood above 75",
      target: 75,
      baseline: 0,
      days: 0,
      reward: cashReward(350_000),
    }),
    measure: (w) => avgMood(w),
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
  {
    id: "care-happy",
    category: "care",
    kind: "delta",
    eligible: (w) => w.lifetimeGuests > 40,
    roll: (w, pickInt) => {
      const target = pickInt(15, 30);
      return {
        text: `Send ${target} guests home happy`,
        target,
        baseline: w.tallies.happyLeavers,
        days: 4,
        reward: { kind: "scenery", amount: 0, itemId: "scenery/golden-statue" },
      };
    },
    measure: (w) => w.tallies.happyLeavers,
    format: (v, t) => `${Math.round(v)} / ${t}`,
  },
];

export const goalTemplateById = (id: string): GoalTemplate | undefined =>
  GOAL_TEMPLATES.find((t) => t.id === id);

/** Zone auto-name suggestions per theme (GAME_DESIGN.md §10.3). */
export const ZONE_NAMES: Record<string, string[]> = {
  nature: ["Whispering Glade", "Garden Walk", "Evergreen Corner"],
  pirate: ["Pirate Cove", "Buccaneer Bay", "Plunder Point"],
  space: ["Star Harbor", "Orbit Plaza", "Nebula Nook"],
  castle: ["King's Court", "Banner Keep", "Drawbridge Square"],
  spooky: ["Shiver Hollow", "Midnight Manor", "Ghoul Garden"],
  winter: ["Frostfair", "Snowdrift Square", "Mitten Meadow"],
};
