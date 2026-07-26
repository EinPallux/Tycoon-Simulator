"use client";

/**
 * Weather + breakdown effects: a rain particle field that follows the
 * camera target, and comedy smoke puffs over broken rides
 * (GAME_DESIGN.md §3 weather, §8 breakdowns — nobody is ever harmed).
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Points,
  PointsMaterial,
} from "three";
import { getPlaceableDef } from "@/content/catalog";
import { rotatedFootprint } from "@/sim/validate";
import { damp } from "@/shared/mathx";
import { useGameStore } from "@/ui/stores/gameStore";

// ── Rain ─────────────────────────────────────────────────────────────────

const DROPS = 700;
const RAIN_BOX = 46; // xz extent around the camera target
const RAIN_TOP = 24;

export function RainLayer() {
  const ref = useRef<Points>(null);
  const intensity = useRef(0);

  const { geometry, material, speeds } = useMemo(() => {
    const positions = new Float32Array(DROPS * 3);
    const speeds = new Float32Array(DROPS);
    // Deterministic scatter (render-only; the sim rng is untouched).
    let s = 1234567;
    const rand = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    for (let i = 0; i < DROPS; i++) {
      positions[i * 3] = (rand() - 0.5) * RAIN_BOX;
      positions[i * 3 + 1] = rand() * RAIN_TOP;
      positions[i * 3 + 2] = (rand() - 0.5) * RAIN_BOX;
      speeds[i] = 13 + rand() * 8;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: "#a8c4e8",
      size: 0.09,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return { geometry, material, speeds };
  }, []);

  useFrame((_, dt) => {
    const sim = useGameStore.getState().sim;
    const points = ref.current;
    if (!sim || !points) return;
    const kind = sim.world.weather.current;
    const target = kind === "storm" ? 1 : kind === "rain" ? 0.6 : 0;
    intensity.current = damp(intensity.current, target, 2.2, Math.min(dt, 0.05));
    material.opacity = intensity.current * 0.75;
    points.visible = intensity.current > 0.02;
    if (!points.visible) return;

    points.position.set(sim.world.camera.targetX, 0, sim.world.camera.targetZ);
    const positions = geometry.getAttribute("position") as BufferAttribute;
    const arr = positions.array as Float32Array;
    const fall = dt * (kind === "storm" ? 1.4 : 1);
    for (let i = 0; i < DROPS; i++) {
      let y = (arr[i * 3 + 1] as number) - (speeds[i] as number) * fall;
      if (y < 0) y += RAIN_TOP;
      arr[i * 3 + 1] = y;
    }
    positions.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

// ── Breakdown smoke ──────────────────────────────────────────────────────

const MAX_PUFFS = 48;
const PUFFS_PER_RIDE = 3;
const puffMatrix = new Matrix4();

export function BreakdownSmokeLayer() {
  const ref = useRef<InstancedMesh>(null);

  useFrame(({ clock }) => {
    const sim = useGameStore.getState().sim;
    const mesh = ref.current;
    if (!sim || !mesh) return;
    let count = 0;
    for (const [entityId, ride] of sim.world.rides) {
      if (ride.phase !== "broken" || count + PUFFS_PER_RIDE > MAX_PUFFS) continue;
      const entity = sim.world.placeables.get(entityId);
      if (!entity) continue;
      const def = getPlaceableDef(entity.defId);
      const [w, d] = rotatedFootprint(def, entity.rot);
      const cx = entity.x + w / 2;
      const cz = entity.z + d / 2;
      for (let j = 0; j < PUFFS_PER_RIDE; j++) {
        const t = (clock.elapsedTime * 0.45 + j / PUFFS_PER_RIDE + entityId * 0.37) % 1;
        const wob = Math.sin((t * 3 + j) * Math.PI * 2 + entityId) * 0.22;
        const scale = (0.18 + t * 0.5) * (1 - t * 0.35);
        puffMatrix.makeScale(scale, scale, scale);
        puffMatrix.setPosition(cx + wob, 1.5 + t * 2.1, cz + wob * 0.6);
        mesh.setMatrixAt(count++, puffMatrix);
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PUFFS]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#c8ccd6" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}
