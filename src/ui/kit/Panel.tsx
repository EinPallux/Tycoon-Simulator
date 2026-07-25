"use client";

import type { ReactNode } from "react";

export interface PanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** Extra header content (right side, before the close button). */
  headerExtra?: ReactNode;
}

/**
 * Light content panel with a dark header slash (UI_UX_DESIGN §4).
 * The universal container for inspectors and management views.
 */
export function Panel({ title, onClose, children, className = "", headerExtra }: PanelProps) {
  return (
    <section
      className={`panel-shadow-light flex flex-col overflow-hidden rounded-sm bg-paper-050 text-ink-900 ${className}`}
    >
      <header className="flex items-center gap-2 bg-ink-900 py-2 pl-4 pr-2 text-paper-050">
        <h2 className="display-hero flex-1 truncate text-lg not-italic tracking-wide">{title}</h2>
        {headerExtra}
        {onClose && (
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="cursor-pointer px-2 py-1 text-paper-050/70 transition-colors hover:text-accent-500"
          >
            ✕
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}
