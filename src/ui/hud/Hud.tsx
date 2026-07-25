"use client";

/** In-game HUD composition (UI_UX_DESIGN.md §7): corners busy, center sacred. */

import { TopBar } from "./TopBar";
import { BuildDock } from "./BuildDock";
import { InspectorPanel } from "./InspectorPanel";
import { PauseVeil } from "./PauseVeil";
import { PerfOverlay } from "./PerfOverlay";
import { HoverHint } from "./HoverHint";

export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <TopBar />
      <InspectorPanel />
      <BuildDock />
      <HoverHint />
      <PerfOverlay />
      <PauseVeil />
    </div>
  );
}
