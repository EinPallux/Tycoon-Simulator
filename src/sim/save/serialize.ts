/**
 * World <-> SaveFile conversion. The occupant layer is intentionally NOT
 * stored — it is derivable from placeables and re-stamped on load, which
 * keeps saves smaller and guarantees tile/entity consistency.
 */

import { base64ToU8, u8ToBase64 } from "@/shared/encoding";
import { createIdSource } from "@/shared/ids";
import { restoreRng } from "@/shared/rng";
import { getPlaceableDef } from "@/content/catalog";
import { footprintTiles } from "../validate";
import { createTileMap, tileIndex } from "../world/tiles";
import type { PlacedEntity, World } from "../world/world";
import { migrateSave } from "./migrate";
import { CURRENT_FORMAT_VERSION, type SaveFile } from "./schema";

export const APP_VERSION = "0.1.0";

export function serializeWorld(world: World): SaveFile {
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
  };
}

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
  };

  // Re-stamp occupancy from entities.
  for (const e of placeables.values()) {
    const def = getPlaceableDef(e.defId);
    for (const [tx, tz] of footprintTiles(def, e.x, e.z, e.rot)) {
      world.tiles.occupant[tileIndex(world.tiles, tx, tz)] = e.id;
    }
  }
  return world;
}
