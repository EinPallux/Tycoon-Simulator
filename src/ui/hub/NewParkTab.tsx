"use client";

/**
 * NEW PARK configurator — the single entry into the guided sandbox
 * (UI_UX_DESIGN.md §6, GAME_DESIGN.md §10.2). No mode select: this IS the game.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createWorld, DIFFICULTY_PRESETS, MAP_PRESETS } from "@/sim/world/world";
import type { Difficulty, MapSize } from "@/sim/world/world";
import { serializeWorld } from "@/sim/save/serialize";
import { listSaves, newSaveId, storeSave } from "@/ui/saves";
import { formatMoney } from "@/ui/format";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { Button } from "@/ui/kit/Button";
import { CategoryCard } from "@/ui/kit/CategoryCard";
import { Toggle } from "@/ui/kit/Toggle";
import { toast } from "@/ui/kit/Toast";

const NAME_IDEAS = [
  "Wanderpark",
  "Loopington Fields",
  "Sunny Screams",
  "Meadow Mayhem",
  "Coasterville",
  "The Fun Works",
  "Penny's Promise",
  "Bramble Bay Park",
  "Giggle Gardens",
  "Thrill Hollow",
];

const DIFF_INFO: Record<Difficulty, { label: string; blurb: string }> = {
  relaxed: { label: "Relaxed", blurb: "Gentle start, no debt, forgiving guests" },
  classic: { label: "Classic", blurb: "The intended Wanderpark experience" },
  tycoon: { label: "Tycoon", blurb: "Thin margins, pricey loans, spicy events" },
};

export function NewParkTab() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mapSize, setMapSize] = useState<MapSize>("M");
  const [difficulty, setDifficulty] = useState<Difficulty>("classic");
  const [guidedStart, setGuidedStart] = useState(false);
  const [freeplay, setFreeplay] = useState(false);
  const [building, setBuilding] = useState(false);

  // Guided Start defaults ON for the first-ever park (GAME_DESIGN.md §12).
  useEffect(() => {
    void listSaves().then((saves) => {
      if (saves.length === 0) setGuidedStart(true);
    });
  }, []);

  // Guided Start defaults ON for the very first park (GAME_DESIGN.md §12).
  useEffect(() => {
    void listSaves().then((saves) => {
      if (saves.length === 0) setGuidedStart(true);
    });
  }, []);

  const rollName = (): void => {
    const pick = NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)] ?? "Wanderpark";
    setName(pick);
  };

  const build = async (): Promise<void> => {
    if (building) return;
    setBuilding(true);
    try {
      const seedArray = new Uint32Array(1);
      crypto.getRandomValues(seedArray);
      const world = createWorld({
        name: name.trim() || "Wanderpark",
        seed: seedArray[0] ?? 1,
        difficulty,
        mapSize,
        guidedStart,
        freeplayUnlocks: freeplay,
      });
      const id = newSaveId();
      await storeSave(id, serializeWorld(world), 1);
      router.push(`/play?id=${id}`);
    } catch (err) {
      console.error(err);
      toast("danger", "Could not create the park — please try again.");
      setBuilding(false);
    }
  };

  const diff = DIFFICULTY_PRESETS[difficulty];

  return (
    <div className="mx-auto max-w-4xl">
      <HeroHeader title="New Park" chip="Guided sandbox" />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          {/* Name */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-paper-050/70">
              Park name
            </h3>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Name your dream…"
                className="skewed flex-1 border-2 border-transparent bg-paper-050 px-4 py-3 text-lg font-bold text-ink-900 outline-none placeholder:text-ink-600/50 focus:border-accent-500"
              />
              <Button variant="ghost" onClick={rollName} title="Roll a name">
                🎲
              </Button>
            </div>
          </section>

          {/* Map size */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-paper-050/70">
              Map size
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(MAP_PRESETS) as MapSize[]).map((size) => {
                const tiles = MAP_PRESETS[size].owned;
                return (
                  <CategoryCard
                    key={size}
                    color={size === "S" ? "teal" : size === "M" ? "blue" : "purple"}
                    title={size === "S" ? "Cozy" : size === "M" ? "Classic" : "Grand"}
                    subtitle={`${tiles}×${tiles} tiles`}
                    icon={size === "S" ? "🏡" : size === "M" ? "🎡" : "🏰"}
                    selected={mapSize === size}
                    onClick={() => setMapSize(size)}
                  />
                );
              })}
            </div>
          </section>

          {/* Difficulty */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-paper-050/70">
              Difficulty
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(DIFF_INFO) as Difficulty[]).map((d) => (
                <CategoryCard
                  key={d}
                  color={d === "relaxed" ? "green" : d === "classic" ? "orange" : "magenta"}
                  title={DIFF_INFO[d].label}
                  subtitle={DIFF_INFO[d].blurb}
                  icon={d === "relaxed" ? "🌤" : d === "classic" ? "🎢" : "🌪"}
                  selected={difficulty === d}
                  onClick={() => setDifficulty(d)}
                />
              ))}
            </div>
          </section>

          {/* Toggles */}
          <section className="skewed overflow-hidden bg-paper-050">
            <div className="unskew flex flex-col gap-px">
              <Toggle
                label="Guided Start"
                hint="Penny walks you through your first steps — always skippable (full flow arrives Phase 4)"
                checked={guidedStart}
                onChange={setGuidedStart}
              />
              <Toggle
                label="Freeplay unlocks"
                hint="Start with everything unlocked instead of researching (research arrives Phase 3)"
                checked={freeplay}
                onChange={setFreeplay}
              />
            </div>
          </section>
        </div>

        {/* Summary rail */}
        <aside className="flex flex-col gap-4">
          <div className="skewed panel-shadow overflow-hidden bg-paper-050">
            <div className="rays bg-card-green p-5">
              <div className="unskew display-hero text-2xl text-paper-050 drop-shadow">
                The Deal
              </div>
            </div>
            <div className="unskew flex flex-col gap-2 p-5 text-sm text-ink-900">
              <div className="flex justify-between">
                <span className="text-ink-600">Starting cash</span>
                <b className="tabular">{formatMoney(diff.startCash)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Starting debt</span>
                <b className="tabular text-danger-500">{formatMoney(diff.startDebt)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Loan interest</span>
                <b className="tabular">{(diff.interestApr * 100).toFixed(0)}%/yr</b>
              </div>
              <p className="mt-3 border-t border-paper-200 pt-3 text-xs text-ink-600">
                The bank believes in you. Mostly. Interest collection begins in Phase 3 — the debt
                is already yours to admire.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => void build()} disabled={building} className="w-full">
            {building ? "Surveying the land…" : "⛏ Build it"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
