"use client";

/**
 * The park management panel — Finances / Guests / Rating tabs
 * (UI_UX_DESIGN.md §7.6). Opens from the dock's Manage button, the rating
 * chip, or the objective chip.
 */

import { useEffect, useState } from "react";
import { FUNDING_LEVELS, RESEARCH_BRANCHES, type ResearchBranchId } from "@/content/research";
import {
  CAMPAIGNS,
  CREDIT_LIMIT_RATE,
  LOAN_RATE_STEP,
  LOAN_TRANCHE,
  type CampaignKind,
} from "@/sim/balance/phase3";
import { computeParkValue } from "@/sim/commands";
import { ledgerDayTotals } from "@/sim/economy";
import { MILESTONES, RATING_WEIGHTS, ratingHints } from "@/sim/rating";
import { activeNode, hasPerk } from "@/sim/research";
import { DIFFICULTY_PRESETS } from "@/sim/world/world";
import { TICKS_PER_DAY } from "@/sim/world/time";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { Panel } from "@/ui/kit/Panel";
import { Slider } from "@/ui/kit/Slider";
import { useGameStore, type ParkPanelTab } from "@/ui/stores/gameStore";

const TABS: { id: ParkPanelTab; label: string }[] = [
  { id: "finances", label: "Finances" },
  { id: "research", label: "Research" },
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
        title="Park"
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
        {parkPanel === "research" && <ResearchTab />}
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

      <SectionTitle>Today so far — the chaos column</SectionTitle>
      <LedgerRow label="🧹 Wages" value={-world.economy.today.expense.wages} />
      <LedgerRow label="🏦 Interest" value={-world.economy.today.expense.interest} />
      <LedgerRow label="🔩 Repairs & fines" value={-world.economy.today.expense.repairs} />
      <LedgerRow label="🔬 Research" value={-world.economy.today.expense.research} />
      <LedgerRow label="📣 Marketing" value={-world.economy.today.expense.marketing} />

      <LoansSection />
      <MarketingSection />

      <SectionTitle>The books</SectionTitle>
      <LedgerRow label="Cash" value={world.cash} bold />
      <LedgerRow label="Debt" value={-world.debt} />
      <LedgerRow label="Lifetime income" value={world.economy.lifetimeIncome} />
      <LedgerRow label="Lifetime spend" value={-world.economy.lifetimeExpense} />
    </div>
  );
}

function LoansSection() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const world = sim.world;
  const apr =
    DIFFICULTY_PRESETS[world.meta.difficulty].interestApr + world.loans.tranches * LOAN_RATE_STEP;
  const limit = Math.round(computeParkValue(world) * CREDIT_LIMIT_RATE) + 1_000_000;

  return (
    <>
      <SectionTitle>The bank</SectionTitle>
      <LedgerRow label="Outstanding debt" value={-world.debt} bold />
      <div className="flex justify-between text-xs text-ink-600">
        <span>Interest rate</span>
        <span className="tabular">{(apr * 100).toFixed(1)}% APR, charged daily</span>
      </div>
      <div className="flex justify-between text-xs text-ink-600">
        <span>Credit limit (park value based)</span>
        <span className="tabular">{formatMoney(limit)}</span>
      </div>
      {world.loans.missedPayments > 0 && (
        <p className="bg-danger-500/15 px-2 py-1.5 text-xs font-bold text-danger-600">
          ⚠ {world.loans.missedPayments} missed payment{world.loans.missedPayments > 1 ? "s" : ""} —
          at 3 the bank starts seizing rides!
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => sim.dispatch({ type: "take-loan" })}
          disabled={world.debt + LOAN_TRANCHE > limit}
        >
          Borrow {formatMoney(LOAN_TRANCHE)}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="!border-ink-900/40 !text-ink-900 hover:!border-accent-600 hover:!text-accent-600"
          onClick={() => sim.dispatch({ type: "repay-loan" })}
          disabled={world.debt <= 0 || world.cash < Math.min(LOAN_TRANCHE, world.debt)}
        >
          Repay {formatMoney(Math.min(LOAN_TRANCHE, Math.max(1, world.debt)))}
        </Button>
      </div>
    </>
  );
}

function MarketingSection() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const world = sim.world;
  const licensed = hasPerk(world, "marketing");
  const active = world.marketing.active;
  const hungover = world.time < world.marketing.hangoverUntil;

  return (
    <>
      <SectionTitle>Marketing</SectionTitle>
      {!licensed ? (
        <p className="text-xs text-ink-600">
          🔒 Research the <b>Marketing Licence</b> (Operations branch) to run ad campaigns.
        </p>
      ) : active ? (
        <p className="bg-paper-100 px-2 py-1.5 text-xs">
          {CAMPAIGNS[active.kind].icon} <b>{CAMPAIGNS[active.kind].name}</b> is live —{" "}
          {Math.max(1, Math.ceil((active.endsAt - world.time) / TICKS_PER_DAY))} day(s) left,
          arrivals ×{CAMPAIGNS[active.kind].mult}.
        </p>
      ) : (
        <>
          {hungover && (
            <p className="text-xs text-ink-600">
              😮‍💨 Post-campaign hangover — arrivals slightly down for a bit. The crowd remembers
              the hype.
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(CAMPAIGNS) as CampaignKind[]).map((kind) => {
              const c = CAMPAIGNS[kind];
              return (
                <button
                  key={kind}
                  disabled={world.cash < c.cost}
                  onClick={() => sim.dispatch({ type: "start-campaign", kind })}
                  className="flex cursor-pointer flex-col items-start gap-0.5 bg-paper-100 px-2.5 py-1.5 text-left transition-colors hover:bg-paper-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="text-xs font-bold">
                    {c.icon} {c.name}
                  </span>
                  <span className="text-[10px] text-ink-600">
                    {formatMoney(c.cost)} · {c.days}d · arrivals ×{c.mult}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function ResearchTab() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const world = sim.world;
  const research = world.research;
  const node = activeNode(world);
  const funding = FUNDING_LEVELS[research.funding] ?? FUNDING_LEVELS[1];
  const progress = node ? Math.min(1, research.progressDays / node.days) : 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {world.meta.freeplayUnlocks ? (
        <p className="bg-paper-100 px-3 py-2 text-xs">
          🔓 This park runs <b>freeplay unlocks</b> — everything is available from day one.
          Research still earns the perk nodes below.
        </p>
      ) : (
        <p className="text-xs text-ink-600">
          Pick a branch, set the funding, and your boffins deliver — new rides, stalls and
          park-wide perks.
        </p>
      )}

      <SectionTitle>Funding</SectionTitle>
      <div className="flex gap-1.5">
        {FUNDING_LEVELS.map((level, i) => (
          <button
            key={level.label}
            onClick={() => sim.dispatch({ type: "set-research-funding", level: i })}
            className={`flex-1 cursor-pointer px-2 py-1.5 text-center text-xs font-bold uppercase transition-colors ${
              research.funding === i
                ? "bg-accent-500 text-ink-900"
                : "bg-paper-100 text-ink-600 hover:bg-paper-200"
            }`}
          >
            {level.label}
            <span className="block text-[9px] font-semibold normal-case opacity-70">
              {level.perDay === 0 ? "$0/day" : `${formatMoney(level.perDay)}/day`}
            </span>
          </button>
        ))}
      </div>

      {node && research.active && funding && funding.speed > 0 && (
        <div className="bg-paper-100 px-3 py-2">
          <div className="flex justify-between text-xs">
            <b>Researching: {node.name}</b>
            <span className="tabular text-ink-600">
              ~{Math.max(1, Math.ceil((node.days - research.progressDays) / funding.speed))}d left
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-900/10">
            <div className="h-full bg-accent-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      <SectionTitle>Branches</SectionTitle>
      {RESEARCH_BRANCHES.map((branch) => {
        const done = research.done[branch.id as ResearchBranchId];
        const isActive = research.active === branch.id;
        const next = branch.nodes[done];
        return (
          <button
            key={branch.id}
            onClick={() => sim.dispatch({ type: "set-research", branch: branch.id })}
            disabled={done >= branch.nodes.length}
            className={`flex cursor-pointer flex-col gap-1 px-3 py-2 text-left transition-colors ${
              isActive ? "bg-ink-900 text-paper-050" : "bg-paper-100 hover:bg-paper-200"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide">
                {branch.icon} {branch.name}
              </span>
              <span className="flex gap-0.5">
                {branch.nodes.map((n, i) => (
                  <span
                    key={n.id}
                    title={`${n.name} — ${n.blurb}`}
                    className={`inline-block h-2 w-2 rounded-full ${
                      i < done ? "bg-good-500" : isActive && i === done ? "bg-accent-500" : isActive ? "bg-paper-050/25" : "bg-ink-900/15"
                    }`}
                  />
                ))}
              </span>
            </span>
            <span className={`text-[11px] ${isActive ? "text-paper-050/70" : "text-ink-600"}`}>
              {next ? (
                <>
                  Next: <b>{next.name}</b> — {next.blurb}
                </>
              ) : (
                "Branch complete — the boffins take a bow."
              )}
            </span>
          </button>
        );
      })}

      {research.perks.length > 0 && (
        <>
          <SectionTitle>Perks in effect</SectionTitle>
          <div className="flex flex-wrap gap-1">
            {research.perks.map((perk) => (
              <span key={perk} className="bg-good-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-good-500">
                {perk.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        </>
      )}
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
      <ThoughtsSection />
    </div>
  );
}

/** The park's word cloud: most-repeated recent guest thoughts. */
function ThoughtsSection() {
  const sim = useGameStore.getState().sim;
  if (!sim) return null;
  const g = sim.world.guests;
  const tally = new Map<string, number>();
  for (let i = 0; i < g.count; i++) {
    const cold = g.cold.get(g.ids[i] as number);
    if (!cold) continue;
    for (const thought of cold.thoughts) {
      tally.set(thought, (tally.get(thought) ?? 0) + 1);
    }
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) return null;
  return (
    <>
      <SectionTitle>Overheard in the park</SectionTitle>
      <ul className="flex flex-col gap-1 text-xs">
        {top.map(([thought, count]) => (
          <li key={thought} className="flex items-start justify-between gap-2 bg-paper-100 px-2 py-1">
            <span className="italic">“{thought}”</span>
            {count > 1 && <b className="tabular shrink-0 text-ink-600">×{count}</b>}
          </li>
        ))}
      </ul>
    </>
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
