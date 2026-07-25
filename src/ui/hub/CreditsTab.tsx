"use client";

import { CREDIT_KITS } from "@/content/asset-manifest";
import { HeroHeader } from "@/ui/kit/HeroHeader";

export function CreditsTab() {
  return (
    <div className="mx-auto max-w-3xl">
      <HeroHeader title="Credits" />
      <div className="mt-10 flex flex-col gap-6">
        <div className="skewed panel-shadow bg-paper-050 p-6">
          <div className="unskew text-ink-900">
            <h3 className="display-hero text-2xl">Wanderpark</h3>
            <p className="mt-2 text-sm text-ink-600">
              A single-player theme-park tycoon for the browser. Free, no accounts, your saves stay
              on your machine.
            </p>
          </div>
        </div>

        <div className="skewed panel-shadow bg-paper-050 p-6">
          <div className="unskew text-ink-900">
            <h3 className="display-hero text-2xl">3D Art — CC0 heroes</h3>
            <p className="mt-2 text-sm text-ink-600">
              All models and skyboxes are public-domain (CC0-1.0) works, gratefully used:
            </p>
            <ul className="mt-3 list-inside list-disc text-sm">
              <li>
                <b>Kenney</b> — <span className="text-ink-600">kenney.nl</span>
              </li>
              <li>
                <b>Kay Lousberg (KayKit)</b> —{" "}
                <span className="text-ink-600">kaylousberg.com</span>
              </li>
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-600">
              Kits in this build
            </p>
            <p className="mt-1 text-xs text-ink-600">
              {CREDIT_KITS.map((k) => k.replace(/_/g, " ")).join(" · ")}
            </p>
          </div>
        </div>

        <div className="skewed panel-shadow bg-paper-050 p-6">
          <div className="unskew text-ink-900">
            <h3 className="display-hero text-2xl">Type</h3>
            <p className="mt-2 text-sm text-ink-600">
              Big Shoulders Display &amp; Inter (SIL Open Font License, via Google Fonts).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
