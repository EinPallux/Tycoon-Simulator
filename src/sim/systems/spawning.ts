/**
 * Guest arrivals (GAME_DESIGN.md §15.5): appeal-driven spawn rate with a
 * day/night curve. Guests appear outside the entrance and walk in.
 */

import type { Emitter } from "@/shared/events";
import {
  dayCurve,
  entryValue,
  GUEST_MONEY_MAX,
  GUEST_MONEY_MIN,
  GUEST_NAMES_FIRST,
  GUEST_NAMES_LAST,
  MAX_GUESTS,
  SPAWN_BASE_PER_DAY,
  SPAWN_PER_RATING,
} from "../balance/guests";
import { addGuest } from "../entities/guests";
import { hasPerk } from "../research";
import { isStrollable } from "../world/pathfind";
import { dayOfTime, TICKS_PER_DAY, timeOfDay01 } from "../world/time";
import type { World } from "../world/world";
import type { SimEvents } from "../api";
import { spawnModifiers } from "./weather";

/** Is there a path connected to the entrance's inner edge? */
export function parkIsOpen(world: World): boolean {
  return isStrollable(world, world.entrance.x, world.entrance.z - 1);
}

let warnedNoPath = false;
export function resetSpawnWarnings(): void {
  warnedNoPath = false;
}

export function spawningSystem(world: World, events: Emitter<SimEvents>): void {
  const t01 = timeOfDay01(world.time);
  const curve = dayCurve(t01);
  if (curve <= 0) return;

  const entryDollars = world.economy.entryPrice / 100;
  const value = entryValue(entryDollars, world.rating.value);
  const mouth = hasPerk(world, "word-of-mouth") ? 1.1 : 1;
  const perDay =
    (SPAWN_BASE_PER_DAY + world.rating.value * SPAWN_PER_RATING) *
    value *
    spawnModifiers(world) *
    mouth;
  world.spawnAcc += (perDay * curve * 2.2) / TICKS_PER_DAY;

  if (world.spawnAcc < 1) return;

  if (!parkIsOpen(world)) {
    // Would-be guests wander off; tell the player once.
    if (world.spawnAcc >= 1 && !warnedNoPath) {
      warnedNoPath = true;
      events.emit("notify", {
        tone: "warning",
        message: "Guests are outside, but no path reaches your entrance! Build one from the gate.",
      });
    }
    world.spawnAcc = 0;
    return;
  }

  while (world.spawnAcc >= 1 && world.guests.count < MAX_GUESTS) {
    world.spawnAcc -= 1;
    const rng = world.rng;
    const id = world.guestIds.nextId();
    const name = `${rng.pick(GUEST_NAMES_FIRST)} ${rng.pick(GUEST_NAMES_LAST)}`;
    // Entry must be affordable with pocket money to spare.
    const money =
      Math.round(rng.int(GUEST_MONEY_MIN, GUEST_MONEY_MAX) / 100) * 100 +
      world.economy.entryPrice;
    const slot = addGuest(world.guests, {
      id,
      name,
      thrill: rng.next(),
      patience: 0.6 + rng.next() * 0.8,
      money,
      modelIdx: rng.int(0, 3),
      x: world.entrance.x + 0.5 + rng.range(-0.3, 0.3),
      z: world.entrance.z + 3.2 + rng.range(0, 1.5),
      day: dayOfTime(world.time),
    });
    if (slot === -1) break;
    // Arrive peckish-ish: every park day contains a snack rush.
    world.guests.hunger[slot] = 42 + rng.range(0, 16);
    world.guests.thirst[slot] = 42 + rng.range(0, 16);
  }
}
