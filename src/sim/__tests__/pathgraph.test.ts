import { describe, expect, it } from "vitest";
import { E, N, neighborMask, pieceForMask, reachableFrom, S, W } from "@/sim/world/pathgraph";
import { createTileMap, SURFACE_PATH, tileIndex } from "@/sim/world/tiles";

describe("pieceForMask", () => {
  it("maps isolated and dead-end tiles", () => {
    expect(pieceForMask(0)).toEqual({ piece: "straight", rot: 0 });
    expect(pieceForMask(N)).toEqual({ piece: "end", rot: 0 });
    expect(pieceForMask(E)).toEqual({ piece: "end", rot: 1 });
    expect(pieceForMask(S)).toEqual({ piece: "end", rot: 2 });
    expect(pieceForMask(W)).toEqual({ piece: "end", rot: 3 });
  });

  it("maps straights, corners, splits, crossing", () => {
    expect(pieceForMask(N | S)).toEqual({ piece: "straight", rot: 0 });
    expect(pieceForMask(E | W)).toEqual({ piece: "straight", rot: 1 });
    expect(pieceForMask(N | E)).toEqual({ piece: "corner", rot: 0 });
    expect(pieceForMask(E | S)).toEqual({ piece: "corner", rot: 1 });
    expect(pieceForMask(S | W)).toEqual({ piece: "corner", rot: 2 });
    expect(pieceForMask(W | N)).toEqual({ piece: "corner", rot: 3 });
    expect(pieceForMask(W | E | S)).toEqual({ piece: "split", rot: 0 });
    expect(pieceForMask(N | E | S | W)).toEqual({ piece: "crossing", rot: 0 });
  });

  it("covers all 16 masks", () => {
    for (let mask = 0; mask < 16; mask++) {
      const v = pieceForMask(mask);
      expect(v.rot).toBeGreaterThanOrEqual(0);
      expect(v.rot).toBeLessThanOrEqual(3);
    }
  });
});

describe("neighborMask + reachability", () => {
  it("computes masks from the tile map", () => {
    const map = createTileMap(8);
    // L-shape: (2,2)-(2,3)-(3,3)
    map.surface[tileIndex(map, 2, 2)] = SURFACE_PATH;
    map.surface[tileIndex(map, 2, 3)] = SURFACE_PATH;
    map.surface[tileIndex(map, 3, 3)] = SURFACE_PATH;
    expect(neighborMask(map, 2, 2, SURFACE_PATH)).toBe(S);
    expect(neighborMask(map, 2, 3, SURFACE_PATH)).toBe(N | E);
    expect(neighborMask(map, 3, 3, SURFACE_PATH)).toBe(W);
  });

  it("finds connected components only", () => {
    const map = createTileMap(8);
    map.surface[tileIndex(map, 1, 1)] = SURFACE_PATH;
    map.surface[tileIndex(map, 2, 1)] = SURFACE_PATH;
    map.surface[tileIndex(map, 5, 5)] = SURFACE_PATH; // island
    const reach = reachableFrom(map, 1, 1, SURFACE_PATH);
    expect(reach.size).toBe(2);
    expect(reach.has(tileIndex(map, 5, 5))).toBe(false);
  });
});
