"use client";

/**
 * Guided Start (GAME_DESIGN.md §12): Penny's opening checklist for parks
 * created with the toggle ON. Steps are PREDICATES over world state — no
 * stored progress, no scripted mode; the park being built is the real park.
 * Skippable at any second; auto-retires with a cheer when finished.
 */

import { useEffect, useMemo, useState } from "react";
import { SURFACE_PATH, SURFACE_QUEUE } from "@/sim/world/tiles";
import type { World } from "@/sim/world/world";
import { sfx } from "@/audio/bus";
import { toast } from "@/ui/kit/Toast";
import { useGameStore } from "@/ui/stores/gameStore";

interface GuidedStep {
  id: string;
  label: string;
  hint: string;
  done(world: World): boolean;
}

const countSurface = (world: World, surface: number): number => {
  let n = 0;
  for (let i = 0; i < world.tiles.surface.length; i++) {
    if (world.tiles.surface[i] === surface) n++;
  }
  return n;
};

const hasStallKind = (world: World, pattern: RegExp): boolean => {
  for (const id of world.stalls.keys()) {
    const entity = world.placeables.get(id);
    if (entity && pattern.test(entity.defId)) return true;
  }
  return false;
};

const STEPS: GuidedStep[] = [
  {
    id: "path",
    label: "Lay a path from the gate",
    hint: "Open the Paths tray (B) and drag a path north from the entrance.",
    done: (w) => countSurface(w, SURFACE_PATH) >= 5,
  },
  {
    id: "ride",
    label: "Place your first ride",
    hint: "Rides tray → the Carousel is a crowd-pleaser. Keep it near the path.",
    done: (w) => w.rides.size >= 1,
  },
  {
    id: "queue",
    label: "Give it a queue",
    hint: "Paint 2+ queue tiles from the path to the ride so guests can line up.",
    done: (w) => countSurface(w, SURFACE_QUEUE) >= 2,
  },
  {
    id: "guests",
    label: "Welcome 10 guests",
    hint: "With a path to the gate and a ride open, the crowd finds you.",
    done: (w) => w.lifetimeGuests >= 10,
  },
  {
    id: "needs",
    label: "Food, drink & toilets",
    hint: "One of each keeps a day trip from ending early.",
    done: (w) => hasStallKind(w, /food|candy/) && hasStallKind(w, /drinks|coffee/) && hasStallKind(w, /toilets/),
  },
  {
    id: "janitor",
    label: "Hire a janitor",
    hint: "Staff tray → Janitor. Litter breeds grumbles (and, eventually, rats).",
    done: (w) => w.staff.some((s) => s.role === "janitor"),
  },
  {
    id: "rating",
    label: "Reach park rating 300",
    hint: "Happy guests, working rides, clean paths, fair prices — the chip up top tracks it.",
    done: (w) => w.rating.value >= 300,
  },
];

export function GuidedChecklist() {
  const worldVersion = useGameStore((s) => s.worldVersion);
  const sim = useGameStore((s) => s.sim);
  const [, pulse] = useState(0);
  const [celebrated, setCelebrated] = useState(false);

  // Live predicate refresh (rating/guests move without world edits).
  useEffect(() => {
    const timer = setInterval(() => pulse((n) => n + 1), 1500);
    return () => clearInterval(timer);
  }, []);

  const state = useMemo(() => {
    if (!sim) return null;
    const world = sim.world;
    if (!world.meta.guidedStart || world.guidedDismissed) return null;
    const done = STEPS.map((step) => step.done(world));
    const firstOpen = done.indexOf(false);
    return { done, firstOpen, doneCount: done.filter(Boolean).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion + pulse drive re-derivation
  }, [sim, worldVersion, pulse]);

  // All steps complete → cheer once, then retire the checklist for good.
  useEffect(() => {
    if (!state || !sim) return;
    if (state.firstOpen === -1 && !celebrated) {
      setCelebrated(true);
      toast("success", "🎀 Penny: The training wheels are off — this park is officially YOURS!");
      sfx.fanfare();
      sim.dispatch({ type: "dismiss-guided" });
    }
  }, [state, sim, celebrated]);

  if (!sim || !state || state.firstOpen === -1) return null;

  return (
    <div className="pointer-events-auto absolute left-4 top-16 w-72">
      <div className="panel-shadow-light overflow-hidden rounded-sm bg-paper-050 text-ink-900">
        <div className="flex items-center gap-2 bg-card-magenta px-3 py-2 text-paper-050">
          <span aria-hidden className="text-base">
            🎀
          </span>
          <span className="display-hero flex-1 text-sm not-italic tracking-wide">
            Penny&apos;s Guided Start
          </span>
          <button
            onClick={() => sim.dispatch({ type: "dismiss-guided" })}
            title="Skip the guided start (forever)"
            className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-paper-050/80 hover:text-paper-050"
          >
            Skip
          </button>
        </div>
        <ol className="flex flex-col gap-0.5 p-2">
          {STEPS.map((step, i) => {
            const done = state.done[i] ?? false;
            const current = i === state.firstOpen;
            return (
              <li
                key={step.id}
                className={`px-2 py-1 text-xs ${
                  done
                    ? "text-ink-600/60 line-through"
                    : current
                      ? "bg-accent-500/15 font-bold"
                      : "text-ink-600"
                }`}
              >
                <span className="mr-1.5" aria-hidden>
                  {done ? "✅" : current ? "👉" : "○"}
                </span>
                {step.label}
                {current && <p className="ml-6 mt-0.5 text-[11px] font-normal">{step.hint}</p>}
              </li>
            );
          })}
        </ol>
        <div className="h-1 bg-ink-900/10">
          <div
            className="h-full bg-card-magenta transition-all duration-500"
            style={{ width: `${Math.round((state.doneCount / STEPS.length) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
