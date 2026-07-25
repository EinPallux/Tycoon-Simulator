"use client";

/**
 * GLTF loading utilities. A "model" (manifest id) resolves to mesh parts —
 * geometry + material + baked local matrix — ready for instanced rendering.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Matrix4, Mesh, type BufferGeometry, type Material } from "three";
import { MODEL_ASSETS, modelUrl, type ModelAssetId } from "@/content/asset-manifest";

export interface ModelPart {
  geometry: BufferGeometry;
  material: Material;
  /** Node's world matrix within the GLB scene (baked hierarchy). */
  matrix: Matrix4;
}

export function isModelAssetId(id: string): id is ModelAssetId {
  return id in MODEL_ASSETS;
}

export function toModelAssetId(id: string): ModelAssetId {
  if (!isModelAssetId(id)) throw new Error(`Unknown model asset id: ${id}`);
  return id;
}

export function useModelParts(id: ModelAssetId): ModelPart[] {
  const gltf = useGLTF(modelUrl(id));
  return useMemo(() => {
    const parts: ModelPart[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if (material) {
          parts.push({
            geometry: obj.geometry as BufferGeometry,
            material: material as Material,
            matrix: (obj.matrixWorld as Matrix4).clone(),
          });
        }
      }
    });
    return parts;
  }, [gltf]);
}

export function preloadModels(ids: readonly ModelAssetId[]): void {
  for (const id of ids) useGLTF.preload(modelUrl(id));
}
