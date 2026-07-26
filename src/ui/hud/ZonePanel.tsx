"use client";

/** Zone rename card — appears when a zone banner is clicked. */

import { useEffect, useState } from "react";
import { Button } from "@/ui/kit/Button";
import { Panel } from "@/ui/kit/Panel";
import { useGameStore } from "@/ui/stores/gameStore";
import { ZONE_EXCITEMENT_BONUS } from "@/sim/systems/zones";

export function ZonePanel() {
  const selectedZone = useGameStore((s) => s.selectedZone);
  const selectZone = useGameStore((s) => s.selectZone);
  const worldVersion = useGameStore((s) => s.worldVersion);
  const bumpWorld = useGameStore((s) => s.bumpWorld);
  const [name, setName] = useState("");

  const sim = useGameStore.getState().sim;
  const zone = sim?.world.zones.find((z) => z.key === selectedZone) ?? null;
  void worldVersion;

  useEffect(() => {
    if (zone) setName(zone.name);
  }, [zone]);

  if (!sim || !zone) return null;

  const rename = (): void => {
    const result = sim.dispatch({ type: "rename-zone", key: zone.key, name });
    if (result.ok) {
      bumpWorld(); // refresh the in-world banner texture
      selectZone(null);
    }
  };

  return (
    <div className="pointer-events-auto absolute left-4 top-20 w-72">
      <Panel title="Themed Zone" onClose={() => selectZone(null)}>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between text-xs">
            <span className="text-ink-600">Theme</span>
            <b className="capitalize">{zone.theme}</b>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ink-600">Scenery pieces</span>
            <b className="tabular">{zone.pieces}</b>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ink-600">Rides in the zone</span>
            <b className="tabular">
              {zone.rideIds.length} (+{ZONE_EXCITEMENT_BONUS.toFixed(1)} excitement)
            </b>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-600">
              Zone name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename();
              }}
              maxLength={32}
              className="border-2 border-ink-900/20 bg-paper-100 px-2.5 py-1.5 text-sm font-bold outline-none focus:border-accent-500"
            />
          </label>
          <Button size="sm" onClick={rename}>
            Name it
          </Button>
        </div>
      </Panel>
    </div>
  );
}
