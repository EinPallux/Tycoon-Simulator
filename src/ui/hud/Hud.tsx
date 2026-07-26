"use client";

/** In-game HUD composition (UI_UX_DESIGN.md §7): corners busy, center sacred. */

import { useGameStore } from "@/ui/stores/gameStore";
import { AchievementWatcher } from "./AchievementWatcher";
import { PhotoModeBar } from "./PhotoModeBar";
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
  const photoMode = useGameStore((s) => s.photoMode);
  const onboard = useGameStore((s) => s.onboardCoaster);

  // Photo mode & the onboard cam clear the stage — HUD out, minimal chrome in.
  if (photoMode || onboard !== null) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        <AchievementWatcher />
        <PhotoModeBar />
        {onboard !== null && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
            <span className="skewed inline-block bg-ink-900/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-paper-050">
              <span className="unskew inline-block">🎢 Onboard — Esc to hop off</span>
            </span>
          </div>
        )}
      </div>
    );
  }

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
