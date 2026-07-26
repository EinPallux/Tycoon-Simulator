"use client";

/**
 * Penny, the park advisor (GAME_DESIGN.md §12–13): state-driven, throttled,
 * dismissible-forever hints + one-time event explainers. Never interrupts
 * building, never repeats a topic within 3 game-days, never blocks anything.
 */

import { useEffect, useRef, useState } from "react";
import { ratingHints } from "@/sim/rating";
import { TICKS_PER_DAY } from "@/sim/world/time";
import type { World } from "@/sim/world/world";
import { useAppStore } from "@/ui/stores/appStore";
import { useGameStore } from "@/ui/stores/gameStore";

interface PennyMessage {
  topic: string;
  text: string;
  /** Explainers get the "Got it" affordance; hints just close. */
  explainer: boolean;
}

interface HintRule {
  topic: string;
  when(world: World): boolean;
  text(world: World): string;
}

const needShare = (world: World, need: "hunger" | "thirst" | "bladder" | "fun"): number => {
  const g = world.guests;
  if (g.count === 0) return 0;
  let n = 0;
  for (let i = 0; i < g.count; i++) {
    const value = (need === "bladder" ? g.bladder[i] : g[need][i]) as number;
    if (need === "bladder" ? value > 65 : value < 35) n++;
  }
  return n / g.count;
};

const hasStall = (world: World, satisfies: string): boolean => {
  for (const id of world.stalls.keys()) {
    const entity = world.placeables.get(id);
    if (!entity) continue;
    // Def ids are stable — cheap contains-check against the satisfy kind.
    if (satisfies === "thirst" && /drinks|coffee/.test(entity.defId)) return true;
    if (satisfies === "hunger" && /food|candy/.test(entity.defId)) return true;
    if (satisfies === "bladder" && /toilets/.test(entity.defId)) return true;
  }
  return false;
};

const HINT_RULES: HintRule[] = [
  {
    topic: "drinks-needed",
    when: (w) => w.guests.count >= 12 && needShare(w, "thirst") > 0.22 && !hasStall(w, "thirst"),
    text: () => "Half the park is parched. A Drinks Depot near the queues would print money.",
  },
  {
    topic: "food-needed",
    when: (w) => w.guests.count >= 12 && needShare(w, "hunger") > 0.25 && !hasStall(w, "hunger"),
    text: () => "Tummies are rumbling louder than the coaster. Snack Shack time?",
  },
  {
    topic: "toilets-needed",
    when: (w) => w.guests.count >= 12 && needShare(w, "bladder") > 0.2 && !hasStall(w, "bladder"),
    text: () => "Guests are doing the little dance. Toilets are free to use and priceless to have.",
  },
  {
    topic: "idle-cash",
    when: (w) => w.cash > 3_000_000 && w.time > TICKS_PER_DAY * 2,
    text: () => "That savings pile is a roller coaster wearing a disguise. Just saying.",
  },
  {
    topic: "mechanic-needed",
    when: (w) => {
      if (w.staff.some((s) => s.role === "mechanic")) return false;
      for (const ride of w.rides.values()) if (ride.phase === "broken") return true;
      return false;
    },
    text: () => "Something's gone sproing and nobody's on wrench duty. Hire a mechanic in Staff!",
  },
  {
    topic: "janitor-needed",
    when: (w) => w.litter.length > 20 && !w.staff.some((s) => s.role === "janitor"),
    text: (w) => `${w.litter.length} pieces of litter and counting. A janitor pays for themselves.`,
  },
  {
    topic: "bored-guests",
    when: (w) => w.guests.count >= 15 && needShare(w, "fun") > 0.25 && w.rides.size < 3,
    text: () => "The crowd is politely bored. One more ride would change the whole mood.",
  },
  {
    topic: "research-idle",
    when: (w) => !w.meta.freeplayUnlocks && w.research.active === null && w.time > TICKS_PER_DAY * 1.5,
    text: () => "The research workshop is napping. Pick a branch — the boffins get restless.",
  },
  {
    topic: "debt-warning",
    when: (w) => w.loans.missedPayments >= 1,
    text: (w) =>
      `The bank has called ${w.loans.missedPayments === 1 ? "once" : "twice"}. Stack cash before day's end or repay a tranche!`,
  },
  {
    topic: "weakest-term",
    when: (w) => w.guests.count >= 25 && w.rating.value < 600 && ratingHints(w).length > 0,
    text: (w) => ratingHints(w)[0]?.message ?? "",
  },
];

const EXPLAINERS: Record<string, string> = {
  "explain-breakdown":
    "First breakdown! Purely cosmetic chaos — nobody is ever hurt. A mechanic fixes it free (eventually); the Call Repair button is the pricey shortcut.",
  "explain-storm":
    "Storms empty the park fast — everyone bolts. Perfect building weather; the crowd floods back with the sunshine.",
  "explain-zone":
    "You made a themed zone! Rides inside get bonus excitement. Click the banner to give it a legendary name.",
  "explain-opportunity":
    "That's an Opportunity — an optional side-quest rolled from your park. Accept it in Goals, or decline with zero downside. Forever.",
};

const GLOBAL_GAP_MS = 40_000;
const TOPIC_COOLDOWN_TICKS = TICKS_PER_DAY * 3;

export function PennyRail() {
  const [messages, setMessages] = useState<PennyMessage[]>([]);
  const lastShownAt = useRef(0); // performance.now ms
  const topicLastTick = useRef(new Map<string, number>());
  const sim = useGameStore((s) => s.sim);

  // ── One-time event explainers ──────────────────────────────────────────
  useEffect(() => {
    if (!sim) return;
    const show = (topic: string): void => {
      const app = useAppStore.getState();
      if (app.pennySeen.includes(topic)) return;
      app.markPennySeen(topic);
      const text = EXPLAINERS[topic];
      if (!text) return;
      setMessages((prev) => [...prev.slice(-1), { topic, text, explainer: true }]);
    };
    const offs = [
      sim.events.on("ride-broken", () => show("explain-breakdown")),
      sim.events.on("weather-changed", ({ kind }) => {
        if (kind === "storm") show("explain-storm");
      }),
      sim.events.on("zone-formed", () => show("explain-zone")),
      sim.events.on("opportunity-offered", () => show("explain-opportunity")),
    ];
    return () => offs.forEach((off) => off());
  }, [sim]);

  // ── Throttled state-driven hints ───────────────────────────────────────
  useEffect(() => {
    if (!sim) return;
    const timer = setInterval(() => {
      const store = useGameStore.getState();
      const app = useAppStore.getState();
      if (!store.sim) return;
      const world = store.sim.world;
      // Never interrupt building or big moments.
      if (store.tool.kind !== "select" || store.coasterDraft) return;
      if (store.veilOpen || store.parkOver || store.milestoneSheet) return;
      if (performance.now() - lastShownAt.current < GLOBAL_GAP_MS) return;

      for (const rule of HINT_RULES) {
        if (app.pennyDismissed.includes(rule.topic)) continue;
        const last = topicLastTick.current.get(rule.topic) ?? -1e9;
        if (world.time - last < TOPIC_COOLDOWN_TICKS) continue;
        if (!rule.when(world)) continue;
        const text = rule.text(world);
        if (!text) continue;
        topicLastTick.current.set(rule.topic, world.time);
        lastShownAt.current = performance.now();
        setMessages((prev) => [...prev.slice(-1), { topic: rule.topic, text, explainer: false }]);
        break;
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [sim]);

  // Auto-expire messages.
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => setMessages((prev) => prev.slice(1)), 14_000);
    return () => clearTimeout(timer);
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-24 left-4 flex w-80 flex-col gap-2">
      {messages.map((message) => (
        <div
          key={message.topic}
          className="panel-shadow-light flex gap-2.5 rounded-sm bg-paper-050 p-3 text-ink-900"
        >
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-magenta text-lg"
          >
            🎀
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-600">
              Penny · park advisor
            </div>
            <p className="text-xs leading-snug">{message.text}</p>
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() =>
                  setMessages((prev) => prev.filter((m) => m.topic !== message.topic))
                }
                className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-ink-600 hover:text-ink-900"
              >
                {message.explainer ? "Got it" : "Thanks"}
              </button>
              {!message.explainer && (
                <button
                  onClick={() => {
                    useAppStore.getState().dismissPennyTopic(message.topic);
                    setMessages((prev) => prev.filter((m) => m.topic !== message.topic));
                  }}
                  className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-ink-600/60 hover:text-danger-500"
                >
                  Don&apos;t repeat this
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
