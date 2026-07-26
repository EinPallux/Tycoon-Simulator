"use client";

/**
 * The park-over sheet (GAME_DESIGN.md §6.3): the bank has foreclosed.
 * Family-safe comedic tone — a gentle full-screen curtain, not a game crash.
 */

import { useRouter } from "next/navigation";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { useGameStore } from "@/ui/stores/gameStore";

export function ParkOverSheet() {
  const router = useRouter();
  const parkOver = useGameStore((s) => s.parkOver);
  const sim = useGameStore.getState().sim;
  if (parkOver === null || !sim) return null;

  const world = sim.world;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink-900/85 backdrop-blur-sm">
      <div className="panel-shadow-light w-[min(92vw,480px)] overflow-hidden rounded-sm bg-paper-050 text-ink-900">
        <div className="bg-danger-500 px-6 py-4 text-paper-050">
          <div className="display-hero text-3xl">The bank owns the teacups now</div>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm">{parkOver}</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Fact label="Days operated" value={`${Math.max(1, Math.floor(world.time / 900))}`} />
            <Fact label="Lifetime guests" value={`${world.lifetimeGuests}`} />
            <Fact label="Best rating" value={`${world.rating.value}`} />
            <Fact label="Outstanding debt" value={formatMoney(world.debt)} />
          </div>
          <p className="text-xs text-ink-600">
            Every tycoon flops a park or two. The next one opens smarter — mind the loan
            payments, keep rides maintained, and let the rating climb before borrowing big.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="!border-ink-900/40 !text-ink-900 hover:!border-accent-600 hover:!text-accent-600"
              onClick={() => useGameStore.getState().setParkOver(null)}
            >
              Wander the ruins
            </Button>
            <Button size="sm" onClick={() => router.push("/hub")}>
              Back to the hub
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-100 px-3 py-2">
      <div className="tabular text-lg font-extrabold">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-600">{label}</div>
    </div>
  );
}
