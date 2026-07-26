"use client";

/**
 * Staff on the clock: janitors, mechanics, entertainers as instanced blocky
 * characters (distinct model per role), same walk rig as CrowdLayer.
 * Working staff (workT > 0) do an eager little job-wiggle.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { InstancedMesh, Matrix4 } from "three";
import { MAX_STAFF, type StaffRole } from "@/sim/balance/phase3";
import { useGameStore } from "@/ui/stores/gameStore";
import type { ModelAssetId } from "@/content/asset-manifest";
import { useModelParts, type ModelPart } from "./useModelParts";
import { renderClock } from "./stats";

const ROLE_MODELS: Record<StaffRole, ModelAssetId> = {
  janitor: "staff/janitor",
  mechanic: "staff/mechanic",
  entertainer: "staff/entertainer",
};

const walkPhase = new Float32Array(MAX_STAFF + 1);

const baseMatrix = new Matrix4();
const swing = new Matrix4();
const composed = new Matrix4();

type PartRole = "leg-left" | "leg-right" | "arm-left" | "arm-right" | "other";

const roleOf = (name: string): PartRole => {
  if (name.includes("leg-left")) return "leg-left";
  if (name.includes("leg-right")) return "leg-right";
  if (name.includes("arm-left")) return "arm-left";
  if (name.includes("arm-right")) return "arm-right";
  return "other";
};

export function StaffLayer() {
  return (
    <>
      {(Object.keys(ROLE_MODELS) as StaffRole[]).map((role) => (
        <RoleInstances key={role} role={role} />
      ))}
    </>
  );
}

function RoleInstances({ role }: { role: StaffRole }) {
  const parts = useModelParts(ROLE_MODELS[role]);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const partRoles = useMemo(() => parts.map((p) => roleOf(p.name)), [parts]);

  useFrame((state, dt) => {
    const sim = useGameStore.getState().sim;
    if (!sim) return;
    const alpha = renderClock.alpha;
    let visible = 0;

    for (let i = 0; i < sim.world.staff.length && visible < MAX_STAFF; i++) {
      const staff = sim.world.staff[i];
      if (!staff || staff.role !== role) continue;
      const x = staff.px + (staff.x - staff.px) * alpha;
      const z = staff.pz + (staff.z - staff.pz) * alpha;
      const moving = Math.abs(staff.x - staff.px) + Math.abs(staff.z - staff.pz) > 0.004;
      const slot = i % walkPhase.length;
      if (moving) walkPhase[slot] = ((walkPhase[slot] as number) + dt * 9) % (Math.PI * 2);
      const phase = walkPhase[slot] as number;
      const working = staff.workT > 0;
      const bob = moving ? Math.abs(Math.sin(phase)) * 0.045 : 0;
      const workLean = working ? Math.sin(state.clock.elapsedTime * 9 + i) * 0.09 : 0;

      baseMatrix.makeRotationY(staff.heading);
      if (workLean !== 0) {
        swing.makeRotationZ(workLean);
        baseMatrix.multiply(swing);
      }
      baseMatrix.setPosition(x, bob, z);

      for (let p = 0; p < parts.length; p++) {
        const mesh = meshRefs.current[p];
        const part = parts[p] as ModelPart;
        if (!mesh) continue;
        const partRole = partRoles[p] as PartRole;
        let amp = 0;
        if (moving) {
          if (partRole === "leg-left") amp = Math.sin(phase) * 0.55;
          else if (partRole === "leg-right") amp = -Math.sin(phase) * 0.55;
          else if (partRole === "arm-left") amp = -Math.sin(phase) * 0.4;
          else if (partRole === "arm-right") amp = Math.sin(phase) * 0.4;
        } else if (working) {
          // Scrub scrub scrub.
          if (partRole === "arm-left" || partRole === "arm-right") {
            amp = Math.sin(state.clock.elapsedTime * 11 + i) * 0.6 - 0.5;
          }
        }
        composed.copy(baseMatrix).multiply(part.matrix);
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
          args={[part.geometry, part.material, MAX_STAFF]}
          castShadow
          frustumCulled={false}
        />
      ))}
    </>
  );
}
