"use client";

/** The Park Manual codex (GAME_DESIGN.md §12): searchable, never mandatory. */

import { useMemo, useState } from "react";
import { MANUAL_ARTICLES } from "@/content/manual";
import { Panel } from "@/ui/kit/Panel";
import { useGameStore } from "@/ui/stores/gameStore";

export function ManualPanel() {
  const manualOpen = useGameStore((s) => s.manualOpen);
  const setManualOpen = useGameStore((s) => s.setManualOpen);
  const [query, setQuery] = useState("");
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MANUAL_ARTICLES;
    return MANUAL_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.some((p) => p.toLowerCase().includes(q)),
    );
  }, [query]);

  if (!manualOpen) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2">
      <Panel
        title="Park Manual"
        onClose={() => setManualOpen(false)}
        className="max-h-[80vh]"
        headerExtra={
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-32 bg-paper-050/10 px-2 py-1 text-xs text-paper-050 outline-none placeholder:text-paper-050/40 focus:bg-paper-050/20"
          />
        }
      >
        <div className="flex flex-col gap-1.5">
          {filtered.length === 0 && (
            <p className="text-xs text-ink-600">
              Nothing about “{query}” yet — Penny is taking notes for the next edition.
            </p>
          )}
          {filtered.map((article) => {
            const open = openArticle === article.id || query.trim().length > 0;
            return (
              <div key={article.id} className="bg-paper-100">
                <button
                  onClick={() => setOpenArticle(open && !query ? null : article.id)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
                >
                  <span aria-hidden>{article.icon}</span>
                  <span className="flex-1 text-xs font-bold uppercase tracking-wide">
                    {article.title}
                  </span>
                  <span className="text-ink-600" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                </button>
                {open && (
                  <div className="flex flex-col gap-1.5 px-3 pb-2.5 text-xs leading-snug text-ink-900/90">
                    {article.body.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
