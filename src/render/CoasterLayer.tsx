"use client";

/**
 * Coaster tracks, stations, supports, animated trains and the builder's
 * draft ghost (GAME_DESIGN.md §4.6, TECHNICAL_ARCHITECTURE.md §8).
 *
 * Kenney CoasterKit authoring conventions (verified against GLB bounds):
 *  - pieces are authored entering at the origin heading +z (= sim dir 2);
 *  - "-track" single-tile pieces are CENTERED on their tile, deck y 0…0.1;
 *  - corners / hills / loops anchor at the entry edge, deck 1 unit BELOW
 *    the origin (y −1…0), so they place at y = h + 1;
 *  - the one corner model is a RIGHT turn — a left corner is the same model
 *    anchored at its exit, facing backward (chirality needs no mirroring);
 *  - slope-down is slope-up anchored at the exit, facing backward.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, Matrix4, MeshBasicMaterial, Vector3 } from "three";
import type { ModelAssetId } from "@/content/asset-manifest";
import type { Coaster, CoasterFamily } from "@/sim/coaster/coaster";
import {
  exitOf,
  FWD,
  nodesEqual,
  PIECES,
  pointOnPiece,
  reverse,
  type Heading,
  type PlacedPiece,
} from "@/sim/coaster/pieces";
import { useGameStore, draftHead } from "@/ui/stores/gameStore";
import { useModelParts } from "./useModelParts";
import { renderClock } from "./stats";

/** Yaw that maps the authored +z forward onto sim heading `d`. */
const yawOf = (d: Heading): number => Math.PI - (d * Math.PI) / 2;

interface ModelPlacement {
  assetId: ModelAssetId;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

const familyModel = (family: CoasterFamily, part: string): ModelAssetId =>
  `coaster/${family}-${part}` as ModelAssetId;

/** Model placements for one piece chain (committed coaster or draft). */
export function trackPlacements(family: CoasterFamily, pieces: PlacedPiece[]): ModelPlacement[] {
  const out: ModelPlacement[] = [];
  for (const piece of pieces) {
    const e = piece.entry;
    const [fx, fz] = FWD[e.dir] as readonly [number, number];
    switch (piece.type) {
      case "station": {
        for (let k = 0; k < 2; k++) {
          const x = e.x + fx * (k + 0.5);
          const z = e.z + fz * (k + 0.5);
          out.push({ assetId: familyModel(family, "track"), x, y: e.h, z, yaw: yawOf(e.dir) });
          out.push({
            assetId: k === 0 ? "coaster/station-gate" : "coaster/station",
            x,
            y: e.h,
            z,
            yaw: yawOf(e.dir),
          });
        }
        break;
      }
      case "straight":
        out.push({
          assetId: familyModel(family, "track"),
          x: e.x + fx * 0.5,
          y: e.h,
          z: e.z + fz * 0.5,
          yaw: yawOf(e.dir),
        });
        break;
      case "corner-right":
        out.push({ assetId: familyModel(family, "corner"), x: e.x, y: e.h + 1, z: e.z, yaw: yawOf(e.dir) });
        break;
      case "corner-left": {
        const x = exitOf(e, "corner-left");
        out.push({
          assetId: familyModel(family, "corner"),
          x: x.x,
          y: x.h + 1,
          z: x.z,
          yaw: yawOf(reverse(x.dir)),
        });
        break;
      }
      case "slope-up":
        out.push({ assetId: familyModel(family, "slope"), x: e.x, y: e.h + 1, z: e.z, yaw: yawOf(e.dir) });
        break;
      case "slope-down": {
        const x = exitOf(e, "slope-down");
        out.push({
          assetId: familyModel(family, "slope"),
          x: x.x,
          y: x.h + 1,
          z: x.z,
          yaw: yawOf(reverse(x.dir)),
        });
        break;
      }
      case "loop":
        out.push({
          assetId: familyModel(family, "loop"),
          x: e.x + fx * 2,
          y: e.h + 1,
          z: e.z + fz * 2,
          yaw: yawOf(e.dir),
        });
        break;
    }
  }
  return out;
}

/** Support columns: one stack under every elevated piece entry. */
export function supportPlacements(pieces: PlacedPiece[]): ModelPlacement[] {
  const out: ModelPlacement[] = [];
  for (const piece of pieces) {
    const e = piece.entry;
    for (let k = 0; k < e.h; k++) {
      out.push({ assetId: "coaster/support", x: e.x, y: k, z: e.z, yaw: 0 });
    }
  }
  return out;
}

// ── The layer ────────────────────────────────────────────────────────────

export function CoasterLayer() {
  const worldVersion = useGameStore((s) => s.worldVersion);

  const derived = useMemo(() => {
    const sim = useGameStore.getState().sim;
    const byModel = new Map<ModelAssetId, ModelPlacement[]>();
    const coasters: Coaster[] = [];
    if (!sim) return { byModel, coasters };
    for (const coaster of sim.world.coasters.values()) {
      coasters.push(coaster);
      const placements = [
        ...trackPlacements(coaster.family, coaster.pieces),
        ...supportPlacements(coaster.pieces),
      ];
      for (const p of placements) {
        const list = byModel.get(p.assetId) ?? [];
        list.push(p);
        byModel.set(p.assetId, list);
      }
    }
    return { byModel, coasters };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion tracks external world edits
  }, [worldVersion]);

  return (
    <>
      {[...derived.byModel.entries()].map(([assetId, placements]) => (
        <TrackModelInstances key={assetId} assetId={assetId} placements={placements} />
      ))}
      {derived.coasters.map((coaster) => (
        <CoasterTrain key={coaster.entityId} coaster={coaster} />
      ))}
      <DraftGhost />
    </>
  );
}

// ── Instanced track models ───────────────────────────────────────────────

const compose = new Matrix4();
const scratch = new Matrix4();

function TrackModelInstances({
  assetId,
  placements,
}: {
  assetId: ModelAssetId;
  placements: ModelPlacement[];
}) {
  const parts = useModelParts(assetId);
  const capacity = Math.max(16, 1 << Math.ceil(Math.log2(placements.length || 1)));
  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh
          key={`${i}-${capacity}`}
          args={[part.geometry, part.material, capacity]}
          castShadow
          receiveShadow
          frustumCulled={false}
          ref={(mesh) => {
            if (!mesh) return;
            for (let j = 0; j < placements.length; j++) {
              const p = placements[j] as ModelPlacement;
              compose.makeRotationY(p.yaw);
              compose.multiply(scratch.copy(part.matrix));
              compose.elements[12] = (compose.elements[12] ?? 0) + p.x;
              compose.elements[13] = (compose.elements[13] ?? 0) + p.y;
              compose.elements[14] = (compose.elements[14] ?? 0) + p.z;
              mesh.setMatrixAt(j, compose);
            }
            mesh.count = placements.length;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
          }}
        />
      ))}
    </>
  );
}

// ── Trains ───────────────────────────────────────────────────────────────

const CAR_SPACING = 1.05; // arc units between car centers
const PARKED_ARC = 1.6; // head car's arc position within the station when parked

const carPos = new Vector3();
const carFwd = new Vector3();
const carUp = new Vector3();
const carRight = new Vector3();

/** Piece index + local param for an elapsed time along the circuit. */
function locate(coaster: Coaster, tSec: number): { index: number; piece: PlacedPiece; t: number } {
  const times = coaster.pieceTimes;
  let i = times.length - 1;
  for (let k = 1; k < times.length; k++) {
    if ((times[k] as number) > tSec) {
      i = k - 1;
      break;
    }
  }
  const start = times[i] as number;
  const end = i + 1 < times.length ? (times[i + 1] as number) : coaster.totalTime;
  const t = Math.min(1, Math.max(0, (end - start) > 0 ? (tSec - start) / (end - start) : 0));
  return { index: i, piece: coaster.pieces[i] as PlacedPiece, t };
}

/** Arc length from the circuit start to time tSec (cars space by ARC, not time). */
function arcAtTime(coaster: Coaster, tSec: number): { arc: number; total: number } {
  const { index, t } = locate(coaster, tSec);
  let arc = 0;
  let total = 0;
  for (let i = 0; i < coaster.pieces.length; i++) {
    const len = PIECES[(coaster.pieces[i] as PlacedPiece).type].length;
    if (i < index) arc += len;
    else if (i === index) arc += len * t;
    total += len;
  }
  return { arc, total };
}

/** Piece + param at an arc distance along the circuit. */
function locateByArc(coaster: Coaster, arc: number): { piece: PlacedPiece; t: number } {
  let acc = 0;
  for (const piece of coaster.pieces) {
    const len = PIECES[piece.type].length;
    if (arc <= acc + len) {
      return { piece, t: Math.min(1, Math.max(0, (arc - acc) / len)) };
    }
    acc += len;
  }
  const last = coaster.pieces[coaster.pieces.length - 1] as PlacedPiece;
  return { piece: last, t: 1 };
}

function carMatrix(coaster: Coaster, arc: number, out: Matrix4): void {
  const { piece, t } = locateByArc(coaster, arc);
  const p = pointOnPiece(piece, t);
  carPos.set(p.x, p.y, p.z);
  // Car noses are authored toward −z, so the local z-axis is −forward.
  carFwd.set(-p.tx, -p.ty, -p.tz).normalize();
  if (piece.type === "loop") {
    // Analytic loop up-vector (radially inward) — (0,1,0) degenerates at the sides.
    const angle = t * Math.PI * 2;
    const [fx, fz] = FWD[piece.entry.dir] as readonly [number, number];
    carUp.set(-fx * Math.sin(angle), Math.cos(angle), -fz * Math.sin(angle));
  } else {
    carUp.set(0, 1, 0);
  }
  carRight.crossVectors(carUp, carFwd).normalize();
  carUp.crossVectors(carFwd, carRight).normalize();
  out.makeBasis(carRight, carUp, carFwd);
  out.setPosition(carPos);
}

function CoasterTrain({ coaster }: { coaster: Coaster }) {
  const cars: ModelAssetId[] =
    coaster.family === "flume"
      ? ["coaster/train-log", "coaster/train-log"]
      : ["coaster/train-front", "coaster/train-car"];
  const refs = useRef<(Group | null)[]>([]);

  useFrame(() => {
    const sim = useGameStore.getState().sim;
    if (!sim) return;
    const ride = sim.world.rides.get(coaster.entityId);
    const live = sim.world.coasters.get(coaster.entityId) ?? coaster;
    if (live.totalTime <= 0) return;

    const chain = 1.4; // station chain speed (units/s)
    const offTime = Math.min(PARKED_ARC / chain, live.totalTime * 0.25);
    let tSec = offTime; // parked at the platform by default
    if (ride && ride.phase === "running") {
      const cycleSec = Math.max(8, live.totalTime);
      const elapsed = Math.max(0, cycleSec - (ride.phaseT - renderClock.alpha) / 10);
      tSec = elapsed < live.totalTime ? (elapsed + offTime) % live.totalTime : offTime;
    }
    const { arc: headArc, total: totalArc } = arcAtTime(live, tSec);
    for (let k = 0; k < refs.current.length; k++) {
      const group = refs.current[k];
      if (!group) continue;
      let arc = headArc - k * CAR_SPACING;
      if (arc < 0) arc += totalArc;
      carMatrix(live, arc, group.matrix);
      group.matrixWorldNeedsUpdate = true;
    }
  });

  return (
    <>
      {cars.map((assetId, k) => (
        <group
          key={k}
          matrixAutoUpdate={false}
          ref={(el) => {
            refs.current[k] = el;
          }}
        >
          <TrainCarModel assetId={assetId} />
        </group>
      ))}
    </>
  );
}

function TrainCarModel({ assetId }: { assetId: ModelAssetId }) {
  const parts = useModelParts(assetId);
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

// ── Draft ghost ──────────────────────────────────────────────────────────

function DraftGhost() {
  const draftVersion = useGameStore((s) => s.draftVersion);
  const draft = useGameStore((s) => s.coasterDraft);

  const ghost = useMemo(() => {
    if (!draft) return null;
    const head = draftHead(draft);
    const start = (draft.pieces[0] as PlacedPiece).entry;
    return {
      placements: [...trackPlacements(draft.family, draft.pieces), ...supportPlacements(draft.pieces)],
      head,
      start,
      closed: nodesEqual(head, start),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftVersion tracks draft edits
  }, [draftVersion, draft]);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#4FC3F7",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );
  const pulse = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (pulse.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.12;
      pulse.current.scale.set(s, 1, s);
    }
  });

  if (!ghost) return null;
  const [hfx, hfz] = FWD[ghost.head.dir] as readonly [number, number];
  return (
    <group>
      {ghost.placements.map((p, i) => (
        <GhostPlacement key={i} placement={p} material={material} />
      ))}
      {/* Build head: a pulsing arrow showing where the next piece goes. */}
      {!ghost.closed && (
        <group ref={pulse} position={[ghost.head.x, ghost.head.h + 0.3, ghost.head.z]}>
          <mesh
            position={[hfx * 0.35, 0, hfz * 0.35]}
            rotation={[Math.PI / 2, 0, -Math.atan2(hfx, hfz)]}
          >
            <coneGeometry args={[0.22, 0.55, 4]} />
            <meshBasicMaterial color="#FFB300" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </group>
      )}
      {/* Home beacon at the station entry — line up the head with this. */}
      <mesh
        position={[ghost.start.x, ghost.start.h + 0.1, ghost.start.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.3, 0.42, 20]} />
        <meshBasicMaterial
          color={ghost.closed ? "#2FA84F" : "#E5484D"}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function GhostPlacement({
  placement,
  material,
}: {
  placement: ModelPlacement;
  material: MeshBasicMaterial;
}) {
  const parts = useModelParts(placement.assetId);
  return (
    <group
      position={[placement.x, placement.y + 0.02, placement.z]}
      rotation={[0, placement.yaw, 0]}
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
  );
}
