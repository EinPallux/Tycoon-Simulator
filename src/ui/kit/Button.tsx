"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Disable the signature skew (for tight toolbars). */
  square?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent-500 text-ink-900 hover:bg-accent-400 active:bg-accent-600 disabled:bg-ink-600 disabled:text-paper-200/50",
  secondary:
    "bg-transparent text-paper-050 border-2 border-paper-050/70 hover:border-accent-500 hover:text-accent-500 disabled:opacity-40",
  ghost: "bg-paper-050/10 text-paper-050 hover:bg-paper-050/20 disabled:opacity-40",
  danger: "bg-danger-500 text-paper-050 hover:bg-danger-600 disabled:opacity-40",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base",
};

/** Skewed, caps, chunky — the standard Wanderpark button (UI_UX_DESIGN §4). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", square = false, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${square ? "" : "skewed"} inline-block cursor-pointer select-none font-bold uppercase tracking-wide transition-all duration-100 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      <span className={square ? "" : "unskew inline-block"}>{children}</span>
    </button>
  );
});
