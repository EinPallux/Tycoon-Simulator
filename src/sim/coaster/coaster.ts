/**
 * Coaster entity: a validated closed circuit of track pieces plus computed
 * physics (per-piece speeds via a simple energy model) and stats
 * (GAME_DESIGN.md §15.3). Only COMPLETE coasters enter the world — the
 * builder UI keeps drafts on its side and commits one `build-coaster`
 * command (single undoable patch).
 */

import {
  exitOf,
  nodesEqual,
  PIECES,
  pieceTiles,
  type Heading,
  type PieceType,
  type PlacedPiece,
  type TrackNode,
} from "./pieces";
import { isOwned } from "../world/tiles";
import type { World } from "../world/world";

export type CoasterFamily = "mouse" | "flume" | "steel" | "hanging" | "monorail";

export const FAMILY_INFO: Record<
  CoasterFamily,
  { name: string; baseCost: number; ticket: number; runningPerDay: number; smoothness: number }
> = {
  mouse: { name: "Wild Mouse", baseCost: 800_00 * 10, ticket: 450, runningPerDay: 2_600, smoothness: 0.4 },
  flume: { name: "Log Flume", baseCost: 900_00 * 10, ticket: 400, runningPerDay: 2_400, smoothness: 0.7 },
  steel: { name: "Steel Streak", baseCost: 1_200_00 * 10, ticket: 500, runningPerDay: 3_200, smoothness: 0.55 },
  hanging: { name: "Sky Hanger", baseCost: 1_350_00 * 10, ticket: 550, runningPerDay: 3_400, smoothness: 0.5 },
  monorail: { name: "Park Monorail", baseCost: 700_00 * 10, ticket: 250, runningPerDay: 1_800, smoothness: 0.9 },
};

export interface CoasterStats {
  excitement: number;
  intensity: number;
  nausea: number;
  maxSpeed: number; // units/s
  rideTimeSec: number;
  drops: number;
  inversions: number;
  trackLength: number;
}

export interface Coaster {
  /** The placeable entity id of its station (guests target that). */
  entityId: number;
  family: CoasterFamily;
  pieces: PlacedPiece[];
  stats: CoasterStats;
  /** Entry speed (units/s) at the start of each piece, precomputed. */
  pieceSpeeds: number[];
  /** Cumulative time (s) at the start of each piece + total. */
  pieceTimes: number[];
  totalTime: number;
}

export interface DraftValidation {
  ok: boolean;
  reason?: string;
}

/** Validate adding `type` at the current head node. */
export function canAddPiece(world: World, head: TrackNode, type: PieceType): DraftValidation {
  const spec = PIECES[type];
  const exit = exitOf(head, type);
  if (head.h + Math.min(0, spec.dh) < 0 || exit.h < 0) {
    return { ok: false, reason: "Track can't dig underground" };
  }
  if (exit.h > 6) return { ok: false, reason: "That's high enough — supports have limits" };
  // Every crossed tile must stay inside owned land.
  for (const [tx, tz] of pieceTiles({ type, entry: head })) {
    if (!isOwned(world.tiles, tx, tz)) return { ok: false, reason: "Outside your land" };
  }
  return { ok: true };
}

/** A full circuit: starts with a station, closes back onto its entry. */
export function validateCircuit(world: World, pieces: PlacedPiece[]): DraftValidation {
  if (pieces.length < 4) return { ok: false, reason: "A coaster needs more track than that" };
  if (pieces[0]?.type !== "station") return { ok: false, reason: "Circuits start at a station" };
  let node = pieces[0].entry;
  for (const piece of pieces) {
    if (!nodesEqual(piece.entry, node)) return { ok: false, reason: "Track chain is broken" };
    const verdict = canAddPiece(world, node, piece.type);
    if (!verdict.ok) return verdict;
    node = exitOf(node, piece.type);
  }
  if (!nodesEqual(node, pieces[0].entry)) return { ok: false, reason: "Circuit doesn't close" };
  return { ok: true };
}

// ── Physics: energy model with chain sections ────────────────────────────

const GRAVITY = 5.2; // tuned for fun numbers, not Newton
const MIN_SPEED = 1.0;
const MAX_SPEED = 8.5;
const FRICTION = 0.985; // per-piece energy keep

export function computeRun(pieces: PlacedPiece[]): {
  pieceSpeeds: number[];
  pieceTimes: number[];
  totalTime: number;
  maxSpeed: number;
} {
  // Iterate the loop twice so the entry speed converges.
  let v = PIECES.station.chainSpeed ?? 1.4;
  const speeds: number[] = new Array(pieces.length).fill(v);
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i] as PlacedPiece;
      const spec = PIECES[piece.type];
      speeds[i] = v;
      if (spec.chainSpeed !== undefined) {
        v = spec.chainSpeed;
      } else {
        const vSquared = v * v * FRICTION + 2 * GRAVITY * -spec.dh;
        v = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.sqrt(Math.max(0.5, vSquared))));
      }
    }
  }
  const times: number[] = [];
  let total = 0;
  let maxSpeed = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i] as PlacedPiece;
    const spec = PIECES[piece.type];
    const entrySpeed = speeds[i] as number;
    const exitSpeed = speeds[(i + 1) % pieces.length] as number;
    const avg = (entrySpeed + exitSpeed) / 2;
    times.push(total);
    total += spec.length / Math.max(0.6, avg);
    maxSpeed = Math.max(maxSpeed, entrySpeed, exitSpeed);
  }
  return { pieceSpeeds: speeds, pieceTimes: times, totalTime: total, maxSpeed };
}

// ── Stats (GAME_DESIGN.md §15.3) ─────────────────────────────────────────

export function computeStats(family: CoasterFamily, pieces: PlacedPiece[]): CoasterStats {
  const run = computeRun(pieces);
  let drops = 0;
  let inversions = 0;
  let trackLength = 0;
  let turns = 0;
  for (const piece of pieces) {
    const spec = PIECES[piece.type];
    trackLength += spec.length;
    if (spec.dh < 0) drops++;
    if (spec.inversion) inversions++;
    if (piece.type === "corner-left" || piece.type === "corner-right") turns++;
  }
  const maxSpeedKmh = run.maxSpeed * 2 * 3.6; // units→m→km/h
  const smooth = FAMILY_INFO[family].smoothness;
  const airtime = drops * 0.5;

  const excitement = clamp10(
    1.2 + 0.9 * drops + 1.4 * inversions + 0.028 * maxSpeedKmh + 0.35 * airtime + 0.12 * turns,
  );
  const intensity = clamp10(0.02 * maxSpeedKmh + 1.1 * inversions + 0.5 * drops + 0.15 * turns);
  const nausea = clamp10(0.55 * intensity + 0.9 * inversions * 0.5 - 0.3 * smooth * 3);
  return {
    excitement,
    intensity,
    nausea,
    maxSpeed: run.maxSpeed,
    rideTimeSec: run.totalTime,
    drops,
    inversions,
    trackLength,
  };
}

const clamp10 = (v: number): number => Math.round(Math.min(10, Math.max(0, v)) * 10) / 10;

export function coasterCost(family: CoasterFamily, pieces: PlacedPiece[]): number {
  return (
    FAMILY_INFO[family].baseCost +
    pieces.reduce((sum, piece) => sum + PIECES[piece.type].cost, 0)
  );
}

/** Station heading such that its 1×2 footprint hugs the entry tiles. */
export function stationTiles(entry: TrackNode): Array<readonly [number, number]> {
  return pieceTiles({ type: "station", entry });
}

export function getCoasterByEntity(world: World, entityId: number): Coaster | undefined {
  return world.coasters.get(entityId);
}

export type { Heading, PieceType, PlacedPiece, TrackNode };
