"use client";

/** Bottom-right tool hint: stroke costs, active-tool help (UI_UX_DESIGN.md §7). */

import { useGameStore } from "@/ui/stores/gameStore";
import { getPlaceableDef } from "@/content/catalog";
import { formatMoney } from "@/ui/format";

export function HoverHint() {
  const tool = useGameStore((s) => s.tool);
  const hoverInfo = useGameStore((s) => s.hoverInfo);

  let text: string | null = hoverInfo;
  if (!text) {
    switch (tool.kind) {
      case "path":
        text =
          tool.surface === "queue"
            ? "Drag to paint queue · Esc to stop"
            : "Drag to paint path · Esc to stop";
        break;
      case "place": {
        const def = getPlaceableDef(tool.defId);
        text = `${def.name} · ${formatMoney(def.cost)} · R to rotate · Esc to stop`;
        break;
      }
      case "move":
        text = "Click a new spot · R to rotate · Esc to cancel";
        break;
      case "bulldoze":
        text = "Click or drag to demolish · Esc to stop";
        break;
      default:
        text = null;
    }
  }

  if (!text) return null;
  return (
    <div className="pointer-events-none absolute bottom-4 right-4">
      <div className="skewed bg-ink-900/85 px-4 py-2 text-xs font-semibold text-paper-050">
        <span className="unskew inline-block">{text}</span>
      </div>
    </div>
  );
}
