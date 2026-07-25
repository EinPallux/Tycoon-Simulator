/**
 * Content-as-data type definitions (TECHNICAL_ARCHITECTURE.md §7).
 * Every buildable thing is a typed record; the engine never special-cases
 * individual content ids.
 */

export type PlaceableCategory = "scenery" | "stall";

export type ThemeTag = "nature" | "pirate" | "space" | "castle" | "spooky" | "winter";

export interface PlaceableDef {
  /** Stable content id, e.g. "scenery/tree-large". Never rename once shipped. */
  id: string;
  name: string;
  category: PlaceableCategory;
  /** Footprint in tiles at rotation 0: [width(x), depth(z)]. */
  footprint: readonly [number, number];
  /** Build cost in integer cents. */
  cost: number;
  /** Asset id in the generated manifest (src/content/asset-manifest.ts). */
  model: string;
  /** Beauty contribution 0..10 (used by park rating from Phase 2 on). */
  beauty: number;
  themeTag?: ThemeTag;
  /** Stalls must touch a path tile with at least one footprint edge. */
  requiresPathAdjacent?: boolean;
}

export interface SurfaceDef {
  id: "path" | "queue";
  name: string;
  /** Cost per tile in cents. */
  costPerTile: number;
}
