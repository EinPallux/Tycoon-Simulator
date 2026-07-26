/**
 * Coaster track-piece mathematics (GAME_DESIGN.md §4.6).
 *
 * A track is a chain of pieces. Each piece ENTERS at a node — a point on a
 * tile-edge midpoint with a compass heading and an integer height level —
 * and EXITS at the next node. All geometry is grid-snapped: headings are
 * N/E/S/W, positions advance whole tiles, heights step by whole units
 * (1 unit = 2 m). Chirality needs no mirrored models: a right-hand curve
 * traversed backward IS the left-hand curve (the render layer anchors the
 * model at the far end for lefts).
 */

export type Heading = 0 | 1 | 2 | 3; // N(-z) E(+x) S(+z) W(-x)

export const FWD: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const turnLeft = (d: Heading): Heading => (((d + 3) % 4) as Heading);
export const turnRight = (d: Heading): Heading => (((d + 1) % 4) as Heading);
export const reverse = (d: Heading): Heading => (((d + 2) % 4) as Heading);

/** A connection point between pieces. x/z in world units (tile-edge midpoints). */
export interface TrackNode {
  x: number;
  z: number;
  /** Height level (integer, 1 = one unit above ground). */
  h: number;
  dir: Heading;
}

export type PieceType =
  | "station" // 2 tiles long, boarding point, chain speed
  | "straight" // 1 tile
  | "corner-left" // radius-2 quarter turn, 2×2 tiles
  | "corner-right"
  | "slope-up" // 4 tiles long, +1 height (chain lift)
  | "slope-down" // 4 tiles long, −1 height
  | "loop"; // 4 tiles long, vertical loop, Δh 0

export interface PieceSpec {
  type: PieceType;
  /** Arc length in world units (for train motion & timing). */
  length: number;
  /** Height change entry→exit. */
  dh: number;
  /** Cost in cents. */
  cost: number;
  /** Counts as an inversion for stats. */
  inversion?: boolean;
  /** Fixed chain/station speed (units/s) instead of gravity physics. */
  chainSpeed?: number;
}

const QUARTER_ARC_R2 = (Math.PI * 2) / 2; // radius 2 quarter ≈ 3.14

/** Costs in DOLLARS here for readability; converted to cents below. */
export const PIECES: Record<PieceType, PieceSpec> = {
  station: { type: "station", length: 2, dh: 0, cost: 0, chainSpeed: 1.4 },
  straight: { type: "straight", length: 1, dh: 0, cost: 180 },
  "corner-left": { type: "corner-left", length: QUARTER_ARC_R2, dh: 0, cost: 240 },
  "corner-right": { type: "corner-right", length: QUARTER_ARC_R2, dh: 0, cost: 240 },
  "slope-up": { type: "slope-up", length: 4.12, dh: 1, cost: 380, chainSpeed: 1.6 },
  "slope-down": { type: "slope-down", length: 4.12, dh: -1, cost: 320 },
  loop: { type: "loop", length: 10.1, dh: 0, cost: 1_400, inversion: true },
};

for (const spec of Object.values(PIECES)) spec.cost = Math.round(spec.cost * 100);

/** Exit node for a piece entered at `node`. */
export function exitOf(node: TrackNode, type: PieceType): TrackNode {
  const [fx, fz] = FWD[node.dir] as readonly [number, number];
  switch (type) {
    case "station":
      return { x: node.x + fx * 2, z: node.z + fz * 2, h: node.h, dir: node.dir };
    case "straight":
      return { x: node.x + fx, z: node.z + fz, h: node.h, dir: node.dir };
    case "slope-up":
      return { x: node.x + fx * 4, z: node.z + fz * 4, h: node.h + 1, dir: node.dir };
    case "slope-down":
      return { x: node.x + fx * 4, z: node.z + fz * 4, h: node.h - 1, dir: node.dir };
    case "loop":
      return { x: node.x + fx * 4, z: node.z + fz * 4, h: node.h, dir: node.dir };
    case "corner-right": {
      const d = turnRight(node.dir);
      const [rx, rz] = FWD[d] as readonly [number, number];
      return { x: node.x + fx * 2 + rx * 2, z: node.z + fz * 2 + rz * 2, h: node.h, dir: d };
    }
    case "corner-left": {
      const d = turnLeft(node.dir);
      const [lx, lz] = FWD[d] as readonly [number, number];
      return { x: node.x + fx * 2 + lx * 2, z: node.z + fz * 2 + lz * 2, h: node.h, dir: d };
    }
  }
}

export interface PlacedPiece {
  type: PieceType;
  /** Entry node (derives everything else). */
  entry: TrackNode;
}

/** World-space point + tangent along a piece at param t ∈ [0,1] (by arc length). */
export function pointOnPiece(
  piece: PlacedPiece,
  t: number,
): { x: number; y: number; z: number; tx: number; ty: number; tz: number } {
  const { entry, type } = piece;
  const [fx, fz] = FWD[entry.dir] as readonly [number, number];
  const baseY = entry.h + 0.12; // ride height above the track bed

  switch (type) {
    case "station":
      return { x: entry.x + fx * 2 * t, y: baseY, z: entry.z + fz * 2 * t, tx: fx, ty: 0, tz: fz };
    case "straight":
      return { x: entry.x + fx * t, y: baseY, z: entry.z + fz * t, tx: fx, ty: 0, tz: fz };
    case "slope-up":
    case "slope-down": {
      const dh = type === "slope-up" ? 1 : -1;
      // Smoothstep height profile reads better than linear at low-poly scale.
      const s = t * t * (3 - 2 * t);
      const ty = (dh * 0.24) as number;
      return {
        x: entry.x + fx * 4 * t,
        y: baseY + dh * s,
        z: entry.z + fz * 4 * t,
        tx: fx * (1 - Math.abs(ty)),
        ty,
        tz: fz * (1 - Math.abs(ty)),
      };
    }
    case "corner-right":
    case "corner-left": {
      // Quarter circle about a center 2 units to the turning side.
      // Rotating the center→entry vector by sign·90°·t sweeps the curve;
      // the tangent is that vector rotated a further sign·90°.
      const sign = type === "corner-right" ? 1 : -1;
      const side = (sign > 0 ? turnRight(entry.dir) : turnLeft(entry.dir)) as Heading;
      const [sx, sz] = FWD[side] as readonly [number, number];
      const cx = entry.x + sx * 2;
      const cz = entry.z + sz * 2;
      const v0x = -2 * sx;
      const v0z = -2 * sz;
      const a = sign * (Math.PI / 2) * t;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const vx = v0x * cos - v0z * sin;
      const vz = v0x * sin + v0z * cos;
      const tx = -sign * vz;
      const tz = sign * vx;
      const tl = Math.hypot(tx, tz) || 1;
      return { x: cx + vx, y: baseY, z: cz + vz, tx: tx / tl, ty: 0, tz: tz / tl };
    }
    case "loop": {
      // Vertical circle (radius ~1.45) in the fwd/up plane, plus forward drift.
      const R = 1.45;
      const angle = t * Math.PI * 2;
      const fwd = 4 * t;
      const lift = R * (1 - Math.cos(angle));
      const swing = R * Math.sin(angle) * 0.35; // slight forward wobble
      return {
        x: entry.x + fx * (fwd + swing * 0),
        y: baseY + lift,
        z: entry.z + fz * (fwd + swing * 0),
        tx: fx * Math.cos(angle),
        ty: Math.sin(angle),
        tz: fz * Math.cos(angle),
      };
    }
  }
}

/** Tiles a piece passes over (for the minimap/ghost footprint; coarse). */
export function pieceTiles(piece: PlacedPiece): Array<readonly [number, number]> {
  const tiles: Array<readonly [number, number]> = [];
  const spec = PIECES[piece.type];
  const steps = Math.max(2, Math.ceil(spec.length * 2));
  for (let i = 0; i <= steps; i++) {
    const p = pointOnPiece(piece, i / steps);
    const tile = [Math.floor(p.x), Math.floor(p.z)] as const;
    const last = tiles[tiles.length - 1];
    if (!last || last[0] !== tile[0] || last[1] !== tile[1]) tiles.push(tile);
  }
  return tiles;
}

export const nodesEqual = (a: TrackNode, b: TrackNode): boolean =>
  Math.abs(a.x - b.x) < 0.01 && Math.abs(a.z - b.z) < 0.01 && a.h === b.h && a.dir === b.dir;
