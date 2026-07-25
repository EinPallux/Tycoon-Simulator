"use client";

import type { ReactNode } from "react";

export type CardColor = "blue" | "teal" | "magenta" | "green" | "purple" | "orange";

const COLOR_CLASSES: Record<CardColor, string> = {
  blue: "bg-card-blue",
  teal: "bg-card-teal",
  magenta: "bg-card-magenta",
  green: "bg-card-green",
  purple: "bg-card-purple",
  orange: "bg-card-orange",
};

export interface CategoryCardProps {
  color: CardColor;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Vibrant skewed selection card with ray texture (refs 1–2). */
export function CategoryCard({
  color,
  title,
  subtitle,
  icon,
  badge,
  selected = false,
  disabled = false,
  onClick,
  className = "",
}: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`skewed group relative flex cursor-pointer flex-col overflow-hidden text-left transition-all duration-100 ${
        selected ? "ring-4 ring-accent-500" : "ring-0"
      } ${disabled ? "cursor-not-allowed opacity-40" : "hover:-translate-y-0.5"} ${className}`}
    >
      {badge && (
        <span className="absolute left-2 top-2 z-10 bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-900">
          {badge}
        </span>
      )}
      <div
        className={`rays flex h-20 items-center justify-center text-4xl text-paper-050 ${COLOR_CLASSES[color]}`}
      >
        <span className="unskew drop-shadow-md transition-transform duration-100 group-hover:scale-110">
          {icon}
        </span>
      </div>
      <div className="bg-paper-050 px-3 py-2">
        <div className="unskew">
          <div className="display-hero truncate text-sm not-italic text-ink-900">{title}</div>
          {subtitle && <div className="truncate text-xs text-ink-600">{subtitle}</div>}
        </div>
      </div>
    </button>
  );
}
