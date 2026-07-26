"use client";

/** In-game HUD composition (UI_UX_DESIGN.md §7): corners busy, center sacred. */

import { AchievementWatcher } from "./AchievementWatcher";
import { TopBar } from "./TopBar";
import { BuildDock } from "./BuildDock";
import { CoasterBuilderPanel } from "./CoasterBuilderPanel";
import { GuidedChecklist } from "./GuidedChecklist";
import { InspectorPanel } from "./InspectorPanel";
import { GuestInspector } from "./GuestInspector";
import { ManualPanel } from "./ManualPanel";
import { MilestoneSheet } from "./MilestoneSheet";
import { ParkPanel } from "./ParkPanel";
import { ParkOverSheet } from "./ParkOverSheet";
import { PennyRail } from "./PennyRail";
import { ObjectiveChip } from "./ObjectiveChip";
import { PauseVeil } from "./PauseVeil";
import { PerfOverlay } from "./PerfOverlay";
import { HoverHint } from "./HoverHint";
import { ZonePanel } from "./ZonePanel";

export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <AchievementWatcher />
      <TopBar />
      <ObjectiveChip />
      <GuidedChecklist />
      <InspectorPanel />
      <GuestInspector />
      <CoasterBuilderPanel />
      <ZonePanel />
      <ParkPanel />
      <BuildDock />
      <PennyRail />
      <HoverHint />
      <ManualPanel />
      <PerfOverlay />
      <MilestoneSheet />
      <ParkOverSheet />
      <PauseVeil />
    </div>
  );
}
