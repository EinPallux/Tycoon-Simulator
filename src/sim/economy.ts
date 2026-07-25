/**
 * Economy bookkeeping: cash movements + the reporting ledger.
 * Cash (world.cash) is exact truth; the ledger is the P&L narrative
 * (TECHNICAL_ARCHITECTURE §5 — economyAccrual).
 */

import { LEDGER_HISTORY_DAYS, type ExpenseSource, type IncomeSource } from "./balance/economy";
import { emptyDayLedger, type World } from "./world/world";

export function addIncome(world: World, source: IncomeSource, cents: number): void {
  if (cents <= 0) return;
  world.cash += cents;
  world.economy.today.income[source] += cents;
  world.economy.lifetimeIncome += cents;
}

export function addExpense(world: World, source: ExpenseSource, cents: number): void {
  if (cents <= 0) return;
  world.cash -= cents;
  world.economy.today.expense[source] += cents;
  world.economy.lifetimeExpense += cents;
}

/** Report-only entries (cash already moved elsewhere, e.g. build commands). */
export function noteIncome(world: World, source: IncomeSource, cents: number): void {
  if (cents <= 0) return;
  world.economy.today.income[source] += cents;
  world.economy.lifetimeIncome += cents;
}

export function noteExpense(world: World, source: ExpenseSource, cents: number): void {
  if (cents <= 0) return;
  world.economy.today.expense[source] += cents;
  world.economy.lifetimeExpense += cents;
}

export function ledgerDayTotals(ledger: World["economy"]["today"]): {
  income: number;
  expense: number;
  net: number;
} {
  const income = Object.values(ledger.income).reduce((a, b) => a + b, 0);
  const expense = Object.values(ledger.expense).reduce((a, b) => a + b, 0);
  return { income, expense, net: income - expense };
}

/** Close the day's books and start the next. */
export function rolloverLedger(world: World, newDay: number): void {
  world.economy.history.unshift(world.economy.today);
  if (world.economy.history.length > LEDGER_HISTORY_DAYS) {
    world.economy.history.length = LEDGER_HISTORY_DAYS;
  }
  world.economy.today = emptyDayLedger(newDay);
  for (const ride of world.rides.values()) ride.incomeToday = 0;
  for (const stall of world.stalls.values()) {
    stall.incomeToday = 0;
    stall.salesToday = 0;
  }
}
