"use client";

/** HUB — the between-parks shell (UI_UX_DESIGN.md §5–6). */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppStore } from "@/ui/stores/appStore";
import { TabStrip, type TabDef } from "@/ui/kit/TabStrip";
import { ToastRail } from "@/ui/kit/Toast";
import { ContinueTab } from "@/ui/hub/ContinueTab";
import { MyParksTab } from "@/ui/hub/MyParksTab";
import { NewParkTab } from "@/ui/hub/NewParkTab";
import { SettingsTab } from "@/ui/hub/SettingsTab";
import { CreditsTab } from "@/ui/hub/CreditsTab";

type HubTab = "continue" | "parks" | "new" | "achievements" | "records" | "settings" | "credits";

const TABS: ReadonlyArray<TabDef<HubTab>> = [
  { id: "continue", label: "Continue" },
  { id: "parks", label: "My Parks" },
  { id: "new", label: "New Park" },
  { id: "achievements", label: "Achievements", lockedHint: "Arrives in Phase 4" },
  { id: "records", label: "Records", lockedHint: "Arrives in Phase 4" },
  { id: "settings", label: "Settings" },
  { id: "credits", label: "Credits" },
];

export default function HubPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [tab, setTab] = useState<HubTab>("continue");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && !profile) router.replace("/");
  }, [hydrated, profile, router]);

  return (
    <main className="facet-field flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 pt-5">
        <button
          onClick={() => router.push("/")}
          className="display-hero cursor-pointer text-2xl text-paper-050 transition-colors hover:text-accent-500"
        >
          Wander<span className="text-accent-500">park</span>
        </button>
        {hydrated && profile && (
          <div className="skewed flex items-center gap-2 bg-ink-700/70 py-1.5 pl-2 pr-4">
            <span className="h-6 w-6" style={{ backgroundColor: profile.color }} aria-hidden />
            <span className="unskew text-sm font-bold text-paper-050">{profile.name}</span>
          </div>
        )}
      </header>

      <div className="mt-6 px-6">
        <TabStrip tabs={TABS} active={tab} onSelect={setTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-8">
        {tab === "continue" && <ContinueTab onNewPark={() => setTab("new")} />}
        {tab === "parks" && <MyParksTab />}
        {tab === "new" && <NewParkTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "credits" && <CreditsTab />}
      </div>

      <ToastRail />
    </main>
  );
}
