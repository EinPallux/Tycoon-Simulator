/**
 * Achievements (GAME_DESIGN.md §10.4): 25 cross-save badges stored in the
 * local profile. Checks are cheap world predicates — the tallies do the
 * heavy remembering.
 */

import type { World } from "@/sim/world/world";

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  blurb: string;
  check(world: World): boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "grand-opening", icon: "🎈", name: "Grand Opening", blurb: "Welcome your very first guest.", check: (w) => w.lifetimeGuests >= 1 },
  { id: "century-crowd", icon: "👥", name: "Century Crowd", blurb: "Host 100 guests at once.", check: (w) => w.tallies.peakGuests >= 100 },
  { id: "homesick-hit", icon: "🏡", name: "Homesick Hit", blurb: "1,000 lifetime guests in one park.", check: (w) => w.lifetimeGuests >= 1_000 },
  { id: "people-person", icon: "🌆", name: "People Person", blurb: "10,000 lifetime guests in one park.", check: (w) => w.lifetimeGuests >= 10_000 },
  { id: "first-bloodless", icon: "💥", name: "First Blood(less)", blurb: "Survive 10 breakdowns. Nobody was ever in danger.", check: (w) => w.tallies.breakdowns >= 10 },
  { id: "wrench-wizard", icon: "🔧", name: "Wrench Wizard", blurb: "25 rides repaired by your mechanics.", check: (w) => w.tallies.mechanicRepairs >= 25 },
  { id: "spotless", icon: "🧹", name: "Spotless", blurb: "500 pieces of litter swept.", check: (w) => w.tallies.litterSwept >= 500 },
  { id: "bladder-economy", icon: "🚻", name: "Full Bladder Economy", blurb: "1,000 toilet visits. A civic triumph.", check: (w) => w.tallies.toiletUses >= 1_000 },
  { id: "snack-empire", icon: "🍔", name: "Snack Empire", blurb: "2,500 stall items sold.", check: (w) => w.tallies.stallSales >= 2_500 },
  { id: "loop-scholar", icon: "➰", name: "Loop Scholar", blurb: "A coaster with 3+ inversions and 7+ excitement.", check: (w) => {
      for (const c of w.coasters.values()) if (c.stats.inversions >= 3 && c.stats.excitement >= 7) return true;
      return false;
    } },
  { id: "gravity-artisan", icon: "🎢", name: "Gravity Artisan", blurb: "Design a coaster with 8+ excitement.", check: (w) => {
      for (const c of w.coasters.values()) if (c.stats.excitement >= 8) return true;
      return false;
    } },
  { id: "track-record", icon: "🚄", name: "Track Record", blurb: "5,000 coaster riders served.", check: (w) => w.tallies.coasterRiders >= 5_000 },
  { id: "fleet-admiral", icon: "🎡", name: "Fleet Admiral", blurb: "Nine rides operating in one park.", check: (w) => w.rides.size >= 9 },
  { id: "debt-free", icon: "🏦", name: "Debt-Free", blurb: "Repay $50,000 of loans, lifetime.", check: (w) => w.tallies.centsRepaid >= 5_000_000 },
  { id: "penny-pincher", icon: "🪙", name: "Penny Pincher", blurb: "Rating 500+ while charging $30+ at the gate.", check: (w) => w.rating.value >= 500 && w.economy.entryPrice >= 3_000 },
  { id: "zone-ranger", icon: "🏰", name: "Zone Ranger", blurb: "Three themed zones at once.", check: (w) => w.zones.length >= 3 },
  { id: "world-of-wander", icon: "🌍", name: "World of Wander", blurb: "Reach the World Wonder milestone.", check: (w) => w.milestoneTier >= 4 },
  { id: "ad-astra", icon: "📣", name: "Ad Astra", blurb: "Run 5 marketing campaigns.", check: (w) => w.tallies.campaignsRun >= 5 },
  { id: "lab-partner", icon: "🔬", name: "Lab Partner", blurb: "Complete 10 research nodes.", check: (w) => w.tallies.researchCompleted >= 10 },
  { id: "curriculum", icon: "🎓", name: "Complete Curriculum", blurb: "Finish every research node in one park.", check: (w) => w.tallies.researchCompleted >= 29 },
  { id: "opportunist", icon: "🎯", name: "Opportunist", blurb: "Complete 10 Opportunities, lifetime.", check: (w) => w.tallies.opportunitiesDone >= 10 },
  { id: "staff-party", icon: "🎉", name: "Staff Party", blurb: "Twelve staffers on the payroll.", check: (w) => w.staff.length >= 12 },
  { id: "five-star-fair", icon: "⭐", name: "Five-Star Fair", blurb: "Reach park rating 850.", check: (w) => w.rating.value >= 850 },
  { id: "marathon-manager", icon: "📅", name: "Marathon Manager", blurb: "Run one park for 30 days.", check: (w) => w.time >= 30 * 900 },
  { id: "happy-express", icon: "💖", name: "Happy Camper Express", blurb: "Send 500 guests home happy.", check: (w) => w.tallies.happyLeavers >= 500 },
];

/** Cross-park records shown in the hub Records tab. */
export interface RecordEntry {
  value: number;
  park: string;
}

export interface RecordsState {
  bestRating: RecordEntry;
  peakGuests: RecordEntry;
  richest: RecordEntry;
  bestCoaster: RecordEntry;
  longestRun: RecordEntry;
  /** Per-park lifetime contributions (summed for grand totals). */
  perPark: Record<string, { guests: number; riders: number }>;
}

export const EMPTY_RECORDS: RecordsState = {
  bestRating: { value: 0, park: "—" },
  peakGuests: { value: 0, park: "—" },
  richest: { value: 0, park: "—" },
  bestCoaster: { value: 0, park: "—" },
  longestRun: { value: 0, park: "—" },
  perPark: {},
};
