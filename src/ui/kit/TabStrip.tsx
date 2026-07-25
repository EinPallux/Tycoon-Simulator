"use client";

export interface TabDef<T extends string = string> {
  id: T;
  label: string;
  /** Locked tabs render dimmed with a hint chip (future phases). */
  lockedHint?: string;
}

export interface TabStripProps<T extends string> {
  tabs: ReadonlyArray<TabDef<T>>;
  active: T;
  onSelect: (id: T) => void;
}

/** Dark chrome bar with skewed tab chips; active = accent (refs 6–8). */
export function TabStrip<T extends string>({ tabs, active, onSelect }: TabStripProps<T>) {
  return (
    <nav className="flex items-end gap-1 overflow-x-auto bg-ink-900/90 px-4 pt-2" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const locked = tab.lockedHint !== undefined;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={locked}
            title={tab.lockedHint}
            onClick={() => onSelect(tab.id)}
            className={`skewed relative shrink-0 cursor-pointer px-5 py-2.5 font-bold uppercase tracking-wider transition-colors duration-100 ${
              isActive
                ? "bg-paper-050 text-ink-900"
                : locked
                  ? "cursor-not-allowed bg-ink-700/40 text-paper-050/30"
                  : "bg-ink-700/60 text-paper-050/80 hover:bg-ink-600 hover:text-paper-050"
            }`}
          >
            <span className="unskew flex items-center gap-1.5 text-sm">
              {tab.label}
              {locked && <span aria-hidden>🔒</span>}
            </span>
            {isActive && (
              <span className="absolute -bottom-0 left-0 h-1 w-full bg-accent-500" aria-hidden />
            )}
          </button>
        );
      })}
    </nav>
  );
}
