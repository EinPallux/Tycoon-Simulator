"use client";

/** In-game HUD composition (UI_UX_DESIGN.md §7): corners busy, center sacred. */

import { TopBar } from "./TopBar";
import { BuildDock } from "./BuildDock";
import { CoasterBuilderPanel } from "./CoasterBuilderPanel";
import { InspectorPanel } from "./InspectorPanel";
import { GuestInspector } from "./GuestInspector";
import { ParkPanel } from "./ParkPanel";
import { ParkOverSheet } from "./ParkOverSheet";
import { ObjectiveChip } from "./ObjectiveChip";
import { PauseVeil } from "./PauseVeil";
import { PerfOverlay } from "./PerfOverlay";
import { HoverHint } from "./HoverHint";

export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <TopBar />
      <ObjectiveChip />
      <InspectorPanel />
      <GuestInspector />
      <CoasterBuilderPanel />
      <ParkPanel />
      <BuildDock />
      <HoverHint />
      <PerfOverlay />
      <ParkOverSheet />
      <PauseVeil />
    </div>
  );
}
