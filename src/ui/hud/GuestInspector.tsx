"use client";

/** Guest inspector (GAME_DESIGN.md §5.5): needs, mood, wallet, thoughts, follow-cam. */

import { useEffect, useState } from "react";
import { GUEST_STATE } from "@/sim/entities/guests";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { Panel } from "@/ui/kit/Panel";
import { useGameStore } from "@/ui/stores/gameStore";

const STATE_LABEL: Record<number, string> = {
  [GUEST_STATE.approaching]: "Arriving",
  [GUEST_STATE.strolling]: "Strolling",
  [GUEST_STATE.traveling]: "Off to something fun",
  [GUEST_STATE.queuing]: "Queuing",
  [GUEST_STATE.riding]: "On a ride!",
  [GUEST_STATE.buying]: "At a stall",
  [GUEST_STATE.leaving]: "Heading home",
  [GUEST_STATE.departing]: "Leaving the park",
};

export function GuestInspector() {
  const selectedGuest = useGameStore((s) => s.selectedGuest);
  const followGuest = useGameStore((s) => s.followGuest);
  const selectGuest = useGameStore((s) => s.selectGuest);
  const setFollowGuest = useGameStore((s) => s.setFollowGuest);
  const [, pulse] = useState(0);

  useEffect(() => {
    if (selectedGuest === null) return;
    const timer = setInterval(() => pulse((n) => n + 1), 400);
    return () => clearInterval(timer);
  }, [selectedGuest]);

  if (selectedGuest === null) return null;
  const sim = useGameStore.getState().sim;
  const slot = sim?.world.guests.slotOf.get(selectedGuest);
  const cold = sim?.world.guests.cold.get(selectedGuest);
  if (!sim || slot === undefined || !cold) return null;
  const g = sim.world.guests;
  const mood = g.mood[slot] as number;

  return (
    <div className="pointer-events-auto absolute left-4 top-20 w-80">
      <Panel title={cold.name} onClose={() => selectGuest(null)}>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span
              className={`skewed px-2 py-0.5 text-[11px] font-bold uppercase text-paper-050 ${
                mood > 65 ? "bg-good-500" : mood > 35 ? "bg-card-orange" : "bg-danger-500"
              }`}
            >
              <span className="unskew inline-block">
                {mood > 65 ? "Having a blast" : mood > 35 ? "Doing okay" : "Miserable"}
              </span>
            </span>
            <span className="text-xs text-ink-600">
              {STATE_LABEL[g.state[slot] as number] ?? "…"}
            </span>
          </div>

          <NeedBar label="Mood" value={mood} accent />
          <NeedBar label="Fun" value={g.fun[slot] as number} />
          <NeedBar label="Hunger" value={g.hunger[slot] as number} />
          <NeedBar label="Thirst" value={g.thirst[slot] as number} />
          <NeedBar label="Energy" value={g.energy[slot] as number} />
          <NeedBar label="Bladder" value={100 - (g.bladder[slot] as number)} />

          <div className="flex justify-between">
            <span className="text-ink-600">Wallet</span>
            <b className="tabular">{formatMoney(cold.money)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Rides ridden</span>
            <b>{cold.ridesRidden}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Style</span>
            <b>{cold.thrill > 0.66 ? "Thrill-seeker" : cold.thrill > 0.33 ? "Easygoing" : "Gentle soul"}</b>
          </div>

          {cold.thoughts.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-600">
                Recent thoughts
              </div>
              <ul className="flex flex-col gap-1">
                {cold.thoughts.slice(0, 5).map((thought, i) => (
                  <li key={i} className="bg-paper-100 px-2 py-1 text-xs italic text-ink-900">
                    “{thought}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            size="sm"
            variant={followGuest ? "primary" : "secondary"}
            className={followGuest ? "" : "!border-ink-900/40 !text-ink-900"}
            onClick={() => setFollowGuest(!followGuest)}
          >
            {followGuest ? "📷 Following — click to stop" : "📷 Follow this guest"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function NeedBar({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  const v = Math.round(value);
  const color = accent
    ? "bg-accent-500"
    : v > 60
      ? "bg-good-500"
      : v > 30
        ? "bg-card-orange"
        : "bg-danger-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-ink-600">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-900/10">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${v}%` }} />
      </div>
      <span className="tabular w-8 shrink-0 text-right text-xs font-bold">{v}</span>
    </div>
  );
}
