/**
 * Weather machine + events engine (Phase 3). Weather re-rolls at dawn and
 * mid-afternoon; storms empty the park. Events fire every couple of days.
 */

import type { Emitter } from "@/shared/events";
import {
  CAMPAIGNS,
  EVENT_MAX_GAP_DAYS,
  EVENT_MIN_GAP_DAYS,
  WEATHER_CHANGES,
  WEATHER_INFO,
  type WeatherKind,
} from "../balance/phase3";
import { TICKS_PER_DAY, timeOfDay01 } from "../world/time";
import type { World } from "../world/world";
import type { SimEvents } from "../api";

function pickNext(world: World, from: WeatherKind): WeatherKind {
  const options = WEATHER_CHANGES[from];
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let roll = world.rng.next() * total;
  for (const [kind, weight] of options) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return "cloud";
}

export function weatherSystem(world: World, events: Emitter<SimEvents>): void {
  if (world.time < world.weather.changeAt) return;
  const previous = world.weather.current;
  world.weather.current = world.weather.next;
  world.weather.next = pickNext(world, world.weather.current);
  // Next change: dawn (~06:45) or mid-afternoon (~14:30), whichever is next.
  const t = timeOfDay01(world.time);
  const dayStart = world.time - Math.round(t * TICKS_PER_DAY);
  const dawn = dayStart + Math.round(0.28 * TICKS_PER_DAY);
  const noonish = dayStart + Math.round(0.6 * TICKS_PER_DAY);
  world.weather.changeAt =
    world.time < dawn ? dawn : world.time < noonish ? noonish : dawn + TICKS_PER_DAY;
  if (world.weather.current !== previous) {
    events.emit("weather-changed", { kind: world.weather.current });
    const info = WEATHER_INFO[world.weather.current];
    if (world.weather.current === "storm") {
      events.emit("notify", { tone: "warning", message: `${info.icon} A storm rolls in — guests are bolting for the gate!` });
    } else if (world.weather.current === "heat") {
      events.emit("notify", { tone: "info", message: `${info.icon} Heatwave! Drink stalls are about to print money.` });
    }
  }
}

// ── Events v1 (GAME_DESIGN Phase-3 events) ───────────────────────────────

interface EventDef {
  kind: string;
  /** Duration in ticks (0 = instant). */
  duration: number;
  /** Can this fire now? */
  eligible: (world: World) => boolean;
  /** Fire: mutate world, return the announcement. */
  fire: (world: World) => { tone: "info" | "success" | "warning"; message: string };
}

const EVENTS: EventDef[] = [
  {
    kind: "vip",
    duration: TICKS_PER_DAY * 0.15,
    eligible: (w) => w.guests.count > 20,
    fire: () => ({
      tone: "info",
      message: "🎩 A VIP critic is wandering your park incognito. Keep the guests smiling!",
    }),
  },
  {
    kind: "inspection",
    duration: 0,
    eligible: (w) => w.rides.size > 0,
    fire: (w) => {
      let shabby = 0;
      for (const ride of w.rides.values()) if (ride.reliability < 50) shabby++;
      if (shabby > 0) {
        const fine = 150_00 * shabby;
        w.cash -= fine;
        w.economy.today.expense.repairs += fine;
        w.economy.lifetimeExpense += fine;
        return {
          tone: "warning",
          message: `📋 Safety inspection! ${shabby} ride${shabby > 1 ? "s" : ""} below standards — fined $${(fine / 100).toFixed(0)}. Maintain your rides!`,
        };
      }
      return { tone: "success", message: "📋 Safety inspection passed with flying colors. The inspector rode twice." };
    },
  },
  {
    kind: "influencer",
    duration: TICKS_PER_DAY * 0.12,
    eligible: (w) => w.rating.value > 250,
    fire: () => ({
      tone: "success",
      message: "🤳 A famous streamer is filming here — expect a crowd surge!",
    }),
  },
  {
    kind: "coaster-club",
    duration: TICKS_PER_DAY * 0.2,
    eligible: (w) => w.coasters.size > 0,
    fire: () => ({
      tone: "info",
      message: "🎢 The Coaster Enthusiast Club is visiting — your coasters are the main course.",
    }),
  },
  {
    kind: "rats",
    duration: 0,
    eligible: (w) => w.litter.length > 80,
    fire: (w) => {
      for (let i = 0; i < w.guests.count; i++) {
        w.guests.xp[i] = (w.guests.xp[i] as number) - 6;
      }
      return {
        tone: "warning",
        message: "🐀 A rat was spotted near the litter! Guests are horrified — hire janitors!",
      };
    },
  },
  {
    kind: "lost-wallet",
    duration: 0,
    eligible: () => true,
    fire: (w) => {
      w.cash += 120_00;
      return {
        tone: "success",
        message: "👛 Staff found an unclaimed wallet stuffed with $120. Finders keepers (legally reviewed).",
      };
    },
  },
];

export function eventsSystem(world: World, events: Emitter<SimEvents>): void {
  if (world.events.active && world.time >= world.events.active.endsAt) {
    world.events.active = null;
  }
  if (world.time < world.events.nextAt) return;

  const eligible = EVENTS.filter((e) => e.eligible(world));
  world.events.nextAt =
    world.time +
    Math.round(
      TICKS_PER_DAY * (EVENT_MIN_GAP_DAYS + world.rng.next() * (EVENT_MAX_GAP_DAYS - EVENT_MIN_GAP_DAYS)),
    );
  if (eligible.length === 0) return;
  const event = world.rng.pick(eligible);
  const announcement = event.fire(world);
  if (event.duration > 0) {
    world.events.active = { kind: event.kind, endsAt: world.time + event.duration };
  }
  events.emit("notify", announcement);
  events.emit("cash-changed", { cash: world.cash });
}

/** Spawn multiplier from weather + marketing + events (read by spawning). */
export function spawnModifiers(world: World): number {
  let mult = WEATHER_INFO[world.weather.current].spawnMult;
  if (world.marketing.active) {
    const campaign = world.marketing.active;
    // Campaign definitions live in balance; look up dynamically to stay lean.
    mult *= campaignMult(campaign.kind);
  } else if (world.time < world.marketing.hangoverUntil) {
    mult *= 0.8;
  }
  if (world.events.active?.kind === "influencer") mult *= 2;
  return mult;
}

const campaignMult = (kind: keyof typeof CAMPAIGNS): number => CAMPAIGNS[kind].mult;
