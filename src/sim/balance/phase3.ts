/** Phase-3 balance: staff, weather, breakdowns, loans, events, marketing. */

// ── Staff (GAME_DESIGN.md §7; wages per week in cents) ───────────────────
export const STAFF_ROLES = {
  janitor: { name: "Janitor", wage: 11_000, hireFee: 5_000, icon: "🧹" },
  mechanic: { name: "Mechanic", wage: 16_000, hireFee: 8_000, icon: "🔧" },
  entertainer: { name: "Entertainer", wage: 13_000, hireFee: 6_000, icon: "🎭" },
} as const;
export type StaffRole = keyof typeof STAFF_ROLES;
export const MAX_STAFF = 24;
export const STAFF_WALK_SPEED = 1.35;
export const SWEEP_TICKS = 12;
export const REPAIR_TICKS_BASE = 70;
export const ENTERTAINER_RADIUS = 3;

// ── Weather (GAME_DESIGN.md §3, Phase-3 slice) ───────────────────────────
export type WeatherKind = "sun" | "cloud" | "rain" | "storm" | "heat";
export const WEATHER_INFO: Record<
  WeatherKind,
  { name: string; icon: string; spawnMult: number; thirstMult: number; leaveNow: boolean }
> = {
  sun: { name: "Sunny", icon: "☀️", spawnMult: 1.1, thirstMult: 1, leaveNow: false },
  cloud: { name: "Cloudy", icon: "⛅", spawnMult: 1.0, thirstMult: 1, leaveNow: false },
  rain: { name: "Rain", icon: "🌧", spawnMult: 0.55, thirstMult: 0.9, leaveNow: false },
  storm: { name: "Storm", icon: "⛈", spawnMult: 0.2, thirstMult: 0.9, leaveNow: true },
  heat: { name: "Heatwave", icon: "🥵", spawnMult: 0.95, thirstMult: 1.7, leaveNow: false },
};
/** Weather transition weights from each state (picked at dawn + midday). */
export const WEATHER_CHANGES: Record<WeatherKind, Array<[WeatherKind, number]>> = {
  sun: [["sun", 5], ["cloud", 3], ["heat", 1.2], ["rain", 1]],
  cloud: [["sun", 3], ["cloud", 4], ["rain", 2.4], ["storm", 0.6]],
  rain: [["cloud", 4], ["rain", 2.5], ["storm", 1], ["sun", 1.5]],
  storm: [["rain", 4], ["cloud", 3], ["sun", 1]],
  heat: [["heat", 3], ["sun", 4], ["storm", 1.2]],
};

// ── Breakdowns (GAME_DESIGN.md §8, §15.3) ────────────────────────────────
export const RELIABILITY_DECAY_PER_DAY = 2.2;
export const RELIABILITY_DECAY_PER_CYCLE = 0.22;
export const BREAKDOWN_BASE_PER_DAY = 0.3; // expected breakdowns/day at rel 0
export const CONTRACTOR_REPAIR_COST = 25_000;
export const CONTRACTOR_REPAIR_TICKS = 90;
export const RENOVATE_COST_RATE = 0.4;

// ── Loans (GAME_DESIGN.md §6.3) ──────────────────────────────────────────
export const LOAN_TRANCHE = 500_000; // $5,000
export const LOAN_RATE_STEP = 0.015;
export const CREDIT_LIMIT_RATE = 0.6; // × park value
export const MISS_PENALTY = 10_000;
export const MISS_RATING_XP = -50;
export const SEIZE_REFUND_RATE = 0.55;

// ── Events (GAME_DESIGN.md §13-adjacent, Phase-3 events v1) ──────────────
export const EVENT_MIN_GAP_DAYS = 1.6;
export const EVENT_MAX_GAP_DAYS = 3.2;

// ── Marketing (GAME_DESIGN.md §6.5) ──────────────────────────────────────
export const CAMPAIGNS = {
  flyers: { name: "Flyer Blitz", cost: 50_000, days: 3, mult: 1.15, icon: "📄" },
  radio: { name: "Radio Spots", cost: 120_000, days: 4, mult: 1.3, icon: "📻" },
  tv: { name: "TV Advert", cost: 300_000, days: 5, mult: 1.5, icon: "📺" },
  influencer: { name: "Influencer Day", cost: 200_000, days: 2, mult: 1.8, icon: "🤳" },
} as const;
export type CampaignKind = keyof typeof CAMPAIGNS;
export const HANGOVER_RATING = 500;
export const HANGOVER_MULT = 0.8;
export const HANGOVER_DAYS = 2;
