/** Economy balance (GAME_DESIGN.md §15.6). All money in integer cents. */

export const DEFAULT_ENTRY_PRICE = 1_500; // $15

/** Ledger reporting buckets. */
export type IncomeSource = "entry" | "rides" | "stalls" | "refunds";
export type ExpenseSource = "construction" | "upkeep" | "goods";

/** Days of P&L history kept for the Finances panel. */
export const LEDGER_HISTORY_DAYS = 14;

/** Value-perception EMA step per verdict event (doc §15.4 value term). */
export const VALUE_EMA_ALPHA = 0.06;
