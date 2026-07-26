"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listSaves, loadSave, type SaveSlotMeta } from "@/ui/saves";
import type { SaveFile } from "@/sim/save/schema";
import { formatMoney } from "@/ui/format";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { Button } from "@/ui/kit/Button";
import { StatBlock } from "@/ui/kit/StatBlock";
import { ParkThumb } from "./ParkThumb";

export function ContinueTab({ onNewPark }: { onNewPark: () => void }) {
  const router = useRouter();
  const [latest, setLatest] = useState<SaveSlotMeta | null | undefined>(undefined);
  const [save, setSave] = useState<SaveFile | null>(null);

  useEffect(() => {
    void listSaves().then((saves) => {
      const first = saves[0] ?? null;
      setLatest(first);
      if (first) {
        // Thumbnail data (drawn from the save itself — no screenshots).
        void loadSave(first.id)
          .then((data) => setSave(data ?? null))
          .catch(() => setSave(null));
      }
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <HeroHeader title="Continue" />
      <div className="mt-12">
        {latest === undefined && <p className="text-paper-050/60">Checking your parks…</p>}

        {latest === null && (
          <div className="skewed panel-shadow max-w-xl bg-paper-050 p-8">
            <div className="unskew">
              <h2 className="display-hero text-3xl text-ink-900">No parks yet!</h2>
              <p className="mt-3 text-ink-600">
                Your empire starts with a muddy field, a loan, and a dream.
              </p>
              <div className="mt-6">
                <Button size="lg" onClick={onNewPark}>
                  Found your first park
                </Button>
              </div>
            </div>
          </div>
        )}

        {latest && (
          <button
            onClick={() => router.push(`/play?id=${latest.id}`)}
            className="skewed panel-shadow group block w-full max-w-2xl cursor-pointer overflow-hidden text-left transition-transform hover:-translate-y-1"
          >
            <div className="rays relative bg-card-blue p-8">
              <div className="unskew flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.3em] text-paper-050/80">
                    Latest park
                  </div>
                  <div className="display-hero mt-1 text-5xl text-paper-050 drop-shadow">
                    {latest.name}
                  </div>
                </div>
                {save && (
                  <div className="panel-shadow shrink-0 border-4 border-paper-050/90 bg-ink-900">
                    <ParkThumb save={save} className="block h-28 w-28 object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-paper-200 bg-paper-050">
              <StatBlock icon="📅" value={`Day ${latest.day}`} label="Park time" />
              <StatBlock icon="💰" value={formatMoney(latest.cash)} label="Cash" />
              <StatBlock icon="🗺" value={latest.mapSize} label={latest.difficulty} />
            </div>
            <div className="bg-accent-500 py-2.5 text-center font-bold uppercase tracking-widest text-ink-900 transition-colors group-hover:bg-accent-400">
              <span className="unskew inline-block">▶ Keep building</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
