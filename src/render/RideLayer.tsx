"use client";

/**
 * Animated flat rides — composed from primitives in the kit palette plus
 * kit prop models (pirate ship, toy cars). Each ride reads its sim state
 * every frame: spin-up while running, ease-out when idle.
 * A handful of rides exist per park, so plain meshes are fine here
 * (instancing arrives with Phase 4 hardening if profiles ever ask).
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";
import { getPlaceableDef } from "@/content/catalog";
import type { RideKind } from "@/content/types";
import { rotatedFootprint } from "@/sim/validate";
import { useGameStore } from "@/ui/stores/gameStore";
import { damp } from "@/shared/mathx";
import { useModelParts } from "./useModelParts";

interface PlacedRide {
  id: number;
  kind: RideKind;
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
}

/** Smoothed per-ride motion: 0 stopped … 1 full speed. */
function useRideMotion(entityId: number): { speed: React.MutableRefObject<number> } {
  const speed = useRef(0);
  useFrame((_, dt) => {
    const sim = useGameStore.getState().sim;
    const ride = sim?.world.rides.get(entityId);
    const target = ride && ride.phase === "running" ? 1 : 0;
    speed.current = damp(speed.current, target, 1.6, Math.min(dt, 0.05));
  });
  return { speed };
}

export function RideLayer() {
  const worldVersion = useGameStore((s) => s.worldVersion);

  const rides = useMemo((): PlacedRide[] => {
    const sim = useGameStore.getState().sim;
    if (!sim) return [];
    const list: PlacedRide[] = [];
    for (const entity of sim.world.placeables.values()) {
      const def = getPlaceableDef(entity.defId);
      if (!def.ride) continue;
      const [w, d] = rotatedFootprint(def, entity.rot);
      list.push({ id: entity.id, kind: def.ride.kind, x: entity.x, z: entity.z, rot: entity.rot, w, d });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion tracks external world edits
  }, [worldVersion]);

  return (
    <>
      {rides.map((r) => (
        <group
          key={r.id}
          position={[r.x + r.w / 2, 0, r.z + r.d / 2]}
          rotation={[0, (-r.rot * Math.PI) / 2, 0]}
        >
          {r.kind === "carousel" && <Carousel id={r.id} />}
          {r.kind === "ferris" && <FerrisWheel id={r.id} />}
          {r.kind === "teacups" && <Teacups id={r.id} />}
          {r.kind === "drop" && <DropTower id={r.id} />}
          {r.kind === "bumper" && <BumperCars id={r.id} />}
          {r.kind === "swing" && <SwingShip id={r.id} />}
        </group>
      ))}
    </>
  );
}

// ── Carousel ─────────────────────────────────────────────────────────────

function Carousel({ id }: { id: number }) {
  const { speed } = useRideMotion(id);
  const spinner = useRef<Group>(null);
  useFrame((_, dt) => {
    if (spinner.current) spinner.current.rotation.y += speed.current * dt * 1.4;
  });
  const seats = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.45, 1.5, 0.18, 20]} />
        <meshStandardMaterial color="#d8def0" />
      </mesh>
      <group ref={spinner}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.4, 8]} />
          <meshStandardMaterial color="#8a5a2b" />
        </mesh>
        {seats.map((a, i) => (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[1.0, 0.85, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
              <meshStandardMaterial color="#f4f6fb" />
            </mesh>
            <mesh position={[1.0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.22, 0.22, 0.42]} />
              <meshStandardMaterial color={i % 2 ? "#d6337a" : "#2e5ae8"} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh position={[0, 1.62, 0]} castShadow>
        <coneGeometry args={[1.6, 0.66, 12]} />
        <meshStandardMaterial color="#ffb300" />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#e5484d" />
      </mesh>
    </group>
  );
}

// ── Ferris Wheel ─────────────────────────────────────────────────────────

function FerrisWheel({ id }: { id: number }) {
  const { speed } = useRideMotion(id);
  const wheel = useRef<Group>(null);
  const gondolas = useRef<(Group | null)[]>([]);
  useFrame((_, dt) => {
    if (!wheel.current) return;
    wheel.current.rotation.z += speed.current * dt * 0.55;
    // Keep gondolas upright.
    for (const gondola of gondolas.current) {
      if (gondola) gondola.rotation.z = -wheel.current.rotation.z;
    }
  });
  const arms = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  const R = 1.15;
  return (
    <group position={[0, 0, 0]}>
      {/* A-frame supports */}
      {[-0.5, 0.5].map((zOff) => (
        <group key={zOff} position={[0, 0, zOff]}>
          <mesh position={[-0.45, 0.8, 0]} rotation={[0, 0, 0.5]} castShadow>
            <boxGeometry args={[0.12, 1.9, 0.12]} />
            <meshStandardMaterial color="#2c3a52" />
          </mesh>
          <mesh position={[0.45, 0.8, 0]} rotation={[0, 0, -0.5]} castShadow>
            <boxGeometry args={[0.12, 1.9, 0.12]} />
            <meshStandardMaterial color="#2c3a52" />
          </mesh>
        </group>
      ))}
      <group ref={wheel} position={[0, 1.62, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[R, 0.05, 8, 28]} />
          <meshStandardMaterial color="#2e5ae8" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 1.16, 10]} />
          <meshStandardMaterial color="#f4f6fb" />
        </mesh>
        {arms.map((a, i) => (
          <group key={i} rotation={[0, 0, a]}>
            <mesh position={[R / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.028, 0.028, R, 6]} />
              <meshStandardMaterial color="#aeb6dd" />
            </mesh>
            <group
              position={[R, 0, 0]}
              ref={(el) => {
                gondolas.current[i] = el;
              }}
            >
              <mesh position={[0, -0.16, 0]} castShadow>
                <boxGeometry args={[0.3, 0.26, 0.34]} />
                <meshStandardMaterial color={["#e5484d", "#ffb300", "#2fa84f", "#00a8a8"][i % 4]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

// ── Teacups ──────────────────────────────────────────────────────────────

function Teacups({ id }: { id: number }) {
  const { speed } = useRideMotion(id);
  const platter = useRef<Group>(null);
  const cups = useRef<(Group | null)[]>([]);
  useFrame((_, dt) => {
    if (!platter.current) return;
    platter.current.rotation.y += speed.current * dt * 0.9;
    for (const cup of cups.current) {
      if (cup) cup.rotation.y += speed.current * dt * 3.4;
    }
  });
  const spots = useMemo(() => Array.from({ length: 4 }, (_, i) => (i / 4) * Math.PI * 2), []);
  const colors = ["#d6337a", "#2e5ae8", "#2fa84f", "#ffb300"];
  return (
    <group>
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.42, 1.48, 0.14, 20]} />
        <meshStandardMaterial color="#7b4fd0" />
      </mesh>
      <group ref={platter} position={[0, 0.14, 0]}>
        {spots.map((a, i) => (
          <group
            key={i}
            position={[Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85]}
            ref={(el) => {
              cups.current[i] = el;
            }}
          >
            <mesh position={[0, 0.24, 0]} castShadow>
              <cylinderGeometry args={[0.34, 0.24, 0.42, 12]} />
              <meshStandardMaterial color={colors[i % 4]} />
            </mesh>
            <mesh position={[0.36, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.11, 0.035, 6, 12]} />
              <meshStandardMaterial color={colors[i % 4]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ── Drop Tower ───────────────────────────────────────────────────────────

function DropTower({ id }: { id: number }) {
  const { speed } = useRideMotion(id);
  const carriage = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!carriage.current) return;
    if (speed.current > 0.05) t.current = (t.current + dt / 4.5) % 1;
    else t.current = damp(t.current, 0, 3, Math.min(dt, 0.05));
    // Climb slowly (0→0.62), hold (→0.7), plummet with a double bounce.
    const p = t.current;
    let y: number;
    if (p < 0.62) y = (p / 0.62) * 2.6;
    else if (p < 0.7) y = 2.6;
    else {
      const f = (p - 0.7) / 0.3;
      y = 2.6 * Math.abs(Math.cos(f * Math.PI * 1.5)) * (1 - f);
    }
    carriage.current.position.y = 0.35 + y;
  });
  return (
    <group>
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[0.34, 3.6, 0.34]} />
        <meshStandardMaterial color="#2c3a52" />
      </mesh>
      <mesh position={[0, 3.66, 0]} castShadow>
        <boxGeometry args={[0.5, 0.22, 0.5]} />
        <meshStandardMaterial color="#ffb300" />
      </mesh>
      <group ref={carriage} position={[0, 0.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.34, 1.05]} />
          <meshStandardMaterial color="#e5484d" />
        </mesh>
        {[-0.42, 0.42].map((o) => (
          <mesh key={o} position={[o, 0.28, 0]} castShadow>
            <boxGeometry args={[0.2, 0.22, 1.0]} />
            <meshStandardMaterial color="#f4f6fb" />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.95, 1.0, 0.16, 16]} />
        <meshStandardMaterial color="#d8def0" />
      </mesh>
    </group>
  );
}

// ── Bumper Cars ──────────────────────────────────────────────────────────

const CAR_MODELS = ["rides/bumper-car-a", "rides/bumper-car-b", "rides/bumper-car-c"] as const;

function BumperCars({ id }: { id: number }) {
  const { speed } = useRideMotion(id);
  const cars = useRef<(Group | null)[]>([]);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += speed.current * dt;
    for (let i = 0; i < cars.current.length; i++) {
      const car = cars.current[i];
      if (!car) continue;
      const phase = t.current * (0.6 + i * 0.17) + i * 2.4;
      const x = Math.sin(phase) * 1.15 + Math.sin(phase * 2.3) * 0.35;
      const z = Math.cos(phase * 0.8) * 0.72;
      car.position.set(x, 0.12, z);
      car.rotation.y = Math.atan2(Math.cos(phase), -Math.sin(phase * 0.8) * 0.6);
    }
  });
  return (
    <group>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[3.7, 0.1, 2.7]} />
        <meshStandardMaterial color="#3a4a68" />
      </mesh>
      {/* Walls */}
      {[
        [0, -1.32, 3.7, 0.14] as const,
        [0, 1.32, 3.7, 0.14] as const,
      ].map(([cx, cz, wx, wz], i) => (
        <mesh key={`h${i}`} position={[cx, 0.24, cz]} castShadow>
          <boxGeometry args={[wx, 0.3, wz]} />
          <meshStandardMaterial color="#f2742c" />
        </mesh>
      ))}
      {[-1.82, 1.82].map((cx, i) => (
        <mesh key={`v${i}`} position={[cx, 0.24, 0]} castShadow>
          <boxGeometry args={[0.14, 0.3, 2.7]} />
          <meshStandardMaterial color="#f2742c" />
        </mesh>
      ))}
      {/* Canopy poles + roof */}
      {[
        [-1.7, -1.2] as const,
        [1.7, -1.2] as const,
        [-1.7, 1.2] as const,
        [1.7, 1.2] as const,
      ].map(([px, pz], i) => (
        <mesh key={`p${i}`} position={[px, 0.9, pz]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 1.5, 6]} />
          <meshStandardMaterial color="#2c3a52" />
        </mesh>
      ))}
      <mesh position={[0, 1.72, 0]} castShadow>
        <boxGeometry args={[3.9, 0.09, 2.9]} />
        <meshStandardMaterial color="#00a8a8" />
      </mesh>
      {CAR_MODELS.map((model, i) => (
        <group
          key={model}
          ref={(el) => {
            cars.current[i] = el;
          }}
        >
          <KitModel model={model} />
        </group>
      ))}
    </group>
  );
}

// ── Swing Ship ───────────────────────────────────────────────────────────

function SwingShip({ id }: { id: number }) {
  const { speed } = useRideMotion(id);
  const arm = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (arm.current) {
      const amp = speed.current * 0.85;
      arm.current.rotation.x = Math.sin(t.current * 1.7) * amp;
    }
  });
  return (
    <group>
      {/* A-frames along x, swing along z */}
      {[-1.35, 1.35].map((xOff) => (
        <group key={xOff} position={[xOff, 0, 0]}>
          <mesh position={[0, 1.05, -0.55]} rotation={[-0.48, 0, 0]} castShadow>
            <boxGeometry args={[0.14, 2.35, 0.14]} />
            <meshStandardMaterial color="#8a5a2b" />
          </mesh>
          <mesh position={[0, 1.05, 0.55]} rotation={[0.48, 0, 0]} castShadow>
            <boxGeometry args={[0.14, 2.35, 0.14]} />
            <meshStandardMaterial color="#8a5a2b" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.06, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.9, 8]} />
        <meshStandardMaterial color="#2c3a52" />
      </mesh>
      <group ref={arm} position={[0, 2.06, 0]}>
        {[-1.0, 1.0].map((xOff) => (
          <mesh key={xOff} position={[xOff, -0.85, 0]} castShadow>
            <boxGeometry args={[0.08, 1.7, 0.08]} />
            <meshStandardMaterial color="#aeb6dd" />
          </mesh>
        ))}
        <group position={[0, -1.7, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.62}>
          <KitModel model="rides/pirate-ship" />
        </group>
      </group>
    </group>
  );
}

/** Renders a manifest model's parts as plain meshes (small counts only). */
function KitModel({ model }: { model: (typeof CAR_MODELS)[number] | "rides/pirate-ship" }) {
  const parts = useModelParts(model);
  return (
    <>
      {parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          material={part.material}
          matrix={part.matrix}
          matrixAutoUpdate={false}
          castShadow
        />
      ))}
    </>
  );
}
