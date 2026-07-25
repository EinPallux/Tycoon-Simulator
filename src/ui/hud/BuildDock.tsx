"use client";

/**
 * The bottom-center build dock + expanding category trays
 * (UI_UX_DESIGN.md §7.5). Categories beyond Phase 1 render locked with
 * their arrival phase — visible ambition, honest state.
 */

import { useMemo } from "react";
import { PLACEABLE_DEFS, SURFACES } from "@/content/catalog";
import type { PlaceableDef } from "@/content/types";
import { formatMoney } from "@/ui/format";
import { useGameStore, type DockCategory } from "@/ui/stores/gameStore";

interface DockEntry {
  id: Exclude<DockCategory, null> | "coasters" | "rides" | "staff" | "management";
  label: string;
  icon: string;
  color: string;
  lockedHint?: string;
}

const DOCK: DockEntry[] = [
  { id: "paths", label: "Paths", icon: "🛤", color: "bg-card-teal" },
  { id: "coasters", label: "Coasters", icon: "🎢", color: "bg-card-magenta", lockedHint: "Phase 3" },
  { id: "rides", label: "Rides", icon: "🎡", color: "bg-card-blue", lockedHint: "Phase 2" },
  { id: "stalls", label: "Stalls", icon: "🍔", color: "bg-card-orange" },
  { id: "scenery", label: "Scenery", icon: "🌳", color: "bg-card-green" },
  { id: "staff", label: "Staff", icon: "🧹", color: "bg-card-purple", lockedHint: "Phase 3" },
  { id: "management", label: "Manage", icon: "📊", color: "bg-card-purple", lockedHint: "Phase 2" },
];

const DEF_ICONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/tree|palm|pine|oak/, "🌳"],
  [/bush|hedge/, "🌿"],
  [/flower/, "🌸"],
  [/mushroom/, "🍄"],
  [/rock|stone/, "🪨"],
  [/stump|log/, "🪵"],
  [/bench/, "🪑"],
  [/bin/, "🗑"],
  [/lamp/, "💡"],
  [/flag/, "🚩"],
  [/fence/, "🚧"],
  [/monument|obelisk|column|sculpture/, "🗿"],
  [/planter|grass/, "🌱"],
  [/umbrella/, "⛱"],
  [/food/, "🍔"],
  [/drink/, "🥤"],
  [/info/, "ℹ️"],
  [/toilet/, "🚻"],
];

function iconFor(def: PlaceableDef): string {
  for (const [pattern, icon] of DEF_ICONS) if (pattern.test(def.id)) return icon;
  return "📦";
}

export function BuildDock() {
  const dockCategory = useGameStore((s) => s.dockCategory);
  const setDockCategory = useGameStore((s) => s.setDockCategory);
  const tool = useGameStore((s) => s.tool);
  const setTool = useGameStore((s) => s.setTool);

  const sceneryDefs = useMemo(() => PLACEABLE_DEFS.filter((d) => d.category === "scenery"), []);
  const stallDefs = useMemo(() => PLACEABLE_DEFS.filter((d) => d.category === "stall"), []);

  return (
    <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 pb-3">
      {/* Category tray */}
      {dockCategory !== null && (
        <div className="pointer-events-auto max-h-64 w-[min(92vw,880px)] overflow-y-auto bg-ink-900/95 p-3 panel-shadow rounded-sm">
          {dockCategory === "paths" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TrayCard
                icon="🛤"
                title="Path"
                subtitle={`${formatMoney(SURFACES.path.costPerTile)}/tile · drag to paint`}
                active={tool.kind === "path" && tool.surface === "path"}
                onClick={() => setTool({ kind: "path", surface: "path" })}
              />
              <TrayCard
                icon="🚸"
                title="Queue"
                subtitle={`${formatMoney(SURFACES.queue.costPerTile)}/tile · for rides (P2)`}
                active={tool.kind === "path" && tool.surface === "queue"}
                onClick={() => setTool({ kind: "path", surface: "queue" })}
              />
              <TrayCard
                icon="🧨"
                title="Bulldoze"
                subtitle="Remove & refund (Del)"
                active={tool.kind === "bulldoze"}
                onClick={() => setTool({ kind: "bulldoze" })}
              />
            </div>
          )}
          {(dockCategory === "scenery" || dockCategory === "stalls") && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {(dockCategory === "scenery" ? sceneryDefs : stallDefs).map((def) => (
                <TrayCard
                  key={def.id}
                  icon={iconFor(def)}
                  title={def.name}
                  subtitle={`${formatMoney(def.cost)}${def.footprint[0] * def.footprint[1] > 1 ? ` · ${def.footprint[0]}×${def.footprint[1]}` : ""}`}
                  active={tool.kind === "place" && tool.defId === def.id}
                  onClick={() => setTool({ kind: "place", defId: def.id, rot: 0 })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* The dock itself */}
      <div className="pointer-events-auto flex items-end gap-1.5">
        {DOCK.map((entry) => {
          const locked = entry.lockedHint !== undefined;
          const isOpen = dockCategory === entry.id;
          return (
            <button
              key={entry.id}
              disabled={locked}
              title={locked ? `${entry.label} — arrives in ${entry.lockedHint}` : entry.label}
              onClick={() =>
                setDockCategory(isOpen ? null : (entry.id as Exclude<DockCategory, null>))
              }
              className={`skewed panel-shadow group relative flex cursor-pointer flex-col items-center transition-all duration-100 ${
                isOpen ? "-translate-y-1.5" : "hover:-translate-y-1"
              } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
            >
              <span
                className={`rays flex h-12 w-16 items-center justify-center text-2xl ${entry.color}`}
              >
                <span className="unskew drop-shadow">{locked ? "🔒" : entry.icon}</span>
              </span>
              <span
                className={`w-16 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide ${
                  isOpen ? "bg-accent-500 text-ink-900" : "bg-paper-050 text-ink-900"
                }`}
              >
                <span className="unskew inline-block">{entry.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrayCard({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`skewed flex cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-all duration-100 ${
        active ? "bg-accent-500 text-ink-900" : "bg-ink-700/80 text-paper-050 hover:bg-ink-600"
      }`}
    >
      <span className="unskew text-xl" aria-hidden>
        {icon}
      </span>
      <span className="unskew min-w-0">
        <span className="block truncate text-xs font-bold uppercase tracking-wide">{title}</span>
        <span
          className={`block truncate text-[10px] ${active ? "text-ink-900/70" : "text-paper-050/60"}`}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}
