"use client";

/**
 * Park minimap thumbnail: drawn from save data (tiles + placeables) on a 2D
 * canvas — deterministic, instant, and works everywhere (no GL readback).
 */

import { useEffect, useRef } from "react";
import type { SaveFile } from "@/sim/save/schema";
import { base64ToU8 } from "@/shared/encoding";
import { getPlaceableDef } from "@/content/catalog";

const COLORS = {
  outside: "#101422",
  grass: "#3f7d3a",
  grassAlt: "#448540",
  path: "#b9b2a6",
  queue: "#c7903f",
  ride: "#2E5AE8",
  coaster: "#D6337A",
  stall: "#F2742C",
  scenery: "#2FA84F",
};

export function ParkThumb({ save, className = "" }: { save: SaveFile; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const size = save.world.size;
    const rect = save.world.ownedRect;
    const surface = base64ToU8(save.world.surface, size * size);
    const scale = 4;
    canvas.width = rect.w * scale;
    canvas.height = rect.d * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let dz = 0; dz < rect.d; dz++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const x = rect.x0 + dx;
        const z = rect.z0 + dz;
        const s = surface[z * size + x] ?? 0;
        ctx.fillStyle =
          s === 1
            ? COLORS.path
            : s === 2
              ? COLORS.queue
              : (dx + dz) % 2 === 0
                ? COLORS.grass
                : COLORS.grassAlt;
        ctx.fillRect(dx * scale, dz * scale, scale, scale);
      }
    }
    for (const entity of save.placeables) {
      let def;
      try {
        def = getPlaceableDef(entity.defId);
      } catch {
        continue;
      }
      const [w, d] = entity.rot % 2 === 0 ? def.footprint : [def.footprint[1], def.footprint[0]];
      ctx.fillStyle = def.coasterFamily
        ? COLORS.coaster
        : def.ride
          ? COLORS.ride
          : def.stall
            ? COLORS.stall
            : COLORS.scenery;
      ctx.fillRect(
        (entity.x - rect.x0) * scale,
        (entity.z - rect.z0) * scale,
        Math.max(scale, w * scale),
        Math.max(scale, d * scale),
      );
    }
    // Coaster tracks as magenta stitches.
    for (const coaster of save.coasters) {
      ctx.fillStyle = COLORS.coaster;
      for (const piece of coaster.pieces) {
        ctx.fillRect(
          (Math.floor(piece.entry.x) - rect.x0) * scale,
          (Math.floor(piece.entry.z) - rect.z0) * scale,
          scale,
          scale,
        );
      }
    }
  }, [save]);

  return <canvas ref={ref} className={`image-render-pixel ${className}`} aria-hidden />;
}
