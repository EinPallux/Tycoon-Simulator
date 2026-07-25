"use client";

/**
 * Frame stats singleton for the F3 perf overlay (TECHNICAL_ARCHITECTURE.md §12).
 * Written by StatsProbe inside the Canvas each frame; read by the DOM overlay
 * on a slow interval — no React state churn at frame rate.
 */

export interface FrameStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  instances: number;
}

export const frameStats: FrameStats = {
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  instances: 0,
};
