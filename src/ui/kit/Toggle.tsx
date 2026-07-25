"use client";

import { useId } from "react";

export interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Settings toggle row on a light well. */
export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 bg-paper-100 px-4 py-2.5">
      <label htmlFor={id} className="flex-1 text-sm font-semibold text-ink-900">
        {label}
        {hint && <span className="block text-xs font-normal text-ink-600">{hint}</span>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-150 ${
          checked ? "bg-accent-500" : "bg-ink-900/25"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-paper-050 shadow transition-all duration-150 ${
            checked ? "left-8" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
