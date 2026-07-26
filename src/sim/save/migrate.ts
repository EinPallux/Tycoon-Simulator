/**
 * Save migration chain (TECHNICAL_ARCHITECTURE.md §9).
 * Each entry upgrades formatVersion N → N+1. The loader walks the chain,
 * then validates against the latest schema. Every migration ships with a
 * fixture test in __tests__/.
 */

import { CURRENT_FORMAT_VERSION, saveV4Schema, type SaveFile } from "./schema";

type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version the migration upgrades FROM. */
/** Exported for the chain regression test. */
export const MIGRATIONS: Record<number, Migration> = {
  /**
   * v1 (Phase 1, builds only) → v2 (Phase 2, the living park).
   * Parks gain an empty guest population, default economy books, and
   * default runtime state for any placed rides/stalls (none existed in v1).
   */
  1: (save) => ({
    ...save,
    formatVersion: 2,
    guests: [],
    guestIdCounter: 0,
    lifetimeGuests: 0,
    rides: [],
    stalls: [],
    economy: {
      entryPrice: 1_500,
      today: {
        day: Math.floor((typeof save.time === "number" ? save.time : 0) / 900) + 1,
        income: { entry: 0, rides: 0, stalls: 0, refunds: 0 },
        expense: { construction: 0, upkeep: 0, goods: 0 },
      },
      history: [],
      lifetimeIncome: 0,
      lifetimeExpense: 0,
    },
    litter: [],
    valueEma: 0.7,
    milestoneTier: -1,
    spawnAcc: 0,
  }),
  /**
   * v2 (living park) → v3 (coasters & chaos): coasters, staff, weather,
   * research, loans, events, marketing; ride reliability; wider ledger.
   */
  2: (save) => {
    const widenLedger = (ledger: unknown): unknown => {
      const l = ledger as { expense?: Record<string, number> };
      return {
        ...(ledger as Record<string, unknown>),
        expense: {
          construction: 0,
          upkeep: 0,
          goods: 0,
          wages: 0,
          interest: 0,
          repairs: 0,
          research: 0,
          marketing: 0,
          ...(l.expense ?? {}),
        },
      };
    };
    const economy = save.economy as {
      today: unknown;
      history: unknown[];
    } & Record<string, unknown>;
    const time = typeof save.time === "number" ? save.time : 0;
    return {
      ...save,
      formatVersion: 3,
      economy: {
        ...economy,
        today: widenLedger(economy.today),
        history: economy.history.map(widenLedger),
      },
      rides: (save.rides as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        reliability: 100,
      })),
      coasters: [],
      staff: [],
      staffIdCounter: 0,
      weather: { current: "sun", next: "cloud", changeAt: time + 450 },
      research: {
        done: { thrill: 0, family: 0, food: 0, ops: 0 },
        active: null,
        funding: 1,
        progressDays: 0,
        perks: [],
      },
      loans: { tranches: 0, missedPayments: 0, bankrupt: false },
      events: { nextAt: time + 1800 },
      marketing: { activeKind: null, activeEndsAt: 0, hangoverUntil: 0 },
    };
  },
  /**
   * v3 (coasters & chaos) → v4 (progression & polish): lifetime tallies,
   * the Opportunities engine, zone names, bonus unlocks, guided-start flag.
   * Mature parks skip the Guided Start rather than suddenly tutoring.
   */
  3: (save) => {
    const time = typeof save.time === "number" ? save.time : 0;
    const meta = save.meta as { guidedStart?: boolean } | undefined;
    return {
      ...save,
      formatVersion: 4,
      tallies: {
        peakGuests: 0,
        happyLeavers: 0,
        guestsLeft: 0,
        stallSales: 0,
        toiletUses: 0,
        coasterRiders: 0,
        breakdowns: 0,
        lastBreakdownAt: -100_000,
        mechanicRepairs: 0,
        litterSwept: 0,
        sceneryPlaced: 0,
        loansTaken: 0,
        centsRepaid: 0,
        campaignsRun: 0,
        researchCompleted: 0,
        zonesFormed: 0,
        opportunitiesDone: 0,
      },
      opportunities: {
        offered: null,
        offerExpiresAt: 0,
        active: [],
        nextOfferAt: time + 1080,
        idCounter: 0,
        completed: 0,
      },
      zoneNames: {},
      bonusUnlocks: [],
      guidedDismissed: !(meta?.guidedStart ?? false),
    };
  },
};

export class SaveFormatError extends Error {}

export function migrateSave(raw: unknown): SaveFile {
  if (typeof raw !== "object" || raw === null) {
    throw new SaveFormatError("Save file is not an object");
  }
  let save = raw as Record<string, unknown>;
  const rawVersion = save.formatVersion;
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 1) {
    throw new SaveFormatError("Save file has no valid formatVersion");
  }
  if (rawVersion > CURRENT_FORMAT_VERSION) {
    throw new SaveFormatError(
      `Save is from a newer version of the game (v${rawVersion} > v${CURRENT_FORMAT_VERSION})`,
    );
  }
  let version: number = rawVersion;
  while (version < CURRENT_FORMAT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveFormatError(`No migration path from save version ${version}`);
    save = step(save);
    const next = save.formatVersion;
    if (typeof next !== "number" || next !== version + 1) {
      throw new SaveFormatError(`Migration from v${version} produced v${String(next)}`);
    }
    version = next;
  }
  const parsed = saveV4Schema.safeParse(save);
  if (!parsed.success) {
    throw new SaveFormatError(`Save failed validation: ${parsed.error.issues[0]?.message ?? "?"}`);
  }
  return parsed.data;
}
