"use client";

/** Esc menu — pause veil (UI_UX_DESIGN.md §5). */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dayOfTime } from "@/sim/world/time";
import { storeSave } from "@/ui/saves";
import { Button } from "@/ui/kit/Button";
import { toast } from "@/ui/kit/Toast";
import { useGameStore } from "@/ui/stores/gameStore";

export function PauseVeil() {
  const veilOpen = useGameStore((s) => s.veilOpen);
  const setVeilOpen = useGameStore((s) => s.setVeilOpen);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!veilOpen) return null;

  const saveNow = async (): Promise<void> => {
    const { sim, saveId } = useGameStore.getState();
    if (!sim || !saveId || saving) return;
    setSaving(true);
    await storeSave(saveId, sim.serialize(), dayOfTime(sim.world.time));
    setSaving(false);
    toast("success", "Park saved. The guests* thank you. (*arriving Phase 2)");
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink-900/75 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-8">
        <h2 className="display-hero text-6xl text-paper-050">Paused</h2>
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => setVeilOpen(false)}>
            Resume
          </Button>
          <Button size="lg" variant="ghost" disabled={saving} onClick={() => void saveNow()}>
            {saving ? "Saving…" : "Save park"}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              setVeilOpen(false);
              router.push("/hub");
            }}
          >
            Exit to hub
          </Button>
        </div>
        <p className="max-w-xs text-center text-xs text-paper-050/50">
          Autosave runs every park day and on exit. Settings live in the hub for now.
        </p>
      </div>
    </div>
  );
}
