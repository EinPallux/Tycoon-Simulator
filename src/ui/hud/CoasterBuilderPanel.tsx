"use client";

/**
 * The coaster builder (GAME_DESIGN.md §4.6): button-driven track drafting.
 * Place a station on the ground, then chain pieces from its exit until the
 * loop closes back home. Live stats, live cost, one commit — one undo entry.
 */

import { useEffect, useMemo } from "react";
import {
  canAddPiece,
  coasterCost,
  computeStats,
  FAMILY_INFO,
  validateCircuit,
} from "@/sim/coaster/coaster";
import { nodesEqual, PIECES, type PieceType } from "@/sim/coaster/pieces";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { Panel } from "@/ui/kit/Panel";
import { draftHead, useGameStore } from "@/ui/stores/gameStore";

const PIECE_BUTTONS: { type: PieceType; label: string; icon: string; key: string }[] = [
  { type: "straight", label: "Straight", icon: "⬆️", key: "W" },
  { type: "corner-left", label: "Turn Left", icon: "↰", key: "A" },
  { type: "corner-right", label: "Turn Right", icon: "↱", key: "D" },
  { type: "slope-up", label: "Climb", icon: "⛰", key: "R" },
  { type: "slope-down", label: "Drop", icon: "🎢", key: "F" },
  { type: "loop", label: "Loop", icon: "➰", key: "L" },
];

const KEY_TO_PIECE: Record<string, PieceType> = {
  w: "straight",
  a: "corner-left",
  d: "corner-right",
  r: "slope-up",
  f: "slope-down",
  l: "loop",
};

export function CoasterBuilderPanel() {
  const draft = useGameStore((s) => s.coasterDraft);
  const draftVersion = useGameStore((s) => s.draftVersion);
  const tool = useGameStore((s) => s.tool);

  // Keyboard drafting (only while a draft exists).
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const store = useGameStore.getState();
      const piece = KEY_TO_PIECE[e.key.toLowerCase()];
      if (piece && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation(); // outranks the global map (e.g. R = rotate)
        store.addDraftPiece(piece);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        store.undoDraftPiece();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        store.commitCoasterDraft();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [draft]);

  const info = useMemo(() => {
    const sim = useGameStore.getState().sim;
    if (!sim || !draft) return null;
    const head = draftHead(draft);
    const start = (draft.pieces[0]?.entry ?? head);
    const closed = nodesEqual(head, start);
    const cost = coasterCost(draft.family, draft.pieces);
    const stats = computeStats(draft.family, draft.pieces);
    const buildable = closed && validateCircuit(sim.world, draft.pieces).ok;
    const verdicts = Object.fromEntries(
      PIECE_BUTTONS.map((b) => [b.type, canAddPiece(sim.world, head, b.type)]),
    ) as Record<PieceType, { ok: boolean; reason?: string }>;
    return { head, start, closed, cost, stats, buildable, verdicts };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftVersion tracks draft edits
  }, [draft, draftVersion]);

  // Panel shows only in coaster mode.
  if (tool.kind !== "coaster") return null;
  const family = FAMILY_INFO[tool.kind === "coaster" ? tool.family : "mouse"];

  if (!draft || !info) {
    return (
      <div className="pointer-events-auto absolute left-4 top-20 w-80">
        <Panel
          title={`Build: ${family.name}`}
          onClose={() => useGameStore.getState().setTool({ kind: "select" })}
        >
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Click the ground to drop the <b>station</b> — the arrow shows the direction of
              travel. <kbd className="bg-paper-200 px-1">R</kbd> rotates.
            </p>
            <p className="text-xs text-ink-600">
              Stations need a path next to them so guests can queue up. Base price{" "}
              {formatMoney(family.baseCost)} + track.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const { closed, cost, stats, buildable, verdicts, head, start } = info;
  const dx = start.x - head.x;
  const dz = start.z - head.z;
  const dh = start.h - head.h;
  const homeHint = closed
    ? null
    : [
        dx !== 0 ? `${Math.abs(dx)} ${dx > 0 ? "E" : "W"}` : null,
        dz !== 0 ? `${Math.abs(dz)} ${dz > 0 ? "S" : "N"}` : null,
        dh !== 0 ? `${Math.abs(dh)} ${dh > 0 ? "up" : "down"}` : null,
      ]
        .filter(Boolean)
        .join(", ");

  return (
    <div className="pointer-events-auto absolute left-4 top-20 w-80">
      <Panel
        title={`${family.name} — ${draft.pieces.length} pieces`}
        onClose={() => useGameStore.getState().cancelCoasterDraft()}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-1.5">
            {PIECE_BUTTONS.map((b) => {
              const verdict = verdicts[b.type];
              return (
                <button
                  key={b.type}
                  disabled={!verdict.ok}
                  title={verdict.ok ? `${b.label} (${b.key}) · ${formatMoney(PIECES[b.type].cost)}` : verdict.reason}
                  onClick={() => useGameStore.getState().addDraftPiece(b.type)}
                  className={`flex cursor-pointer items-center justify-between px-2.5 py-2 text-left transition-colors ${
                    verdict.ok
                      ? "bg-ink-900 text-paper-050 hover:bg-ink-700"
                      : "cursor-not-allowed bg-paper-200 text-ink-600/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
                    <span aria-hidden>{b.icon}</span> {b.label}
                  </span>
                  <kbd className="text-[10px] opacity-60">{b.key}</kbd>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="!border-ink-900/40 !text-ink-900 hover:!border-accent-600 hover:!text-accent-600"
              onClick={() => useGameStore.getState().undoDraftPiece()}
            >
              ⌫ Undo piece
            </Button>
            <Button size="sm" variant="danger" onClick={() => useGameStore.getState().cancelCoasterDraft()}>
              Cancel
            </Button>
          </div>

          <div
            className={`px-2.5 py-1.5 text-xs font-bold ${closed ? "bg-good-500/15 text-good-500" : "bg-paper-100 text-ink-600"}`}
          >
            {closed
              ? "✓ Circuit closed — ready to build!"
              : `Open circuit — home is ${homeHint || "right here (turn to face it)"}`}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Excite" value={stats.excitement.toFixed(1)} tone="text-good-500" />
            <MiniStat label="Intense" value={stats.intensity.toFixed(1)} tone="text-card-orange" />
            <MiniStat label="Nausea" value={stats.nausea.toFixed(1)} tone="text-card-purple" />
          </div>
          <div className="flex justify-between text-xs text-ink-600">
            <span>
              {Math.round(stats.maxSpeed * 2 * 3.6)} km/h top · {Math.round(stats.rideTimeSec)}s ·{" "}
              {stats.drops} drop{stats.drops === 1 ? "" : "s"}
              {stats.inversions > 0 ? ` · ${stats.inversions} loop${stats.inversions === 1 ? "" : "s"}` : ""}
            </span>
          </div>

          <Button disabled={!buildable} onClick={() => useGameStore.getState().commitCoasterDraft()}>
            Build — {formatMoney(cost)}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-paper-100 py-1.5">
      <div className={`tabular text-base font-extrabold ${tone}`}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-ink-600">{label}</div>
    </div>
  );
}
