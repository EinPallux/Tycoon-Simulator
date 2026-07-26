"use client";

/**
 * Pointer interaction on the world: ghost previews, path painting strokes,
 * entity placement/move, bulldoze. Validation always comes from the sim's
 * canPlace* functions — one source of truth (TECHNICAL_ARCHITECTURE.md §6).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { MeshBasicMaterial } from "three";
import { getPlaceableDef, SURFACES } from "@/content/catalog";
import { FWD, pieceTiles, type Heading, type TrackNode } from "@/sim/coaster/pieces";
import { isCoasterUnlocked } from "@/sim/research";
import { canPlaceEntity, canPlaceSurface, rotatedFootprint } from "@/sim/validate";
import { SURFACE_NONE, SURFACE_PATH, SURFACE_QUEUE } from "@/sim/world/tiles";
import { WORLD_SIZE } from "@/sim/world/world";
import { formatMoney } from "@/ui/format";
import { useGameStore, type Tool } from "@/ui/stores/gameStore";
import { toModelAssetId, useModelParts } from "./useModelParts";
import type { ModelAssetId } from "@/content/asset-manifest";

/** Station entry node for a hovered tile + heading: the tile's rear edge. */
function stationEntryAt(px: number, pz: number, rot: number): TrackNode {
  const tileX = Math.floor(px);
  const tileZ = Math.floor(pz);
  const [fx, fz] = FWD[rot as Heading] as readonly [number, number];
  return { x: tileX + 0.5 - fx * 0.5, z: tileZ + 0.5 - fz * 0.5, h: 0, dir: rot as Heading };
}

interface HoverState {
  tileX: number;
  tileZ: number;
  /** Anchor for footprint tools. */
  anchorX: number;
  anchorZ: number;
  valid: boolean;
  reason: string | null;
}

const VALID_COLOR = "#4FC3F7";
const INVALID_COLOR = "#E5484D";

export function BuildController() {
  const tool = useGameStore((s) => s.tool);
  const worldVersion = useGameStore((s) => s.worldVersion);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [strokeTiles, setStrokeTiles] = useState<ReadonlyArray<readonly [number, number]>>([]);
  const strokeSet = useRef(new Set<number>());
  const painting = useRef(false);

  // Leaving a tool clears transient state.
  useEffect(() => {
    setHover(null);
    setStrokeTiles([]);
    strokeSet.current.clear();
    painting.current = false;
    useGameStore.getState().setHoverInfo(null);
  }, [tool.kind]);

  // ── Hover computation ──────────────────────────────────────────────────
  const computeHover = useCallback(
    (px: number, pz: number): HoverState | null => {
      const sim = useGameStore.getState().sim;
      if (!sim) return null;
      const t = useGameStore.getState().tool;
      const tileX = Math.floor(px);
      const tileZ = Math.floor(pz);

      if (t.kind === "place" || t.kind === "move") {
        const defId = t.kind === "place" ? t.defId : sim.world.placeables.get(t.entityId)?.defId;
        if (!defId) return null;
        const def = getPlaceableDef(defId);
        const [w, d] = rotatedFootprint(def, t.rot);
        const anchorX = Math.round(px - w / 2);
        const anchorZ = Math.round(pz - d / 2);
        let verdict;
        if (t.kind === "move") {
          // Lift self out of the way for validity (mirrors sim move logic).
          const entity = sim.world.placeables.get(t.entityId);
          if (!entity) return null;
          verdict =
            entity.x === anchorX && entity.z === anchorZ && entity.rot === t.rot
              ? { ok: true as const }
              : canPlaceEntityIgnoring(sim, defId, anchorX, anchorZ, t.rot, t.entityId);
        } else {
          verdict = canPlaceEntity(sim.world, defId, anchorX, anchorZ, t.rot);
        }
        return {
          tileX,
          tileZ,
          anchorX,
          anchorZ,
          valid: verdict.ok,
          reason: verdict.ok ? null : verdict.reason,
        };
      }

      if (t.kind === "coaster") {
        // Once a draft exists, the builder panel drives — no ground hover.
        if (useGameStore.getState().coasterDraft !== null) return null;
        const entry = stationEntryAt(px, pz, t.rot);
        const tiles = pieceTiles({ type: "station", entry });
        const minX = Math.min(...tiles.map((tile) => tile[0]));
        const minZ = Math.min(...tiles.map((tile) => tile[1]));
        const defId = t.family === "mouse" ? "coaster/mouse" : "coaster/flume";
        const verdict = !isCoasterUnlocked(sim.world, t.family)
          ? { ok: false as const, reason: "Research this coaster type first" }
          : canPlaceEntity(sim.world, defId, minX, minZ, t.rot);
        return {
          tileX,
          tileZ,
          anchorX: minX,
          anchorZ: minZ,
          valid: verdict.ok,
          reason: verdict.ok ? null : verdict.reason,
        };
      }

      if (t.kind === "path") {
        const surface = t.surface === "queue" ? SURFACE_QUEUE : SURFACE_PATH;
        const verdict = canPlaceSurface(sim.world, tileX, tileZ, surface);
        return {
          tileX,
          tileZ,
          anchorX: tileX,
          anchorZ: tileZ,
          valid: verdict.ok,
          reason: verdict.ok ? null : verdict.reason,
        };
      }

      if (t.kind === "bulldoze") {
        const idx = tileZ * sim.world.tiles.size + tileX;
        const hasSurface = (sim.world.tiles.surface[idx] ?? 0) !== SURFACE_NONE;
        const occupant = sim.world.tiles.occupant[idx] ?? 0;
        return {
          tileX,
          tileZ,
          anchorX: tileX,
          anchorZ: tileZ,
          valid: hasSurface || occupant !== 0,
          reason: null,
        };
      }
      return null;
    },
    [],
  );

  // ── Stroke painting ────────────────────────────────────────────────────
  const extendStroke = useCallback((x: number, z: number): void => {
    const sim = useGameStore.getState().sim;
    if (!sim) return;
    const t = useGameStore.getState().tool;
    const idx = z * WORLD_SIZE + x;
    if (strokeSet.current.has(idx)) return;
    if (t.kind === "path") {
      const surface = t.surface === "queue" ? SURFACE_QUEUE : SURFACE_PATH;
      if (!canPlaceSurface(sim.world, x, z, surface).ok) return;
    } else if (t.kind === "bulldoze") {
      const hasSurface = (sim.world.tiles.surface[idx] ?? 0) !== SURFACE_NONE;
      if (!hasSurface) return;
    } else return;
    strokeSet.current.add(idx);
    setStrokeTiles((prev) => {
      const next = [...prev, [x, z] as const];
      const t2 = useGameStore.getState().tool;
      if (t2.kind === "path") {
        const per = t2.surface === "queue" ? SURFACES.queue.costPerTile : SURFACES.path.costPerTile;
        useGameStore
          .getState()
          .setHoverInfo(`${next.length} tiles · ${formatMoney(next.length * per)}`);
      }
      return next;
    });
  }, []);

  // ── Pointer handlers on the ground hit-plane ───────────────────────────
  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>): void => {
      const next = computeHover(e.point.x, e.point.z);
      setHover((prev) =>
        prev &&
        next &&
        prev.tileX === next.tileX &&
        prev.tileZ === next.tileZ &&
        prev.anchorX === next.anchorX &&
        prev.anchorZ === next.anchorZ &&
        prev.valid === next.valid
          ? prev
          : next,
      );
      if (painting.current && next) extendStroke(next.tileX, next.tileZ);
    },
    [computeHover, extendStroke],
  );

  const finishStroke = useCallback((): void => {
    if (!painting.current) return;
    painting.current = false;
    const sim = useGameStore.getState().sim;
    const t = useGameStore.getState().tool;
    const tiles = strokeTiles;
    strokeSet.current.clear();
    setStrokeTiles([]);
    useGameStore.getState().setHoverInfo(null);
    if (!sim || tiles.length === 0) return;
    if (t.kind === "path") {
      const surface = t.surface === "queue" ? SURFACE_QUEUE : SURFACE_PATH;
      sim.dispatch({ type: "paint-surface", surface, tiles });
    } else if (t.kind === "bulldoze") {
      sim.dispatch({ type: "erase-surface", tiles });
    }
  }, [strokeTiles]);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>): void => {
      if (e.button !== 0) return;
      const sim = useGameStore.getState().sim;
      if (!sim) return;
      const store = useGameStore.getState();
      const t = store.tool;
      const h = computeHover(e.point.x, e.point.z);
      if (!h) {
        if (t.kind === "select") store.selectEntity(null);
        return;
      }

      switch (t.kind) {
        case "select":
          store.selectEntity(null); // entity clicks are handled by EntitiesLayer
          break;
        case "coaster": {
          if (store.coasterDraft === null && h.valid) {
            store.startCoasterDraft(t.family, stationEntryAt(e.point.x, e.point.z, t.rot));
          }
          break;
        }
        case "place": {
          sim.dispatch({
            type: "place-entity",
            defId: t.defId,
            x: h.anchorX,
            z: h.anchorZ,
            rot: t.rot,
          });
          // Stay in the tool for rapid repeat placement (RCT style).
          break;
        }
        case "move": {
          const result = sim.dispatch({
            type: "move-entity",
            id: t.entityId,
            x: h.anchorX,
            z: h.anchorZ,
            rot: t.rot,
          });
          if (result.ok) store.setTool({ kind: "select" });
          break;
        }
        case "path":
        case "bulldoze": {
          painting.current = true;
          extendStroke(h.tileX, h.tileZ);
          // Bulldozing an entity is a click, not a stroke.
          if (t.kind === "bulldoze") {
            const idx = h.tileZ * sim.world.tiles.size + h.tileX;
            const occupant = sim.world.tiles.occupant[idx] ?? 0;
            if (occupant !== 0) {
              painting.current = false;
              sim.dispatch({ type: "remove-entity", id: occupant });
            }
          }
          break;
        }
      }
    },
    [computeHover, extendStroke],
  );

  useEffect(() => {
    const up = (): void => finishStroke();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [finishStroke]);

  // Keep hover fresh after world edits (validity may change under the cursor).
  useEffect(() => {
    setHover((prev) => (prev ? (computeHover(prev.tileX + 0.5, prev.tileZ + 0.5) ?? null) : prev));
  }, [worldVersion, computeHover]);

  return (
    <>
      <mesh
        position={[WORLD_SIZE / 2, 0, WORLD_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerOut={() => setHover(null)}
      >
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hover && tool.kind !== "select" && <GhostPreview tool={tool} hover={hover} />}

      {strokeTiles.map(([x, z]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x + 0.5, 0.03, z + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.94, 0.94]} />
          <meshBasicMaterial
            color={tool.kind === "bulldoze" ? INVALID_COLOR : VALID_COLOR}
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

/** Sim-identical validity for the move tool (self-collision ignored). */
function canPlaceEntityIgnoring(
  sim: NonNullable<ReturnType<typeof useGameStore.getState>["sim"]>,
  defId: string,
  x: number,
  z: number,
  rot: number,
  ignoreId: number,
): { ok: boolean; reason: string } {
  const world = sim.world;
  const entity = world.placeables.get(ignoreId);
  if (!entity) return { ok: false, reason: "Gone" };
  const def = getPlaceableDef(entity.defId);
  // Temporarily unstamp (pure read approximation — restamp right away).
  const stamps: number[] = [];
  const [w, d] = rotatedFootprint(def, entity.rot);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const idx = (entity.z + dz) * world.tiles.size + (entity.x + dx);
      stamps.push(idx);
      world.tiles.occupant[idx] = 0;
    }
  }
  const verdict = canPlaceEntity(world, defId, x, z, rot);
  for (const idx of stamps) world.tiles.occupant[idx] = ignoreId;
  return verdict.ok ? { ok: true, reason: "" } : { ok: false, reason: verdict.reason };
}

// ── Ghost preview ────────────────────────────────────────────────────────

function GhostPreview({ tool, hover }: { tool: Tool; hover: HoverState }) {
  const color = hover.valid ? VALID_COLOR : INVALID_COLOR;

  if (tool.kind === "place" || tool.kind === "move") {
    const sim = useGameStore.getState().sim;
    const defId =
      tool.kind === "place" ? tool.defId : (sim?.world.placeables.get(tool.entityId)?.defId ?? null);
    if (!defId) return null;
    const def = getPlaceableDef(defId);
    const [w, d] = rotatedFootprint(def, tool.rot);
    return (
      <group>
        {def.model ? (
          <GhostModel
            assetId={toModelAssetId(def.model)}
            x={hover.anchorX}
            z={hover.anchorZ}
            rot={tool.rot}
            w={w}
            d={d}
            color={color}
          />
        ) : (
          // Procedural rides: a simple volume ghost.
          <mesh position={[hover.anchorX + w / 2, 0.6, hover.anchorZ + d / 2]}>
            <boxGeometry args={[w * 0.9, 1.2, d * 0.9]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}
        <mesh
          position={[hover.anchorX + w / 2, 0.025, hover.anchorZ + d / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  if (tool.kind === "coaster") {
    const w = tool.rot % 2 === 0 ? 1 : 2;
    const d = tool.rot % 2 === 0 ? 2 : 1;
    const [fx, fz] = FWD[tool.rot as Heading] as readonly [number, number];
    return (
      <group>
        <StationGhost
          anchorX={hover.anchorX}
          anchorZ={hover.anchorZ}
          w={w}
          d={d}
          rot={tool.rot}
          color={color}
        />
        {/* Travel direction arrow off the station's far end. */}
        <mesh
          position={[
            hover.anchorX + w / 2 + fx * (w / 2 + 0.4),
            0.35,
            hover.anchorZ + d / 2 + fz * (d / 2 + 0.4),
          ]}
          rotation={[Math.PI / 2, 0, -Math.atan2(fx, fz)]}
        >
          <coneGeometry args={[0.2, 0.5, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh
          position={[hover.anchorX + w / 2, 0.025, hover.anchorZ + d / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  // Single-tile highlight for path/bulldoze hover.
  return (
    <mesh position={[hover.tileX + 0.5, 0.03, hover.tileZ + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.94, 0.94]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

/** Two station-platform tiles, oriented along the travel heading. */
function StationGhost({
  anchorX,
  anchorZ,
  w,
  d,
  rot,
  color,
}: {
  anchorX: number;
  anchorZ: number;
  w: number;
  d: number;
  rot: number;
  color: string;
}) {
  const parts = useModelParts("coaster/station");
  const material = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  );
  material.color.set(color);
  const yaw = Math.PI - (rot * Math.PI) / 2; // authored +z ↦ heading `rot`
  const [fx, fz] = FWD[rot as Heading] as readonly [number, number];
  const cx = anchorX + w / 2;
  const cz = anchorZ + d / 2;
  return (
    <>
      {[-0.5, 0.5].map((off) => (
        <group
          key={off}
          position={[cx + fx * off, 0.02, cz + fz * off]}
          rotation={[0, yaw, 0]}
        >
          {parts.map((part, i) => (
            <mesh
              key={i}
              geometry={part.geometry}
              material={material}
              matrix={part.matrix}
              matrixAutoUpdate={false}
            />
          ))}
        </group>
      ))}
    </>
  );
}

function GhostModel({
  assetId,
  x,
  z,
  rot,
  w,
  d,
  color,
}: {
  assetId: ModelAssetId;
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  color: string;
}) {
  const parts = useModelParts(assetId);
  const material = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  );
  material.color.set(color);
  return (
    <group position={[x + w / 2, 0.02, z + d / 2]} rotation={[0, (-rot * Math.PI) / 2, 0]}>
      {parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          material={material}
          matrix={part.matrix}
          matrixAutoUpdate={false}
        />
      ))}
    </group>
  );
}
