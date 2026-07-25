"use client";

import { useId } from "react";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Format the value readout (default: raw number). */
  format?: (value: number) => string;
}

/** Settings/pricing slider row on a light well (ref 4). */
export function Slider({ label, value, min, max, step = 1, onChange, format }: SliderProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 bg-paper-100 px-4 py-2.5">
      <label htmlFor={id} className="w-44 shrink-0 text-sm font-semibold text-ink-900">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-ink-900/20 accent-[#FFB300]"
      />
      <span className="tabular w-16 shrink-0 text-right text-sm font-bold text-ink-900">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
