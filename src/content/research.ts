/**
 * Research tree: 4 branches × 6 nodes (GAME_DESIGN.md §6.4, §11.4).
 * Content nodes unlock placeables/coaster families; perk nodes flip named
 * modifiers read by the sim (sim/research.ts holds the resolver).
 */

export type ResearchBranchId = "thrill" | "family" | "food" | "ops";

export interface ResearchNode {
  id: string;
  name: string;
  blurb: string;
  /** Research-days at normal funding. */
  days: number;
  /** Placeable def ids this node unlocks. */
  unlocks?: string[];
  /** Coaster families this node unlocks. */
  unlocksCoasters?: string[];
  /** Perk flag (see PERKS in sim/research.ts). */
  perk?: string;
}

export interface ResearchBranch {
  id: ResearchBranchId;
  name: string;
  icon: string;
  nodes: ResearchNode[];
}

export const RESEARCH_BRANCHES: ResearchBranch[] = [
  {
    id: "thrill",
    name: "Thrill",
    icon: "🎢",
    nodes: [
      { id: "thrill-1", name: "Whirly Teacups", blurb: "Spin responsibly.", days: 1.5, unlocks: ["ride/teacups"] },
      { id: "thrill-2", name: "Sky Plunge", blurb: "Gravity, as a service.", days: 2, unlocks: ["ride/drop"] },
      { id: "thrill-3", name: "Wild Mouse Coaster", blurb: "Build your own track!", days: 3, unlocksCoasters: ["mouse"] },
      { id: "thrill-4", name: "Jolly Roger", blurb: "A ship that refuses the sea.", days: 2, unlocks: ["ride/swing"] },
      { id: "thrill-5", name: "Log Flume Coaster", blurb: "Wet track, dry humor.", days: 3, unlocksCoasters: ["flume"] },
      { id: "thrill-6", name: "Extreme Engineering", blurb: "Coaster supports +2 height.", days: 2.5, perk: "tall-supports" },
      { id: "thrill-7", name: "Steel Streak Coaster", blurb: "Smooth, fast, shiny.", days: 3.5, unlocksCoasters: ["steel"] },
      { id: "thrill-8", name: "Sky Hanger Coaster", blurb: "The track is the ceiling.", days: 4, unlocksCoasters: ["hanging"] },
    ],
  },
  {
    id: "family",
    name: "Family",
    icon: "🎡",
    nodes: [
      { id: "family-1", name: "Ferris Wheel", blurb: "The gentle giant.", days: 1.5, unlocks: ["ride/ferris"] },
      { id: "family-2", name: "Bump-a-Lot Arena", blurb: "Consensual collisions.", days: 2, unlocks: ["ride/bumper"] },
      { id: "family-3", name: "Plaza Beautification", blurb: "Monuments & fancy flair.", days: 1.5, unlocks: ["scenery/monument-ring", "scenery/obelisk", "scenery/sculpture", "scenery/column"] },
      { id: "family-4", name: "Patient Little Legs", blurb: "Queue patience +25%.", days: 2, perk: "patience" },
      { id: "family-5", name: "Pirate Landscaping", blurb: "Palms with attitude.", days: 1.5, unlocks: ["scenery/tree-palm", "scenery/tree-palm-bend"] },
      { id: "family-6", name: "Word of Mouth", blurb: "Guest arrivals +10%.", days: 2.5, perk: "word-of-mouth" },
      { id: "family-7", name: "Park Monorail", blurb: "Sightseeing at a sensible pace.", days: 2.5, unlocksCoasters: ["monorail"] },
    ],
  },
  {
    id: "food",
    name: "Food & Retail",
    icon: "🍔",
    nodes: [
      { id: "food-1", name: "Candy Cloud", blurb: "Spun sugar architecture.", days: 1, unlocks: ["stall/candy"] },
      { id: "food-2", name: "Bean Machine", blurb: "Caffeinate the queue.", days: 1.5, unlocks: ["stall/coffee"] },
      { id: "food-3", name: "Wander Wares", blurb: "Plush mascots print money.", days: 2, unlocks: ["stall/souvenir"] },
      { id: "food-4", name: "Bulk Buying", blurb: "Cost of goods −25%.", days: 2, perk: "bulk-buying" },
      { id: "food-5", name: "Combo Meals", blurb: "Food restores more hunger.", days: 1.5, perk: "combo-meals" },
      { id: "food-6", name: "Premium Branding", blurb: "Guests accept +20% prices.", days: 2.5, perk: "premium-pricing" },
    ],
  },
  {
    id: "ops",
    name: "Operations",
    icon: "🔧",
    nodes: [
      { id: "ops-1", name: "Efficient Ops", blurb: "Ride upkeep −15%.", days: 1.5, perk: "efficient-ops" },
      { id: "ops-2", name: "Preventive Care", blurb: "Breakdowns −35%.", days: 2, perk: "preventive-care" },
      { id: "ops-3", name: "Swift Wrenches", blurb: "Repairs +50% faster.", days: 2, perk: "swift-wrenches" },
      { id: "ops-4", name: "Marketing Licence", blurb: "Unlocks ad campaigns.", days: 2, perk: "marketing" },
      { id: "ops-5", name: "Predictive Maintenance", blurb: "Breakdowns −60%.", days: 3, perk: "predictive" },
      { id: "ops-6", name: "Golden Brooms", blurb: "Janitors sweep twice as fast.", days: 2, perk: "golden-brooms" },
    ],
  },
];

/** Def ids that are available from day one (everything else needs research). */
export const STARTER_UNLOCKS = new Set<string>([
  "ride/carousel",
  "stall/food",
  "stall/drinks",
  "stall/info",
  "stall/toilets",
]);

/** Scenery is mostly free; only showpieces are research-gated. */
export const RESEARCH_GATED_SCENERY = new Set<string>([
  "scenery/monument-ring",
  "scenery/obelisk",
  "scenery/sculpture",
  "scenery/column",
  "scenery/tree-palm",
  "scenery/tree-palm-bend",
]);

export const FUNDING_LEVELS = [
  { label: "Paused", perDay: 0, speed: 0 },
  { label: "Standard", perDay: 15_000, speed: 1 },
  { label: "Turbo", perDay: 40_000, speed: 1.8 },
] as const;
