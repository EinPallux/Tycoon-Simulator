"use client";

/** Cross-park records: the bragging wall. */

import { formatMoney } from "@/ui/format";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { useAppStore } from "@/ui/stores/appStore";

export function RecordsTab() {
  const records = useAppStore((s) => s.records);
  const totals = Object.values(records.perPark).reduce(
    (acc, p) => ({ guests: acc.guests + p.guests, riders: acc.riders + p.riders }),
    { guests: 0, riders: 0 },
  );

  const rows: { icon: string; label: string; value: string; park: string }[] = [
    { icon: "⭐", label: "Best park rating", value: `${records.bestRating.value}`, park: records.bestRating.park },
    { icon: "👥", label: "Biggest crowd at once", value: `${records.peakGuests.value}`, park: records.peakGuests.park },
    { icon: "💰", label: "Richest treasury", value: formatMoney(records.richest.value), park: records.richest.park },
    { icon: "🎢", label: "Most exciting coaster", value: records.bestCoaster.value.toFixed(1), park: records.bestCoaster.park },
    { icon: "📅", label: "Longest-running park", value: `${records.longestRun.value} days`, park: records.longestRun.park },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <HeroHeader title="Records" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="skewed panel-shadow bg-paper-050 p-5 text-center">
          <div className="unskew">
            <div className="tabular display-hero text-4xl not-italic text-ink-900">
              {totals.guests.toLocaleString("en-US")}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-600">
              Guests welcomed, all parks
            </div>
          </div>
        </div>
        <div className="skewed panel-shadow bg-paper-050 p-5 text-center">
          <div className="unskew">
            <div className="tabular display-hero text-4xl not-italic text-ink-900">
              {totals.riders.toLocaleString("en-US")}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-600">
              Coaster riders, all parks
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="skewed bg-ink-700/60 px-5 py-3">
            <div className="unskew flex items-center gap-3">
              <span className="text-xl" aria-hidden>
                {row.icon}
              </span>
              <span className="flex-1 text-sm font-bold text-paper-050">{row.label}</span>
              <span className="tabular text-lg font-extrabold text-accent-500">{row.value}</span>
              <span className="w-32 truncate text-right text-xs text-paper-050/50">{row.park}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-paper-050/50">
        Records update live while you play. Deleting a park keeps its glory here — history is
        history.
      </p>
    </div>
  );
}
