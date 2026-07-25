"use client";

/** F3 performance overlay (TECHNICAL_ARCHITECTURE.md §12). */

import { useEffect, useState } from "react";
import { frameStats } from "@/render/stats";
import { useGameStore } from "@/ui/stores/gameStore";

export function PerfOverlay() {
  const visible = useGameStore((s) => s.perfOverlay);
  const [, force] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;
  const sim = useGameStore.getState().sim;
  const placed = sim ? sim.world.placeables.size : 0;

  return (
    <div className="pointer-events-none absolute right-4 top-20 bg-ink-900/85 p-3 font-mono text-[11px] leading-relaxed text-paper-050">
      <div>
        FPS <b className="text-accent-500">{frameStats.fps.toFixed(0)}</b> ·{" "}
        {frameStats.frameMs.toFixed(1)} ms
      </div>
      <div>draw calls {frameStats.drawCalls}</div>
      <div>triangles {(frameStats.triangles / 1000).toFixed(1)}k</div>
      <div>placeables {placed}</div>
      <div className="text-paper-050/50">F3 to hide</div>
    </div>
  );
}
