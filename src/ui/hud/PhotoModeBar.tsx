"use client";

/**
 * Photo mode (GAME_DESIGN.md §16): free camera (the rig keeps working),
 * HUD retreats, golden-hour slider, PNG export straight to disk.
 * DOF and stickers stay on the Phase-5 wishlist — 60 fps comes first.
 */

import { sfx } from "@/audio/bus";
import { formatClock } from "@/sim/world/time";
import { Button } from "@/ui/kit/Button";
import { toast } from "@/ui/kit/Toast";
import { Slider } from "@/ui/kit/Slider";
import { useGameStore } from "@/ui/stores/gameStore";

export function PhotoModeBar() {
  const photoMode = useGameStore((s) => s.photoMode);
  const photoTime = useGameStore((s) => s.photoTime);
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const setPhotoTime = useGameStore((s) => s.setPhotoTime);
  const sim = useGameStore.getState().sim;
  if (!photoMode || !sim) return null;

  const capture = (): void => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("warning", "The camera jammed — try again.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const day = Math.floor(sim.world.time / 900) + 1;
      a.href = url;
      a.download = `wanderpark-${sim.world.meta.name.replace(/\s+/g, "-").toLowerCase()}-day${day}.png`;
      a.click();
      URL.revokeObjectURL(url);
      sfx.whoosh();
      toast("success", "📸 Saved! Check your downloads.");
    }, "image/png");
  };

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(92vw,540px)] -translate-x-1/2">
      <div className="panel-shadow flex items-center gap-3 rounded-sm bg-ink-900/95 px-4 py-3">
        <span className="text-lg" aria-hidden>
          📷
        </span>
        <div className="min-w-0 flex-1">
          <div className="-mx-2 [&_label]:!text-paper-050/70">
            <Slider
              label="Light"
              value={photoTime ?? 0.5}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setPhotoTime(v)}
              format={(v) => formatClock(Math.round(v * 900))}
            />
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setPhotoTime(null)}>
          Live light
        </Button>
        <Button size="sm" onClick={capture}>
          📸 Snap
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPhotoMode(false)}>
          Done (Esc)
        </Button>
      </div>
    </div>
  );
}
