/**
 * Asset pipeline source manifest (ASSET_GUIDE.md §6, TECHNICAL_ARCHITECTURE.md §11).
 * Maps shipped asset ids → raw kit files. `file` is the exact basename,
 * resolved recursively inside the kit folder (ambiguity = build error).
 *
 * Transform overrides (rotateY quarter-turns, scale) are applied at build
 * time so runtime code never compensates per-model.
 */

export interface ModelSource {
  /** Kit folder name under assets/. */
  kit: string;
  /** Exact file basename inside the kit. */
  file: string;
  /** Extra quarter-turns (90° CW) baked in so +z is "forward/entrance". */
  rotateYQuarter?: number;
  /** Uniform scale baked in (kits are ~1u=1m; tile = 2m). */
  scale?: number;
}

export interface SkySource {
  kit: string;
  file: string;
}

export const LICENSES: Record<string, { license: string; author: string; url: string }> = {
  kenney: { license: "CC0-1.0", author: "Kenney", url: "https://kenney.nl" },
};

export const MODEL_SOURCES: Record<string, ModelSource> = {
  // ── World ───────────────────────────────────────────────────────────────
  "world/park-entrance": { kit: "Kenney_CoasterKit", file: "park-entrance.glb" },

  // ── Paths & queues (CoasterKit auto-tile sets) ─────────────────────────
  "path/straight": { kit: "Kenney_CoasterKit", file: "path-straight.glb" },
  "path/corner": { kit: "Kenney_CoasterKit", file: "path-corner.glb" },
  "path/crossing": { kit: "Kenney_CoasterKit", file: "path-crossing.glb" },
  "path/split": { kit: "Kenney_CoasterKit", file: "path-split.glb" },
  "path/end": { kit: "Kenney_CoasterKit", file: "path-exit.glb" },
  "queue/straight": { kit: "Kenney_CoasterKit", file: "queue-straight.glb" },
  "queue/corner": { kit: "Kenney_CoasterKit", file: "queue-corner.glb" },
  "queue/crossing": { kit: "Kenney_CoasterKit", file: "queue-crossing.glb" },
  "queue/split": { kit: "Kenney_CoasterKit", file: "queue-split.glb" },

  // ── Stalls ─────────────────────────────────────────────────────────────
  "stalls/food": { kit: "Kenney_CoasterKit", file: "stall-food.glb" },
  "stalls/drinks": { kit: "Kenney_CoasterKit", file: "stall-drinks.glb" },
  "stalls/info": { kit: "Kenney_CoasterKit", file: "stall-information.glb" },
  "stalls/toilets": { kit: "Kenney_CoasterKit", file: "stall-toilets.glb" },

  // ── Park furniture ─────────────────────────────────────────────────────
  "furniture/bench": { kit: "Kenney_CoasterKit", file: "bench.glb" },
  "furniture/bin": { kit: "Kenney_CoasterKit", file: "trash.glb" },
  "furniture/lamp": { kit: "Kenney_CityKitRoads", file: "light-curved.glb", scale: 2.0 },
  "furniture/flowers": { kit: "Kenney_CoasterKit", file: "flowers.glb" },
  "furniture/grass-tuft": { kit: "Kenney_CoasterKit", file: "grass.glb" },
  "furniture/flag-red": { kit: "Kenney_MinigolfKit", file: "flag-large-red.glb", scale: 1.5 },
  "furniture/flag-blue": { kit: "Kenney_MinigolfKit", file: "flag-large-blue.glb", scale: 1.5 },
  "furniture/sculpture": { kit: "Kenney_MinigolfKit", file: "obstacle-diamond.glb" },
  "furniture/column": { kit: "Kenney_NatureKit", file: "statue_column.glb", scale: 1.4 },
  "furniture/planter": { kit: "Kenney_CityKitSuburban", file: "planter.glb" },
  "furniture/umbrella": { kit: "Kenney_CityKitCommercial", file: "detail-parasol-a.glb" },

  // ── Nature ─────────────────────────────────────────────────────────────
  "nature/tree-oak": { kit: "Kenney_NatureKit", file: "tree_oak.glb", scale: 1.6 },
  "nature/tree-oak-dark": { kit: "Kenney_NatureKit", file: "tree_oak_dark.glb", scale: 1.6 },
  "nature/tree-detailed": { kit: "Kenney_NatureKit", file: "tree_detailed.glb", scale: 1.6 },
  "nature/tree-pine": { kit: "Kenney_NatureKit", file: "tree_pineDefaultA.glb", scale: 1.6 },
  "nature/tree-pine-tall": { kit: "Kenney_NatureKit", file: "tree_pineTallA_detailed.glb", scale: 1.6 },
  "nature/tree-palm": { kit: "Kenney_NatureKit", file: "tree_palm.glb", scale: 1.6 },
  "nature/tree-palm-bend": { kit: "Kenney_NatureKit", file: "tree_palmBend.glb", scale: 1.6 },
  "nature/bush": { kit: "Kenney_NatureKit", file: "plant_bush.glb", scale: 1.4 },
  "nature/bush-trimmed": { kit: "Kenney_NatureKit", file: "plant_bushTriangle.glb", scale: 1.4 },
  "nature/hedge": { kit: "Kenney_NatureKit", file: "plant_bushDetailed.glb", scale: 1.4 },
  "nature/flower-red": { kit: "Kenney_NatureKit", file: "flower_redA.glb" },
  "nature/flower-yellow": { kit: "Kenney_NatureKit", file: "flower_yellowC.glb" },
  "nature/mushroom-red": { kit: "Kenney_NatureKit", file: "mushroom_redGroup.glb" },
  "nature/rock-small": { kit: "Kenney_NatureKit", file: "rock_smallA.glb" },
  "nature/rock-large": { kit: "Kenney_NatureKit", file: "rock_tallB.glb", scale: 1.5 },
  "nature/rock-formation": { kit: "Kenney_NatureKit", file: "rock_largeA.glb", scale: 2.2 },
  "nature/stump": { kit: "Kenney_NatureKit", file: "stump_old.glb" },
  "nature/log": { kit: "Kenney_NatureKit", file: "log_large.glb" },
  "nature/monument-ring": { kit: "Kenney_NatureKit", file: "statue_ring.glb", scale: 1.6 },
  "nature/obelisk": { kit: "Kenney_NatureKit", file: "statue_obelisk.glb", scale: 1.5 },
  "nature/fence-wood": { kit: "Kenney_NatureKit", file: "fence_simple.glb", scale: 1.5 },
  "nature/fence-planks": { kit: "Kenney_NatureKit", file: "fence_planks.glb", scale: 1.5 },

  // ── Guests (BlockyCharacters; ~1.75 m tall after scaling) ──────────────
  "guests/char-a": { kit: "Kenney_BlockyCharacters", file: "character-a.glb", scale: 0.33 },
  "guests/char-b": { kit: "Kenney_BlockyCharacters", file: "character-b.glb", scale: 0.33 },
  "guests/char-c": { kit: "Kenney_BlockyCharacters", file: "character-c.glb", scale: 0.33 },
  "guests/char-d": { kit: "Kenney_BlockyCharacters", file: "character-d.glb", scale: 0.33 },

  // ── Ride prop models (procedural ride structures use these as parts) ──
  "rides/pirate-ship": { kit: "Kenney_PirateKit", file: "ship-pirate-small.glb", scale: 0.32 },
  "rides/bumper-car-a": { kit: "Kenney_ToyCarKit", file: "vehicle-speedster.glb", scale: 1.2 },
  "rides/bumper-car-b": { kit: "Kenney_ToyCarKit", file: "vehicle-suv.glb", scale: 1.2 },
  "rides/bumper-car-c": { kit: "Kenney_ToyCarKit", file: "vehicle-racer.glb", scale: 1.2 },
};

export interface SpriteSource {
  kit: string;
  file: string;
  /** Subfolder filter when the same basename exists in multiple styles. */
  within?: string;
}

/** Emote sprites (billboarded above guests). */
export const SPRITE_SOURCES: Record<string, SpriteSource> = {
  "emote/happy": { kit: "Kenney_EmotesPack", file: "emote_faceHappy.png", within: "Vector/Style 1" },
  "emote/star": { kit: "Kenney_EmotesPack", file: "emote_star.png", within: "Vector/Style 1" },
  "emote/heart": { kit: "Kenney_EmotesPack", file: "emote_heart.png", within: "Vector/Style 1" },
  "emote/hungry": { kit: "Kenney_EmotesPack", file: "emote_cloud.png", within: "Vector/Style 1" },
  "emote/thirsty": { kit: "Kenney_EmotesPack", file: "emote_drop.png", within: "Vector/Style 1" },
  "emote/tired": { kit: "Kenney_EmotesPack", file: "emote_sleep.png", within: "Vector/Style 1" },
  "emote/toilet": { kit: "Kenney_EmotesPack", file: "emote_exclamations.png", within: "Vector/Style 1" },
  "emote/angry": { kit: "Kenney_EmotesPack", file: "emote_faceAngry.png", within: "Vector/Style 1" },
  "emote/expensive": { kit: "Kenney_EmotesPack", file: "emote_cash.png", within: "Vector/Style 1" },
  "emote/sad": { kit: "Kenney_EmotesPack", file: "emote_faceSad.png", within: "Vector/Style 1" },
  "emote/idea": { kit: "Kenney_EmotesPack", file: "emote_idea.png", within: "Vector/Style 1" },
};

export const SKY_SOURCES: Record<string, SkySource> = {
  "sky/morning": { kit: "Kenney_Skyboxes", file: "skybox-morning.png" },
  "sky/day": { kit: "Kenney_Skyboxes", file: "skybox-day.png" },
  "sky/night": { kit: "Kenney_Skyboxes", file: "skybox-night.png" },
};

/** Shipped-asset weight budget (bytes) — build fails above this. */
export const ASSET_BUDGET_BYTES = 40 * 1024 * 1024;
