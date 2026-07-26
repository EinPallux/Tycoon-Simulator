"use client";

/**
 * Milestone tier celebration (GAME_DESIGN.md §10.1): a stats roll-up
 * exclamation point, not an interruption — the park keeps living behind it.
 */

import { MILESTONES } from "@/sim/rating";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { useGameStore } from "@/ui/stores/gameStore";

const TIER_FLAIR = ["🎈", "🌟", "🏆", "👑", "🌍"];

export function MilestoneSheet() {
  const data = useGameStore((s) => s.milestoneSheet);
  const setMilestoneSheet = useGameStore((s) => s.setMilestoneSheet);
  const sim = useGameStore.getState().sim;
  if (!data || !sim) return null;
  const world = sim.world;
  const nextTier = MILESTONES[data.tier + 1];

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink-900/70 backdrop-blur-[2px]"
      onClick={() => setMilestoneSheet(null)}
    >
      <div
        className="panel-shadow-light w-[min(92vw,460px)] overflow-hidden rounded-sm bg-paper-050 text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rays bg-accent-500 px-6 py-5 text-center">
          <div className="text-4xl" aria-hidden>
            {TIER_FLAIR[data.tier] ?? "🏆"}
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.25em] text-ink-900/70">
            Milestone reached
          </div>
          <div className="display-hero text-4xl text-ink-900">{data.name}</div>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-2 gap-2 text-center">
            <Fact label="Award" value={`+${formatMoney(data.award)}`} good />
            <Fact label="Park rating" value={`${world.rating.value}`} />
            <Fact label="Lifetime guests" value={`${world.lifetimeGuests}`} />
            <Fact label="Day" value={`${Math.floor(world.time / 900) + 1}`} />
          </div>
          {nextTier ? (
            <p className="text-center text-xs text-ink-600">
              Next up: <b>{nextTier.name}</b> — rating {nextTier.rating}+ and{" "}
              {nextTier.lifetimeGuests}+ lifetime guests for {formatMoney(nextTier.award)}.
            </p>
          ) : (
            <p className="text-center text-xs text-ink-600">
              That was the top of the mountain. Penny is openly weeping with pride.
            </p>
          )}
          <div className="flex justify-center">
            <Button size="sm" onClick={() => setMilestoneSheet(null)}>
              Back to the park
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="bg-paper-100 px-3 py-2">
      <div className={`tabular text-lg font-extrabold ${good ? "text-good-500" : ""}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-600">{label}</div>
    </div>
  );
}
