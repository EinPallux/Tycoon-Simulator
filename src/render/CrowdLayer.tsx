"use client";

/**
 * The crowd: up to 500 guests as instanced blocky characters with a
 * procedural walk cycle (leg/arm swing about their rig pivots + body bob).
 * Positions interpolate between sim ticks via renderClock.alpha.
 * Riding guests are hidden ("inside" the ride). Click a guest to inspect.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { InstancedMesh, Matrix4 } from "three";
import { MAX_GUESTS } from "@/sim/balance/guests";
import { GUEST_STATE } from "@/sim/entities/guests";
import { useGameStore } from "@/ui/stores/gameStore";
import type { ModelAssetId } from "@/content/asset-manifest";
import { useModelParts, type ModelPart } from "./useModelParts";
import { renderClock } from "./stats";

const CHARACTER_MODELS: ModelAssetId[] = [
  "guests/char-a",
  "guests/char-b",
  "guests/char-c",
  "guests/char-d",
];

/** Per-slot walk phase (render-only state, advances while moving). */
const walkPhase = new Float32Array(MAX_GUESTS);

const guestMatrix = new Matrix4();
const swing = new Matrix4();
const composed = new Matrix4();

type PartRole = "leg-left" | "leg-right" | "arm-left" | "arm-right" | "torso" | "head" | "other";

const roleOf = (name: string): PartRole => {
  if (name.includes("leg-left")) return "leg-left";
  if (name.includes("leg-right")) return "leg-right";
  if (name.includes("arm-left")) return "arm-left";
  if (name.includes("arm-right")) return "arm-right";
  if (name.includes("head")) return "head";
  if (name.includes("torso") || name.includes("body")) return "torso";
  return "other";
};

export function CrowdLayer() {
  return (
    <>
      {CHARACTER_MODELS.map((model, idx) => (
        <CharacterInstances key={model} model={model} modelIdx={idx} />
      ))}
    </>
  );
}

const PER_MODEL_CAPACITY = 160;

function CharacterInstances({ model, modelIdx }: { model: ModelAssetId; modelIdx: number }) {
  const parts = useModelParts(model);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const roles = useMemo(() => parts.map((p) => roleOf(p.name)), [parts]);
  const selectGuest = useGameStore((s) => s.selectGuest);

  useFrame((_, dt) => {
    const sim = useGameStore.getState().sim;
    if (!sim) return;
    const g = sim.world.guests;
    const alpha = renderClock.alpha;

    let visible = 0;
    // First pass: which slots belong to this model & are visible?
    for (let slot = 0; slot < g.count && visible < PER_MODEL_CAPACITY; slot++) {
      const cold = g.cold.get(g.ids[slot] as number);
      if (!cold || cold.modelIdx !== modelIdx) continue;
      if (g.state[slot] === GUEST_STATE.riding) continue;

      const x = (g.px[slot] as number) + ((g.x[slot] as number) - (g.px[slot] as number)) * alpha;
      const z = (g.pz[slot] as number) + ((g.z[slot] as number) - (g.pz[slot] as number)) * alpha;
      const moving =
        Math.abs((g.x[slot] as number) - (g.px[slot] as number)) +
          Math.abs((g.z[slot] as number) - (g.pz[slot] as number)) >
        0.004;
      if (moving) walkPhase[slot] = ((walkPhase[slot] as number) + dt * 9) % (Math.PI * 2);
      const phase = walkPhase[slot] as number;
      const bob = moving ? Math.abs(Math.sin(phase)) * 0.045 : 0;

      guestMatrix.makeRotationY(g.heading[slot] as number);
      guestMatrix.setPosition(x, bob, z);

      for (let p = 0; p < parts.length; p++) {
        const mesh = meshRefs.current[p];
        const part = parts[p] as ModelPart;
        if (!mesh) continue;
        const role = roles[p] as PartRole;
        let amp = 0;
        if (moving) {
          if (role === "leg-left") amp = Math.sin(phase) * 0.55;
          else if (role === "leg-right") amp = -Math.sin(phase) * 0.55;
          else if (role === "arm-left") amp = -Math.sin(phase) * 0.4;
          else if (role === "arm-right") amp = Math.sin(phase) * 0.4;
        }
        composed.copy(guestMatrix).multiply(part.matrix);
        if (amp !== 0) {
          swing.makeRotationX(amp);
          composed.multiply(swing);
        }
        mesh.setMatrixAt(visible, composed);
      }
      visible++;
    }

    for (let p = 0; p < parts.length; p++) {
      const mesh = meshRefs.current[p];
      if (!mesh) continue;
      mesh.count = visible;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {parts.map((part, p) => (
        <instancedMesh
          key={p}
          ref={(m) => {
            meshRefs.current[p] = m;
          }}
          args={[part.geometry, part.material, PER_MODEL_CAPACITY]}
          castShadow
          frustumCulled={false}
          onClick={(e) => {
            if (e.instanceId === undefined) return;
            const sim = useGameStore.getState().sim;
            if (!sim || useGameStore.getState().tool.kind !== "select") return;
            e.stopPropagation();
            // Recover the guest id: instanceId = visible index in draw order.
            const g = sim.world.guests;
            let visible = 0;
            for (let slot = 0; slot < g.count; slot++) {
              const cold = g.cold.get(g.ids[slot] as number);
              if (!cold || cold.modelIdx !== modelIdx) continue;
              if (g.state[slot] === GUEST_STATE.riding) continue;
              if (visible === e.instanceId) {
                selectGuest(g.ids[slot] as number);
                return;
              }
              visible++;
            }
          }}
        />
      ))}
    </>
  );
}
