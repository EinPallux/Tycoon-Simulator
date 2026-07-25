/**
 * World <-> SaveFile conversion. Derived state (tile occupancy) is NOT
 * stored — it is re-stamped from placeables on load. Guests persist their
 * identity and needs; transient path/queue/ride attachments reset to
 * "strolling where they stood" (queues re-form naturally within seconds).
 */

import { base64ToU8, u8ToBase64 } from "@/shared/encoding";
import { createIdSource } from "@/shared/ids";
import { restoreRng } from "@/shared/rng";
import { getPlaceableDef } from "@/content/catalog";
import { addGuest, createGuestsPool, GUEST_STATE, type GuestCold } from "../entities/guests";
import { footprintTiles } from "../validate";
import { createTileMap, tileIndex } from "../world/tiles";
import type { PlacedEntity, World } from "../world/world";
import { migrateSave } from "./migrate";
import { CURRENT_FORMAT_VERSION, type SaveFile } from "./schema";

export const APP_VERSION = "0.2.0";

export function serializeWorld(world: World): SaveFile {
  const g = world.guests;
  const guests: SaveFile["guests"] = [];
  for (let i = 0; i < g.count; i++) {
    const id = g.ids[i] as number;
    const cold = g.cold.get(id);
    if (!cold) continue;
    guests.push({
      id,
      name: cold.name,
      thrill: cold.thrill,
      patience: cold.patience,
      money: cold.money,
      modelIdx: cold.modelIdx,
      x: g.x[i] as number,
      z: g.z[i] as number,
      fun: g.fun[i] as number,
      hunger: g.hunger[i] as number,
      thirst: g.thirst[i] as number,
      energy: g.energy[i] as number,
      bladder: g.bladder[i] as number,
      xp: g.xp[i] as number,
      mood: g.mood[i] as number,
      ridesRidden: cold.ridesRidden,
      arrivedDay: cold.arrivedDay,
      thoughts: [...cold.thoughts],
    });
  }

  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    appVersion: APP_VERSION,
    seed: world.seed,
    rngState: world.rng.state(),
    time: world.time,
    cash: world.cash,
    debt: world.debt,
    meta: { ...world.meta },
    world: {
      size: world.tiles.size,
      ownedRect: { ...world.ownedRect },
      entrance: { ...world.entrance },
      surface: u8ToBase64(world.tiles.surface),
      owned: u8ToBase64(world.tiles.owned),
    },
    placeables: [...world.placeables.values()].map((e) => ({ ...e })),
    placeableIdCounter: world.placeableIds.current(),
    camera: { ...world.camera },
    guests,
    guestIdCounter: world.guestIds.current(),
    lifetimeGuests: world.lifetimeGuests,
    rides: [...world.rides.values()].map((r) => ({
      entityId: r.entityId,
      open: r.open,
      price: r.price,
      lifetimeRiders: r.lifetimeRiders,
    })),
    stalls: [...world.stalls.values()].map((s) => ({ entityId: s.entityId, price: s.price })),
    economy: {
      entryPrice: world.economy.entryPrice,
      today: structuredClonePlain(world.economy.today),
      history: world.economy.history.map(structuredClonePlain),
      lifetimeIncome: world.economy.lifetimeIncome,
      lifetimeExpense: world.economy.lifetimeExpense,
    },
    litter: world.litter.map((l) => ({ ...l })),
    valueEma: world.rating.valueEma,
    milestoneTier: world.milestoneTier,
    spawnAcc: world.spawnAcc,
  };
}

const structuredClonePlain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function worldFromSave(raw: unknown): World {
  const save = migrateSave(raw);
  const size = save.world.size;
  const tiles = createTileMap(size);
  tiles.surface.set(base64ToU8(save.world.surface, size * size));
  tiles.owned.set(base64ToU8(save.world.owned, size * size));

  const placeables = new Map<number, PlacedEntity>();
  for (const e of save.placeables) {
    // Validates the def still exists (content renames need data migrations).
    getPlaceableDef(e.defId);
    placeables.set(e.id, { ...e });
  }

  const world: World = {
    seed: save.seed,
    rng: restoreRng(save.rngState),
    time: save.time,
    cash: save.cash,
    debt: save.debt,
    meta: { ...save.meta },
    tiles,
    ownedRect: { ...save.world.ownedRect },
    entrance: { ...save.world.entrance },
    placeables,
    placeableIds: createIdSource(save.placeableIdCounter),
    camera: { ...save.camera },
    guests: createGuestsPool(),
    guestIds: createIdSource(save.guestIdCounter),
    lifetimeGuests: save.lifetimeGuests,
    rides: new Map(),
    stalls: new Map(),
    economy: {
      entryPrice: save.economy.entryPrice,
      today: structuredClonePlain(save.economy.today),
      history: save.economy.history.map(structuredClonePlain),
      lifetimeIncome: save.economy.lifetimeIncome,
      lifetimeExpense: save.economy.lifetimeExpense,
    },
    litter: save.litter.map((l) => ({ ...l })),
    rating: {
      value: 0,
      terms: { happiness: 0.7, rides: 0, cleanliness: 1, scenery: 0, value: save.valueEma },
      valueEma: save.valueEma,
    },
    milestoneTier: save.milestoneTier,
    spawnAcc: save.spawnAcc,
  };

  // Re-stamp occupancy from entities + revive ride/stall runtime state.
  for (const e of placeables.values()) {
    const def = getPlaceableDef(e.defId);
    for (const [tx, tz] of footprintTiles(def, e.x, e.z, e.rot)) {
      world.tiles.occupant[tileIndex(world.tiles, tx, tz)] = e.id;
    }
    if (def.ride) {
      const saved = save.rides.find((r) => r.entityId === e.id);
      world.rides.set(e.id, {
        entityId: e.id,
        open: saved?.open ?? true,
        price: saved?.price ?? def.ride.ticket,
        phase: "idle",
        phaseT: 0,
        riders: [],
        queue: [],
        lifetimeRiders: saved?.lifetimeRiders ?? 0,
        incomeToday: 0,
      });
    }
    if (def.stall) {
      const saved = save.stalls.find((s) => s.entityId === e.id);
      world.stalls.set(e.id, {
        entityId: e.id,
        price: saved?.price ?? def.stall.price,
        salesToday: 0,
        incomeToday: 0,
      });
    }
  }

  // Revive guests: everyone stands where they were, free to re-plan.
  for (const saved of save.guests) {
    const slot = addGuest(world.guests, {
      id: saved.id,
      name: saved.name,
      thrill: saved.thrill,
      patience: saved.patience,
      money: saved.money,
      modelIdx: saved.modelIdx,
      x: saved.x,
      z: saved.z,
      day: saved.arrivedDay,
    });
    if (slot === -1) break;
    const g = world.guests;
    g.fun[slot] = saved.fun;
    g.hunger[slot] = saved.hunger;
    g.thirst[slot] = saved.thirst;
    g.energy[slot] = saved.energy;
    g.bladder[slot] = saved.bladder;
    g.xp[slot] = saved.xp;
    g.mood[slot] = saved.mood;
    g.state[slot] = GUEST_STATE.strolling;
    g.timer[slot] = 5;
    const cold = g.cold.get(saved.id) as GuestCold;
    cold.ridesRidden = saved.ridesRidden;
    cold.thoughts = [...saved.thoughts];
  }

  return world;
}
