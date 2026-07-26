/**
 * Needs decay + mood + ambient emotes (GAME_DESIGN.md §15.1).
 */

import {
  BLADDER_RISE_PER_HOUR,
  DECAY_PER_HOUR,
  EXPERIENCE_DECAY_PER_TICK,
  MOOD_AVG_WEIGHT,
  MOOD_MIN_WEIGHT,
  NEED_CRITICAL,
  perTick,
} from "../balance/guests";
import { EMOTE, GUEST_STATE, setEmote } from "../entities/guests";
import { WEATHER_INFO } from "../balance/phase3";
import type { World } from "../world/world";

const FUN_DECAY = perTick(DECAY_PER_HOUR.fun);
const HUNGER_DECAY = perTick(DECAY_PER_HOUR.hunger);
const THIRST_DECAY = perTick(DECAY_PER_HOUR.thirst);
const ENERGY_DECAY = perTick(DECAY_PER_HOUR.energy);
const BLADDER_RISE = perTick(BLADDER_RISE_PER_HOUR);

const clamp100 = (v: number): number => (v < 0 ? 0 : v > 100 ? 100 : v);

export function needsSystem(world: World): void {
  const g = world.guests;
  const thirstMult =
    WEATHER_INFO[world.weather.current].thirstMult *
    (world.events.active?.kind === "heat-rush" ? 1.5 : 1);
  for (let i = 0; i < g.count; i++) {
    if (g.state[i] === GUEST_STATE.riding) {
      // Rides top up fun on exit; time on board doesn't drain much.
      g.energy[i] = clamp100((g.energy[i] as number) - ENERGY_DECAY * 0.5);
    } else {
      g.fun[i] = clamp100((g.fun[i] as number) - FUN_DECAY);
      g.hunger[i] = clamp100((g.hunger[i] as number) - HUNGER_DECAY);
      g.thirst[i] = clamp100((g.thirst[i] as number) - THIRST_DECAY * thirstMult);
      g.energy[i] = clamp100((g.energy[i] as number) - ENERGY_DECAY);
      g.bladder[i] = clamp100((g.bladder[i] as number) + BLADDER_RISE);
    }

    // Experience offset decays toward 0.
    g.xp[i] = (g.xp[i] as number) * EXPERIENCE_DECAY_PER_TICK;

    // Mood: weighted needs + clamped experience.
    const needs = [
      g.fun[i] as number,
      g.hunger[i] as number,
      g.thirst[i] as number,
      g.energy[i] as number,
      100 - (g.bladder[i] as number),
    ];
    const min = Math.min(...needs);
    const avg = (needs[0]! + needs[1]! + needs[2]! + needs[3]! + needs[4]!) / 5;
    const xp = Math.max(-25, Math.min(25, g.xp[i] as number));
    g.mood[i] = clamp100(min * MOOD_MIN_WEIGHT + avg * MOOD_AVG_WEIGHT + xp);

    // Emote ttl + ambient critical-need emotes (sparse, deterministic).
    if ((g.emoteTtl[i] as number) > 0) {
      g.emoteTtl[i] = (g.emoteTtl[i] as number) - 1;
      if ((g.emoteTtl[i] as number) <= 0) g.emote[i] = EMOTE.none;
    } else if (world.time % 20 === (g.ids[i] as number) % 20) {
      if ((g.bladder[i] as number) > 100 - NEED_CRITICAL) setEmote(g, i, EMOTE.toilet);
      else if ((g.hunger[i] as number) < NEED_CRITICAL) setEmote(g, i, EMOTE.hungry);
      else if ((g.thirst[i] as number) < NEED_CRITICAL) setEmote(g, i, EMOTE.thirsty);
      else if ((g.energy[i] as number) < NEED_CRITICAL) setEmote(g, i, EMOTE.tired);
      else if ((g.mood[i] as number) < 25) setEmote(g, i, EMOTE.angry);
      else if ((g.mood[i] as number) > 88) setEmote(g, i, EMOTE.happy);
    }
  }
}
