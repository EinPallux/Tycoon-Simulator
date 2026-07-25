"use client";

/**
 * Instanced renderer for N grid placements of one model
 * (TECHNICAL_ARCHITECTURE.md §8 — instancing-first).
 * One InstancedMesh per GLB mesh part; capacity grows in powers of two and
 * matrices refresh only when `items` changes (edit-rate, not frame-rate).
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Matrix4 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useModelParts, type ModelPart } from "./useModelParts";
import type { ModelAssetId } from "@/content/asset-manifest";

export interface PlacementItem {
  /** Stable identity (entity id or tile index). */
  key: number;
  /** Anchor tile (min corner). */
  x: number;
  z: number;
  /** Quarter turns clockwise (N→E at 1). */
  rot: number;
  /** Rotated footprint in tiles. */
  w: number;
  d: number;
  /** Extra uniform scale (rarely used). */
  scale?: number;
}

export interface InstancedModelProps {
  assetId: ModelAssetId;
  items: readonly PlacementItem[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  onItemClick?: (item: PlacementItem, e: ThreeEvent<MouseEvent>) => void;
  onItemHover?: (item: PlacementItem | null) => void;
}

const scratch = new Matrix4();
const compose = new Matrix4();

/** World matrix = T(footprint center) · R_y(-rot·90°) · S · partMatrix. */
export function composeItemMatrix(item: PlacementItem, partMatrix: Matrix4, out: Matrix4): Matrix4 {
  const cx = item.x + item.w / 2;
  const cz = item.z + item.d / 2;
  const yaw = (-item.rot * Math.PI) / 2;
  out.makeRotationY(yaw);
  if (item.scale !== undefined && item.scale !== 1) {
    scratch.makeScale(item.scale, item.scale, item.scale);
    out.multiply(scratch);
  }
  out.multiply(partMatrix);
  // Premultiplying a pure translation only offsets the translation column.
  out.elements[12] = (out.elements[12] ?? 0) + cx;
  out.elements[14] = (out.elements[14] ?? 0) + cz;
  return out;
}

function nextPow2(n: number): number {
  let p = 16;
  while (p < n) p <<= 1;
  return p;
}

function PartInstances({
  part,
  items,
  castShadow,
  receiveShadow,
  onItemClick,
  onItemHover,
}: {
  part: ModelPart;
  items: readonly PlacementItem[];
  castShadow: boolean;
  receiveShadow: boolean;
  onItemClick?: InstancedModelProps["onItemClick"];
  onItemHover?: InstancedModelProps["onItemHover"];
}) {
  const capacity = nextPow2(items.length);
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      composeItemMatrix(item, part.matrix, compose);
      mesh.setMatrixAt(i, compose);
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, part]);

  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[part.geometry, part.material, capacity]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
      onClick={
        onItemClick
          ? (e) => {
              const item = e.instanceId !== undefined ? items[e.instanceId] : undefined;
              if (item) {
                e.stopPropagation();
                onItemClick(item, e);
              }
            }
          : undefined
      }
      onPointerMove={
        onItemHover
          ? (e) => {
              const item = e.instanceId !== undefined ? items[e.instanceId] : undefined;
              onItemHover(item ?? null);
            }
          : undefined
      }
      onPointerOut={onItemHover ? () => onItemHover(null) : undefined}
    />
  );
}

export function InstancedModel({
  assetId,
  items,
  castShadow = true,
  receiveShadow = true,
  onItemClick,
  onItemHover,
}: InstancedModelProps) {
  const parts = useModelParts(assetId);
  const stableParts = useMemo(() => parts, [parts]);
  if (items.length === 0) return null;
  return (
    <>
      {stableParts.map((part, i) => (
        <PartInstances
          key={i}
          part={part}
          items={items}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onItemClick={onItemClick}
          onItemHover={onItemHover}
        />
      ))}
    </>
  );
}
