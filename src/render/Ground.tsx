"use client";

/**
 * Ground plane with owned-land tinting and a build-mode tile grid,
 * plus the perimeter fence and the park entrance arch.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial, Vector4 } from "three";
import { WORLD_SIZE } from "@/sim/world/world";
import { useGameStore } from "@/ui/stores/gameStore";
import { InstancedModel, type PlacementItem } from "./InstancedModel";
import { useModelParts } from "./useModelParts";
import { damp } from "@/shared/mathx";

const GROUND_VERT = /* glsl */ `
varying vec2 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xz;
  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const GROUND_FRAG = /* glsl */ `
uniform vec4 uOwnedRect; // x0, z0, w, d
uniform vec3 uLawn;
uniform vec3 uLawnAlt;
uniform vec3 uOutside;
uniform vec3 uGridColor;
uniform float uGridStrength;
uniform float uDaylight;
varying vec2 vWorld;
#include <fog_pars_fragment>
void main() {
  bool owned = vWorld.x >= uOwnedRect.x && vWorld.y >= uOwnedRect.y &&
               vWorld.x <= uOwnedRect.x + uOwnedRect.z && vWorld.y <= uOwnedRect.y + uOwnedRect.w;
  // Checker tint per tile for gentle texture.
  vec2 tile = floor(vWorld);
  float checker = mod(tile.x + tile.y, 2.0);
  vec3 col = owned ? mix(uLawn, uLawnAlt, checker * 0.5) : uOutside;

  // Tile grid lines inside owned land while building.
  if (owned && uGridStrength > 0.001) {
    vec2 f = fract(vWorld);
    vec2 fw = fwidth(vWorld) * 1.2;
    float lineX = 1.0 - smoothstep(0.0, fw.x, min(f.x, 1.0 - f.x));
    float lineY = 1.0 - smoothstep(0.0, fw.y, min(f.y, 1.0 - f.y));
    float line = max(lineX, lineY);
    col = mix(col, uGridColor, line * uGridStrength * 0.5);
  }
  // Day/night: the unlit ground follows the sky's ambient level.
  col *= mix(0.16, 1.0, uDaylight);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

/** Shared daylight level (0..1), written by SkyAndLights each frame. */
export const daylight = { value: 1 };

export function Ground() {
  const sim = useGameStore((s) => s.sim);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        fog: true,
        uniforms: {
          // Raw sRGB values — this shader writes directly to the canvas.
          uOwnedRect: { value: new Vector4(0, 0, 0, 0) },
          uLawn: { value: new Color("#69bf5e") },
          uLawnAlt: { value: new Color("#5fae52") },
          uOutside: { value: new Color("#7b8f5e") },
          uGridColor: { value: new Color("#f4f6fb") },
          uGridStrength: { value: 0 },
          uDaylight: { value: 1 },
          // three fog uniforms are injected via #include chunks
          fogColor: { value: new Color("#cfe9ff") },
          fogNear: { value: 90 },
          fogFar: { value: 260 },
        },
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
      }),
    [],
  );

  const gridTarget = useRef(0);
  useFrame((state, dt) => {
    if (!sim) return;
    const r = sim.world.ownedRect;
    (material.uniforms.uOwnedRect?.value as Vector4 | undefined)?.set(r.x0, r.z0, r.w, r.d);
    const tool = useGameStore.getState().tool;
    gridTarget.current = tool.kind === "select" ? 0 : 1;
    if (material.uniforms.uGridStrength) {
      material.uniforms.uGridStrength.value = damp(
        material.uniforms.uGridStrength.value as number,
        gridTarget.current,
        10,
        Math.min(dt, 0.05),
      );
    }
    if (material.uniforms.uDaylight) material.uniforms.uDaylight.value = daylight.value;
    // Track scene fog so the ground blends with the sky.
    const fog = state.scene.fog;
    if (fog && "near" in fog) {
      (material.uniforms.fogColor?.value as Color | undefined)?.copy(fog.color);
      if (material.uniforms.fogNear) material.uniforms.fogNear.value = fog.near;
      if (material.uniforms.fogFar) material.uniforms.fogFar.value = fog.far;
    }
  });

  return (
    <>
      <mesh
        material={material}
        position={[WORLD_SIZE / 2, 0, WORLD_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[WORLD_SIZE * 3, WORLD_SIZE * 3]} />
      </mesh>
      {/* Shadow catcher — the shader ground can't receive shadows itself. */}
      <mesh
        position={[WORLD_SIZE / 2, 0.001, WORLD_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[WORLD_SIZE * 1.5, WORLD_SIZE * 1.5]} />
        <shadowMaterial opacity={0.28} />
      </mesh>
    </>
  );
}

/** Perimeter fence with a 3-tile gap for the entrance arch. */
export function ParkBoundary() {
  const sim = useGameStore((s) => s.sim);

  const fenceItems = useMemo((): PlacementItem[] => {
    if (!sim) return [];
    const { x0, z0, w, d } = sim.world.ownedRect;
    const ex = sim.world.entrance.x;
    const items: PlacementItem[] = [];
    let key = 0;
    for (let x = x0; x < x0 + w; x++) {
      items.push({ key: key++, x, z: z0 - 1 + 0.45, rot: 1, w: 1, d: 1 });
      if (Math.abs(x - ex) > 1)
        items.push({ key: key++, x, z: z0 + d - 0.45, rot: 1, w: 1, d: 1 });
    }
    for (let z = z0; z < z0 + d; z++) {
      items.push({ key: key++, x: x0 - 1 + 0.45, z, rot: 0, w: 1, d: 1 });
      items.push({ key: key++, x: x0 + w - 0.45, z, rot: 0, w: 1, d: 1 });
    }
    return items;
  }, [sim]);

  if (!sim) return null;
  return <InstancedModel assetId="nature/fence-wood" items={fenceItems} castShadow={false} />;
}

/** The park entrance arch (fixed, south edge). */
export function ParkEntrance() {
  const sim = useGameStore((s) => s.sim);
  const parts = useModelParts("world/park-entrance");
  if (!sim) return null;
  const { x, z } = sim.world.entrance;
  return (
    <group position={[x + 0.5, 0, z + 0.55]}>
      {parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          material={part.material}
          matrix={part.matrix}
          matrixAutoUpdate={false}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
