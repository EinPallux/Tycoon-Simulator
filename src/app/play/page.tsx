"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

/** /play is fully client-side; Three.js never enters a server bundle. */
const GameRoot = dynamic(() => import("@/render/GameRoot"), {
  ssr: false,
  loading: () => <BootScreen label="Waking up the park…" />,
});

export default function PlayPage() {
  return (
    <Suspense fallback={<BootScreen label="Reading the map…" />}>
      <GameRoot />
    </Suspense>
  );
}

function BootScreen({ label }: { label: string }) {
  return (
    <div className="facet-field flex min-h-dvh flex-col items-center justify-center gap-6">
      <div className="display-hero text-6xl text-paper-050">
        Wander<span className="text-accent-500">park</span>
      </div>
      <div className="skewed h-2 w-64 overflow-hidden bg-paper-050/20">
        <div className="h-full w-1/3 animate-pulse bg-accent-500" />
      </div>
      <p className="text-sm text-paper-050/60">{label}</p>
    </div>
  );
}
