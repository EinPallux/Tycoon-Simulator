"use client";

/**
 * Auto-tiled path & queue rendering. Re-derives instance lists from the tile
 * map on worldVersion bumps (edit-rate). Piece semantics from
 * sim/world/pathgraph.ts; visual rotation offsets, if a kit model's canonical
 * orientation differs, are corrected HERE per piece — never in the sim.
 */

import { useMemo } from "react";
import { neighborMask, pieceForMask, type PathPiece } from "@/sim/world/pathgraph";
import { SURFACE_PATH, SURFACE_QUEUE, type Surface } from "@/sim/world/tiles";
import { useGameStore } from "@/ui/stores/gameStore";
import type { ModelAssetId } from "@/content/asset-manifest";
import { InstancedModel, type PlacementItem } from "./InstancedModel";

const PATH_MODELS: Record<PathPiece, ModelAssetId> = {
  straight: "path/straight",
  corner: "path/corner",
  split: "path/split",
  crossing: "path/crossing",
  end: "path/end",
};

/** The queue set has no dead-end cap — straight is the fallback. */
const QUEUE_MODELS: Record<PathPiece, ModelAssetId> = {
  straight: "queue/straight",
  corner: "queue/corner",
  split: "queue/split",
  crossing: "queue/crossing",
  end: "queue/straight",
};

/**
 * Kenney path pieces are authored with the flow along z (north-south), which
 * matches our canonical semantics — offsets stay 0 unless a specific piece's
 * chirality disagrees (verified via screenshots).
 */
const VISUAL_ROT_OFFSET: Record<PathPiece, number> = {
  straight: 0,
  corner: 0,
  split: 0,
  crossing: 0,
  end: 0,
};

function deriveItems(surface: Surface): Map<PathPiece, PlacementItem[]> {
  const sim = useGameStore.getState().sim;
  const groups = new Map<PathPiece, PlacementItem[]>();
  if (!sim) return groups;
  const tiles = sim.world.tiles;
  const { x0, z0, w, d } = sim.world.ownedRect;
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      const idx = z * tiles.size + x;
      if (tiles.surface[idx] !== surface) continue;
      const mask = neighborMask(tiles, x, z, surface);
      const visual = pieceForMask(mask);
      const rot = (visual.rot + (VISUAL_ROT_OFFSET[visual.piece] ?? 0)) % 4;
      let group = groups.get(visual.piece);
      if (!group) {
        group = [];
        groups.set(visual.piece, group);
      }
      group.push({ key: idx, x, z, rot, w: 1, d: 1 });
    }
  }
  return groups;
}

export function PathLayer() {
  const worldVersion = useGameStore((s) => s.worldVersion);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion IS the dependency (world is external mutable state)
  const pathGroups = useMemo(() => deriveItems(SURFACE_PATH), [worldVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion IS the dependency (world is external mutable state)
  const queueGroups = useMemo(() => deriveItems(SURFACE_QUEUE), [worldVersion]);

  return (
    <>
      {[...pathGroups.entries()].map(([piece, items]) => (
        <InstancedModel
          key={`p-${piece}`}
          assetId={PATH_MODELS[piece]}
          items={items}
          castShadow={false}
        />
      ))}
      {[...queueGroups.entries()].map(([piece, items]) => (
        <InstancedModel
          key={`q-${piece}`}
          assetId={QUEUE_MODELS[piece]}
          items={items}
          castShadow={false}
        />
      ))}
    </>
  );
}
