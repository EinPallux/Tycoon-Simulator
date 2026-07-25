/**
 * Content-as-data type definitions (TECHNICAL_ARCHITECTURE.md §7).
 * Every buildable thing is a typed record; the engine never special-cases
 * individual content ids.
 */

export type PlaceableCategory = "scenery" | "stall" | "ride";

export type ThemeTag = "nature" | "pirate" | "space" | "castle" | "spooky" | "winter";

/** Flat-ride kinds; each has a dedicated animated render component. */
export type RideKind = "carousel" | "ferris" | "teacups" | "drop" | "bumper" | "swing";

export interface RideConfig {
  kind: RideKind;
  /** Riders per cycle. */
  capacity: number;
  /** One ride cycle in seconds (boarding excluded). */
  cycleSec: number;
  /** Stats 0..10 (GAME_DESIGN.md §15.2). */
  excitement: number;
  intensity: number;
  nausea: number;
  /** Default ticket in cents. */
  ticket: number;
  /** Daily upkeep in cents while open. */
  runningPerDay: number;
}

export type StallNeed = "hunger" | "thirst" | "bladder" | "fun" | "info";

export interface StallConfig {
  /** What buying here restores. */
  satisfies: StallNeed;
  /** Item display name ("Burger", "Fizzy Pop"…). */
  item: string;
  /** Default item price in cents (0 = free facility, e.g. toilets). */
  price: number;
  /** Cost of goods per sale in cents. */
  cogs: number;
}

export interface PlaceableDef {
  /** Stable content id, e.g. "scenery/tree-large". Never rename once shipped. */
  id: string;
  name: string;
  category: PlaceableCategory;
  /** Footprint in tiles at rotation 0: [width(x), depth(z)]. */
  footprint: readonly [number, number];
  /** Build cost in integer cents. */
  cost: number;
  /**
   * Asset id in the generated manifest. Rides are procedural/composed render
   * components instead and omit this.
   */
  model?: string;
  /** Beauty contribution 0..10 (park rating scenery term). */
  beauty: number;
  themeTag?: ThemeTag;
  /** Must touch a path tile with at least one footprint edge. */
  requiresPathAdjacent?: boolean;
  ride?: RideConfig;
  stall?: StallConfig;
}

export interface SurfaceDef {
  id: "path" | "queue";
  name: string;
  /** Cost per tile in cents. */
  costPerTile: number;
}
