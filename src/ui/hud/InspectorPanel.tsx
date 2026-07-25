"use client";

/** Left-dock inspector for the selected placeable (UI_UX_DESIGN.md §7.6). */

import { useMemo } from "react";
import { getPlaceableDef } from "@/content/catalog";
import { REFUND_GRACE_TICKS, DEMOLISH_REFUND } from "@/sim/commands";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { Panel } from "@/ui/kit/Panel";
import { useGameStore } from "@/ui/stores/gameStore";

export function InspectorPanel() {
  const selectedEntity = useGameStore((s) => s.selectedEntity);
  const worldVersion = useGameStore((s) => s.worldVersion);
  const selectEntity = useGameStore((s) => s.selectEntity);
  const setTool = useGameStore((s) => s.setTool);

  const info = useMemo(() => {
    const sim = useGameStore.getState().sim;
    if (!sim || selectedEntity === null) return null;
    const entity = sim.world.placeables.get(selectedEntity);
    if (!entity) return null;
    const def = getPlaceableDef(entity.defId);
    const withinGrace = sim.world.time - entity.placedAt <= REFUND_GRACE_TICKS;
    const refundRate = def.category === "scenery" && withinGrace ? 1 : DEMOLISH_REFUND;
    return { entity, def, withinGrace, refund: Math.round(def.cost * refundRate) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion tracks external world edits
  }, [selectedEntity, worldVersion]);

  if (!info) return null;
  const { entity, def, withinGrace, refund } = info;

  return (
    <div className="pointer-events-auto absolute left-4 top-20 w-72">
      <Panel title={def.name} onClose={() => selectEntity(null)}>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-600">Type</span>
            <b className="capitalize">{def.category}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Build cost</span>
            <b className="tabular">{formatMoney(def.cost)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Beauty</span>
            <b>
              {"★".repeat(Math.max(1, Math.round(def.beauty / 2)))}
              <span className="text-ink-600/40">
                {"★".repeat(Math.max(0, 5 - Math.max(1, Math.round(def.beauty / 2))))}
              </span>
            </b>
          </div>
          {def.themeTag && (
            <div className="flex justify-between">
              <span className="text-ink-600">Theme</span>
              <b className="capitalize">{def.themeTag}</b>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="!border-ink-900/40 !text-ink-900 hover:!border-accent-600 hover:!text-accent-600"
              onClick={() => setTool({ kind: "move", entityId: entity.id, rot: entity.rot })}
            >
              Move{withinGrace ? " (free)" : ` (${formatMoney(Math.round(def.cost * 0.1))})`}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                useGameStore.getState().sim?.dispatch({ type: "remove-entity", id: entity.id });
                selectEntity(null);
              }}
            >
              Demolish (+{formatMoney(refund)})
            </Button>
          </div>
          {withinGrace && def.category === "scenery" && (
            <p className="text-xs text-ink-600">
              Placed moments ago — full refund and free moves for a little while longer.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
