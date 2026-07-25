"use client";

import type { ReactNode } from "react";

/** Icon + big tabular number + caption (Rivals stat cards, refs 6–7). */
export function StatBlock({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-paper-050 px-4 py-3">
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <div>
        <div className="tabular display-hero text-2xl not-italic leading-none text-ink-900">
          {value}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
          {label}
        </div>
      </div>
    </div>
  );
}
