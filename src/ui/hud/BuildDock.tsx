"use client";

/**
 * The bottom-center build dock + expanding category trays
 * (UI_UX_DESIGN.md §7.5). Research-gated entries render locked with their
 * unlock hint — visible ambition, honest state.
 */

import { useMemo } from "react";
import { PLACEABLE_DEFS, SURFACES } from "@/content/catalog";
import type { PlaceableDef } from "@/content/types";
import { FAMILY_INFO, type CoasterFamily } from "@/sim/coaster/coaster";
import { MAX_STAFF, STAFF_ROLES, type StaffRole } from "@/sim/balance/phase3";
import { isCoasterUnlocked, isDefUnlocked } from "@/sim/research";
import { formatMoney } from "@/ui/format";
import { toast } from "@/ui/kit/Toast";
import { useGameStore, type DockCategory } from "@/ui/stores/gameStore";

interface DockEntry {
  id: Exclude<DockCategory, null> | "management";
  label: string;
  icon: string;
  color: string;
}

const DOCK: DockEntry[] = [
  { id: "paths", label: "Paths", icon: "🛤", color: "bg-card-teal" },
  { id: "coasters", label: "Coasters", icon: "🎢", color: "bg-card-magenta" },
  { id: "rides", label: "Rides", icon: "🎡", color: "bg-card-blue" },
  { id: "stalls", label: "Stalls", icon: "🍔", color: "bg-card-orange" },
  { id: "scenery", label: "Scenery", icon: "🌳", color: "bg-card-green" },
  { id: "staff", label: "Staff", icon: "🧹", color: "bg-card-purple" },
  { id: "management", label: "Manage", icon: "📊", color: "bg-card-purple" },
];

const DEF_ICONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/carousel/, "🎠"],
  [/ferris/, "🎡"],
  [/teacups/, "🍵"],
  [/drop/, "🗼"],
  [/bumper/, "🚗"],
  [/swing/, "🏴‍☠️"],
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
  [/food|candy/, "🍔"],
  [/drink|coffee/, "🥤"],
  [/souvenir/, "🧸"],
  [/info/, "ℹ️"],
  [/toilet/, "🚻"],
];

function iconFor(def: PlaceableDef): string {
  for (const [pattern, icon] of DEF_ICONS) if (pattern.test(def.id)) return icon;
  return "📦";
}

const COASTER_FAMILIES: { family: CoasterFamily; icon: string; researchHint: string }[] = [
  { family: "mouse", icon: "🐭", researchHint: "Research: Thrill 3" },
  { family: "flume", icon: "🪵", researchHint: "Research: Thrill 5" },
  { family: "steel", icon: "🚄", researchHint: "Research: Thrill 7" },
  { family: "hanging", icon: "🦇", researchHint: "Research: Thrill 8" },
  { family: "monorail", icon: "🚝", researchHint: "Research: Family 7" },
];

export function BuildDock() {
  const dockCategory = useGameStore((s) => s.dockCategory);
  const setDockCategory = useGameStore((s) => s.setDockCategory);
  const tool = useGameStore((s) => s.tool);
  const setTool = useGameStore((s) => s.setTool);
  const worldVersion = useGameStore((s) => s.worldVersion);

  const sceneryDefs = useMemo(() => PLACEABLE_DEFS.filter((d) => d.category === "scenery"), []);
  const stallDefs = useMemo(() => PLACEABLE_DEFS.filter((d) => d.category === "stall"), []);
  const rideDefs = useMemo(
    () => PLACEABLE_DEFS.filter((d) => d.category === "ride" && !d.coasterFamily),
    [],
  );
  const setParkPanel = useGameStore((s) => s.setParkPanel);

  // Unlock states refresh when research completes (worldVersion bumps).
  const sim = useGameStore.getState().sim;
  void worldVersion;

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
                subtitle={`${formatMoney(SURFACES.queue.costPerTile)}/tile · for rides`}
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

          {dockCategory === "coasters" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {COASTER_FAMILIES.map(({ family, icon, researchHint }) => {
                const info = FAMILY_INFO[family];
                const unlocked = sim ? isCoasterUnlocked(sim.world, family) : false;
                return (
                  <TrayCard
                    key={family}
                    icon={unlocked ? icon : "🔒"}
                    title={info.name}
                    subtitle={
                      unlocked
                        ? `${formatMoney(info.baseCost)} + track · design your own!`
                        : researchHint
                    }
                    active={tool.kind === "coaster" && tool.family === family}
                    locked={!unlocked}
                    onClick={() => {
                      if (!unlocked) return;
                      if (useGameStore.getState().coasterDraft) {
                        toast("warning", "Finish or cancel the current coaster first.");
                        return;
                      }
                      setTool({ kind: "coaster", family, rot: 0 });
                    }}
                  />
                );
              })}
              <p className="col-span-full px-1 text-[11px] text-paper-050/50">
                Pick a family, drop the station by a path, then chain track pieces until the
                circuit closes.
              </p>
            </div>
          )}

          {dockCategory === "staff" && <StaffTray />}

          {(dockCategory === "scenery" || dockCategory === "stalls" || dockCategory === "rides") && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {(dockCategory === "scenery"
                ? sceneryDefs
                : dockCategory === "stalls"
                  ? stallDefs
                  : rideDefs
              ).map((def) => {
                const unlocked = sim ? isDefUnlocked(sim.world, def) : true;
                return (
                  <TrayCard
                    key={def.id}
                    icon={unlocked ? iconFor(def) : "🔒"}
                    title={def.name}
                    subtitle={
                      unlocked
                        ? `${formatMoney(def.cost)}${def.footprint[0] * def.footprint[1] > 1 ? ` · ${def.footprint[0]}×${def.footprint[1]}` : ""}${def.ride ? ` · E${def.ride.excitement.toFixed(1)}` : ""}`
                        : "Research to unlock"
                    }
                    active={tool.kind === "place" && tool.defId === def.id}
                    locked={!unlocked}
                    onClick={() => {
                      if (unlocked) setTool({ kind: "place", defId: def.id, rot: 0 });
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* The dock itself */}
      <div className="pointer-events-auto flex items-end gap-1.5">
        {DOCK.map((entry) => {
          const isOpen = dockCategory === entry.id;
          return (
            <button
              key={entry.id}
              title={entry.label}
              onClick={() => {
                if (entry.id === "management") setParkPanel("finances");
                else setDockCategory(isOpen ? null : entry.id);
              }}
              className={`skewed panel-shadow group relative flex cursor-pointer flex-col items-center transition-all duration-100 ${
                isOpen ? "-translate-y-1.5" : "hover:-translate-y-1"
              }`}
            >
              <span
                className={`rays flex h-12 w-16 items-center justify-center text-2xl ${entry.color}`}
              >
                <span className="unskew drop-shadow">{entry.icon}</span>
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

function StaffTray() {
  const worldVersion = useGameStore((s) => s.worldVersion);
  const bumpWorld = useGameStore((s) => s.bumpWorld);
  const sim = useGameStore.getState().sim;
  void worldVersion;
  if (!sim) return null;
  const staff = sim.world.staff;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(STAFF_ROLES) as StaffRole[]).map((role) => {
          const info = STAFF_ROLES[role];
          const count = staff.filter((s) => s.role === role).length;
          return (
            <TrayCard
              key={role}
              icon={info.icon}
              title={`Hire ${info.name}${count > 0 ? ` (${count})` : ""}`}
              subtitle={`${formatMoney(info.hireFee)} + ${formatMoney(info.wage)}/wk`}
              active={false}
              onClick={() => {
                const result = sim.dispatch({ type: "hire-staff", role });
                if (result.ok) {
                  toast("success", `${info.icon} ${info.name} hired — they're at the gate.`);
                  bumpWorld();
                }
              }}
            />
          );
        })}
      </div>
      {staff.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-paper-050/10 pt-2">
          {staff.map((member) => (
            <span
              key={member.id}
              className="flex items-center gap-1.5 bg-ink-700/80 px-2 py-1 text-[11px] text-paper-050"
            >
              <span aria-hidden>{STAFF_ROLES[member.role].icon}</span>
              {member.name}
              <span className="text-paper-050/50">· {member.jobsDone} jobs</span>
              <button
                title={`Let ${member.name} go`}
                onClick={() => {
                  const result = sim.dispatch({ type: "fire-staff", id: member.id });
                  if (result.ok) {
                    toast("info", `${member.name} hung up the uniform.`);
                    bumpWorld();
                  }
                }}
                className="cursor-pointer pl-1 text-paper-050/50 hover:text-danger-500"
              >
                ✕
              </button>
            </span>
          ))}
          <span className="self-center px-1 text-[10px] text-paper-050/40">
            {staff.length}/{MAX_STAFF}
          </span>
        </div>
      )}
    </div>
  );
}

function TrayCard({
  icon,
  title,
  subtitle,
  active,
  locked = false,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  active: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`skewed flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100 ${
        active
          ? "cursor-pointer bg-accent-500 text-ink-900"
          : locked
            ? "cursor-not-allowed bg-ink-700/40 text-paper-050/40"
            : "cursor-pointer bg-ink-700/80 text-paper-050 hover:bg-ink-600"
      }`}
    >
      <span className="unskew text-xl" aria-hidden>
        {icon}
      </span>
      <span className="unskew min-w-0">
        <span className="block truncate text-xs font-bold uppercase tracking-wide">{title}</span>
        <span
          className={`block truncate text-[10px] ${active ? "text-ink-900/70" : locked ? "text-paper-050/30" : "text-paper-050/60"}`}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}
