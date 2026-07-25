"use client";

import { useEffect, useRef } from "react";
import { formatMoney } from "@/ui/format";
import { useGameStore } from "@/ui/stores/gameStore";
import type { GameSpeed } from "@/sim/world/time";

export function TopBar() {
  const cash = useGameStore((s) => s.cash);
  const day = useGameStore((s) => s.day);
  const clock = useGameStore((s) => s.clock);
  const speed = useGameStore((s) => s.speed);
  const paused = useGameStore((s) => s.paused);
  const canUndo = useGameStore((s) => s.canUndo);
  const canRedo = useGameStore((s) => s.canRedo);
  const guestCount = useGameStore((s) => s.guestCount);
  const ratingValue = useGameStore((s) => s.ratingValue);
  const sim = useGameStore((s) => s.sim);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const togglePause = useGameStore((s) => s.togglePause);
  const setVeilOpen = useGameStore((s) => s.setVeilOpen);
  const setParkPanel = useGameStore((s) => s.setParkPanel);

  // Cash pulse on change.
  const cashRef = useRef<HTMLSpanElement>(null);
  const prevCash = useRef(cash);
  useEffect(() => {
    if (cash !== prevCash.current && cashRef.current) {
      const rising = cash > prevCash.current;
      cashRef.current.animate(
        [
          { transform: "scale(1)", color: rising ? "#2FA84F" : "#E5484D" },
          { transform: "scale(1.12)", offset: 0.3 },
          { transform: "scale(1)", color: "" },
        ],
        { duration: 350, easing: "ease-out" },
      );
    }
    prevCash.current = cash;
  }, [cash]);

  const speedButton = (s: GameSpeed, label: string): React.ReactNode => (
    <button
      key={s}
      onClick={() => (s === 0 ? togglePause() : setSpeed(s))}
      className={`cursor-pointer px-2.5 py-1 text-sm font-bold transition-colors ${
        (s === 0 && paused) || (!paused && speed === s)
          ? "bg-accent-500 text-ink-900"
          : "text-paper-050/70 hover:text-paper-050"
      }`}
      aria-label={s === 0 ? "Pause" : `Speed ${label}`}
    >
      {label}
    </button>
  );

  return (
    <div className="pointer-events-auto absolute left-0 right-0 top-0 flex items-center justify-between gap-4 px-4 pt-3">
      {/* Left cluster: identity + wallet */}
      <div className="flex items-center gap-2">
        <div className="skewed panel-shadow flex items-center gap-3 bg-ink-900/90 px-4 py-2">
          <span className="unskew display-hero max-w-44 truncate text-lg not-italic text-paper-050">
            {sim?.world.meta.name ?? "…"}
          </span>
        </div>
        <div className="skewed panel-shadow flex items-center gap-2 bg-paper-050 px-4 py-2">
          <span className="unskew text-lg" aria-hidden>
            💰
          </span>
          <span ref={cashRef} className="unskew tabular text-lg font-extrabold text-ink-900">
            {formatMoney(cash)}
          </span>
        </div>
        <div className="skewed flex items-center gap-1 bg-ink-900/70 px-3 py-2">
          <button
            onClick={() => sim?.undo()}
            disabled={!canUndo}
            title="Undo (Z)"
            className="unskew cursor-pointer text-paper-050/80 transition-colors hover:text-accent-500 disabled:cursor-not-allowed disabled:text-paper-050/25"
          >
            ↩
          </button>
          <button
            onClick={() => sim?.redo()}
            disabled={!canRedo}
            title="Redo (Shift+Z)"
            className="unskew cursor-pointer text-paper-050/80 transition-colors hover:text-accent-500 disabled:cursor-not-allowed disabled:text-paper-050/25"
          >
            ↪
          </button>
        </div>
        <button
          onClick={() => setParkPanel("guests")}
          title="Guests in the park"
          className="skewed panel-shadow flex cursor-pointer items-center gap-2 bg-ink-900/90 px-3.5 py-2 transition-transform hover:-translate-y-0.5"
        >
          <span className="unskew flex items-center gap-1.5 text-sm font-bold text-paper-050">
            <span aria-hidden>👥</span>
            <span className="tabular">{guestCount}</span>
          </span>
        </button>
        <button
          onClick={() => setParkPanel("rating")}
          title="Park rating"
          className="skewed panel-shadow flex cursor-pointer items-center gap-2 bg-ink-900/90 px-3.5 py-2 transition-transform hover:-translate-y-0.5"
        >
          <span className="unskew flex items-center gap-1.5 text-sm font-bold text-paper-050">
            <span aria-hidden>⭐</span>
            <span className="tabular">{ratingValue}</span>
          </span>
        </button>
      </div>

      {/* Right cluster: time + speed + menu */}
      <div className="flex items-center gap-2">
        <div className="skewed panel-shadow flex items-center gap-3 bg-ink-900/90 px-4 py-2 text-paper-050">
          <span className="unskew text-sm font-bold">Day {day}</span>
          <span className="unskew tabular text-sm text-paper-050/70">{clock}</span>
        </div>
        <div className="skewed panel-shadow flex items-center bg-ink-900/90 px-1 py-1">
          <span className="unskew flex">
            {speedButton(0, "⏸")}
            {speedButton(1, "1×")}
            {speedButton(2, "2×")}
            {speedButton(3, "3×")}
          </span>
        </div>
        <button
          onClick={() => setVeilOpen(true)}
          title="Menu (Esc)"
          className="skewed panel-shadow cursor-pointer bg-ink-900/90 px-3.5 py-2 text-paper-050/80 transition-colors hover:text-accent-500"
        >
          <span className="unskew inline-block font-bold">≡</span>
        </button>
      </div>
    </div>
  );
}
