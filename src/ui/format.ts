/** Presentation formatting helpers (money is integer cents internally). */

export function formatMoney(cents: number): string {
  const dollars = Math.trunc(cents / 100);
  const sign = dollars < 0 ? "-" : "";
  return `${sign}$${Math.abs(dollars).toLocaleString("en-US")}`;
}

export function formatCompact(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDay(day: number): string {
  return `Day ${day}`;
}
