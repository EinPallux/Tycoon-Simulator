"use client";

/**
 * Placed entities (scenery + stalls), grouped by model and instanced.
 * Click = select (inspector); re-derived on worldVersion bumps.
 */

import { useMemo } from "react";
import { getPlaceableDef } from "@/content/catalog";
import { rotatedFootprint } from "@/sim/validate";
import { useGameStore } from "@/ui/stores/gameStore";
import { toModelAssetId } from "./useModelParts";
import { InstancedModel, type PlacementItem } from "./InstancedModel";
import type { ModelAssetId } from "@/content/asset-manifest";

interface EntityGroup {
  assetId: ModelAssetId;
  items: PlacementItem[];
}

export function EntitiesLayer() {
  const worldVersion = useGameStore((s) => s.worldVersion);
  const selectEntity = useGameStore((s) => s.selectEntity);
  const selectedEntity = useGameStore((s) => s.selectedEntity);

  const groups = useMemo((): EntityGroup[] => {
    const sim = useGameStore.getState().sim;
    if (!sim) return [];
    const byModel = new Map<ModelAssetId, PlacementItem[]>();
    for (const entity of sim.world.placeables.values()) {
      const def = getPlaceableDef(entity.defId);
      const assetId = toModelAssetId(def.model);
      const [w, d] = rotatedFootprint(def, entity.rot);
      let group = byModel.get(assetId);
      if (!group) {
        group = [];
        byModel.set(assetId, group);
      }
      group.push({ key: entity.id, x: entity.x, z: entity.z, rot: entity.rot, w, d });
    }
    return [...byModel.entries()].map(([assetId, items]) => ({ assetId, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion IS the dependency (world is external mutable state)
  }, [worldVersion]);

  const selected = useMemo(() => {
    const sim = useGameStore.getState().sim;
    if (!sim || selectedEntity === null) return null;
    const entity = sim.world.placeables.get(selectedEntity);
    if (!entity) return null;
    const def = getPlaceableDef(entity.defId);
    const [w, d] = rotatedFootprint(def, entity.rot);
    return { x: entity.x, z: entity.z, w, d };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion tracks external world edits
  }, [selectedEntity, worldVersion]);

  return (
    <>
      {groups.map((group) => (
        <InstancedModel
          key={group.assetId}
          assetId={group.assetId}
          items={group.items}
          onItemClick={(item) => {
            const store = useGameStore.getState();
            if (store.tool.kind === "select") selectEntity(item.key);
            else if (store.tool.kind === "bulldoze")
              store.sim?.dispatch({ type: "remove-entity", id: item.key });
          }}
        />
      ))}
      {selected && (
        <mesh
          position={[selected.x + selected.w / 2, 0.02, selected.z + selected.d / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[selected.w + 0.15, selected.d + 0.15]} />
          <meshBasicMaterial color="#FFB300" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
