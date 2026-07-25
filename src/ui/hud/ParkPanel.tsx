"use client";

/**
 * The park management panel — Finances / Guests / Rating tabs
 * (UI_UX_DESIGN.md §7.6). Opens from the dock's Manage button, the rating
 * chip, or the objective chip.
 */

import { useEffect, useState } from "react";
import { ledgerDayTotals } from "@/sim/economy";
import { MILESTONES, RATING_WEIGHTS, ratingHints } from "@/sim/rating";
import { formatMoney } from "@/ui/format";
import { Panel } from "@/ui/kit/Panel";
import { Slider } from "@/ui/kit/Slider";
import { useGameStore, type ParkPanelTab } from "@/ui/stores/gameStore";

const TABS: { id: ParkPanelTab; label: string }[] = [
  { id: "finances", label: "Finances" },
  { id: "guests", label: "Guests" },
  { id: "rating", label: "Rating" },
];

export function ParkPanel() {
  const parkPanel = useGameStore((s) => s.parkPanel);
  const setParkPanel = useGameStore((s) => s.setParkPanel);
  const [, pulse] = useState(0);

  useEffect(() => {
    if (parkPanel === null) return;
    const timer = setInterval(() => pulse((n) => n + 1), 600);
    return () => clearInterval(timer);
  }, [parkPanel]);

  if (parkPanel === null) return null;
  const sim = useGameStore.getState().sim;
  if (!sim) return null;

  return (
    <div className="pointer-events-auto absolute right-4 top-20 w-96 max-w-[calc(100vw-2rem)]">
      <Panel
        title="Park Management"
        onClose={() => setParkPanel(null)}
        headerExtra={
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setParkPanel(tab.id)}
                className={`cursor-pointer px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  parkPanel === tab.id
                    ? "bg-accent-500 text-ink-900"
                    : "text-paper-050/60 hover:text-paper-050"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {parkPanel === "finances" && <FinancesTab />}
        {parkPanel === "guests" && <GuestsTab />}
        {parkPanel === "rating" && <RatingTab />}
      </Panel>
    </div>
  );
}

function FinancesTab() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const world = sim.world;
  const today = ledgerDayTotals(world.economy.today);
  const yesterday = world.economy.history[0];

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="-mx-2">
        <Slider
          label="Park entry"
          value={world.economy.entryPrice / 100}
          min={0}
          max={40}
          step={1}
          onChange={(v) => sim.dispatch({ type: "set-entry-price", price: Math.round(v * 100) })}
          format={(v) => `$${v}`}
        />
      </div>
      <p className="-mt-1 text-xs text-ink-600">
        Pricey gates thin the crowd; free entry packs the paths and bets on tickets & snacks.
      </p>

      <SectionTitle>Today so far</SectionTitle>
      <LedgerRow label="🎟 Entry tickets" value={world.economy.today.income.entry} />
      <LedgerRow label="🎢 Ride tickets" value={world.economy.today.income.rides} />
      <LedgerRow label="🍔 Stall sales" value={world.economy.today.income.stalls} />
      <LedgerRow label="🔧 Upkeep" value={-world.economy.today.expense.upkeep} />
      <LedgerRow label="📦 Cost of goods" value={-world.economy.today.expense.goods} />
      <LedgerRow label="🏗 Construction" value={-world.economy.today.expense.construction} />
      <div className="border-t border-paper-200 pt-2">
        <LedgerRow label="Net today" value={today.net} bold />
        {yesterday && <LedgerRow label="Net yesterday" value={ledgerDayTotals(yesterday).net} />}
      </div>

      <SectionTitle>The books</SectionTitle>
      <LedgerRow label="Cash" value={world.cash} bold />
      <LedgerRow label="Debt (interest arrives Phase 3)" value={-world.debt} />
      <LedgerRow label="Lifetime income" value={world.economy.lifetimeIncome} />
      <LedgerRow label="Lifetime spend" value={-world.economy.lifetimeExpense} />
    </div>
  );
}

function GuestsTab() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const g = sim.world.guests;
  let moodSum = 0;
  let hungrySouls = 0;
  let thirstySouls = 0;
  let burstingSouls = 0;
  let boredSouls = 0;
  for (let i = 0; i < g.count; i++) {
    moodSum += g.mood[i] as number;
    if ((g.hunger[i] as number) < 35) hungrySouls++;
    if ((g.thirst[i] as number) < 35) thirstySouls++;
    if ((g.bladder[i] as number) > 65) burstingSouls++;
    if ((g.fun[i] as number) < 35) boredSouls++;
  }
  const avgMood = g.count > 0 ? Math.round(moodSum / g.count) : 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <BigStat label="In the park" value={`${g.count}`} />
        <BigStat label="Lifetime visits" value={`${sim.world.lifetimeGuests}`} />
        <BigStat label="Average mood" value={g.count > 0 ? `${avgMood}` : "—"} />
        <BigStat label="Litter items" value={`${sim.world.litter.length}`} />
      </div>
      <SectionTitle>Trending needs</SectionTitle>
      {g.count === 0 ? (
        <p className="text-xs text-ink-600">
          Nobody home yet. Connect paths to the entrance, keep the rating up, and mind the clock —
          the crowd arrives from mid-morning.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          <TrendRow count={hungrySouls} total={g.count} label="are hungry — food stalls print money now" />
          <TrendRow count={thirstySouls} total={g.count} label="are thirsty — drinks sell themselves" />
          <TrendRow count={burstingSouls} total={g.count} label="urgently need toilets" />
          <TrendRow count={boredSouls} total={g.count} label="are bored — more rides!" />
        </ul>
      )}
    </div>
  );
}

function TrendRow({ count, total, label }: { count: number; total: number; label: string }) {
  if (count === 0) return null;
  const urgent = count / total > 0.25;
  return (
    <li className={`px-2 py-1 ${urgent ? "bg-danger-500/15 text-danger-600" : "bg-paper-100"}`}>
      <b>{count}</b> guest{count === 1 ? "" : "s"} {label}
    </li>
  );
}

function RatingTab() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const world = sim.world;
  const hints = ratingHints(world);
  const nextTier = MILESTONES[world.milestoneTier + 1];

  const TERM_LABEL: Record<keyof typeof RATING_WEIGHTS, string> = {
    happiness: "Guest happiness",
    rides: "Ride portfolio",
    cleanliness: "Cleanliness",
    scenery: "Scenery & beauty",
    value: "Value for money",
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="text-center">
        <div className="tabular display-hero text-5xl not-italic text-ink-900">
          {world.rating.value}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-600">
          Park rating / 1000
        </div>
      </div>
      {(Object.keys(RATING_WEIGHTS) as (keyof typeof RATING_WEIGHTS)[]).map((term) => (
        <div key={term} className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-xs font-semibold text-ink-600">
            {TERM_LABEL[term]}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-900/10">
            <div
              className={`h-full ${world.rating.terms[term] > 0.6 ? "bg-good-500" : world.rating.terms[term] > 0.3 ? "bg-card-orange" : "bg-danger-500"}`}
              style={{ width: `${Math.round(world.rating.terms[term] * 100)}%` }}
            />
          </div>
          <span className="tabular w-8 text-right text-xs font-bold">
            {Math.round(world.rating.terms[term] * 100)}
          </span>
        </div>
      ))}

      {hints.length > 0 && (
        <>
          <SectionTitle>What&apos;s hurting you</SectionTitle>
          <ul className="flex flex-col gap-1">
            {hints.map((hint) => (
              <li key={hint.term} className="bg-paper-100 px-2 py-1.5 text-xs">
                {hint.message}
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Next milestone</SectionTitle>
      {nextTier ? (
        <div className="bg-paper-100 px-3 py-2 text-xs">
          <b>{nextTier.name}</b> — rating {nextTier.rating}+ and {nextTier.lifetimeGuests}+ lifetime
          guests. Award: <b>{formatMoney(nextTier.award)}</b>
        </div>
      ) : (
        <p className="text-xs text-ink-600">You&apos;ve reached World Wonder. Penny is speechless.</p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-ink-600">
      {children}
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-100 px-3 py-2 text-center">
      <div className="tabular text-xl font-extrabold text-ink-900">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-600">{label}</div>
    </div>
  );
}

function LedgerRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-extrabold" : ""}`}>
      <span className={bold ? "" : "text-ink-600"}>{label}</span>
      <span className={`tabular ${value < 0 ? "text-danger-500" : value > 0 ? "text-good-500" : ""}`}>
        {value < 0 ? "−" : ""}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}
