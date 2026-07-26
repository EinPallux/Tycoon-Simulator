"use client";

/**
 * Themed-zone banners (GAME_DESIGN.md §10.3): a floating name plate over
 * each zone. Canvas-texture sprites (no font fetching, no text libs);
 * click to select → rename panel. Re-derives at edit-rate.
 */

import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from "three";
import { useGameStore } from "@/ui/stores/gameStore";
import type { Zone } from "@/sim/world/world";

const THEME_COLORS: Record<string, string> = {
  nature: "#2FA84F",
  pirate: "#B5813B",
  space: "#7B4FD0",
  castle: "#2E5AE8",
  spooky: "#D6337A",
  winter: "#00A8A8",
};

function bannerTexture(zone: Zone): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const accent = THEME_COLORS[zone.theme] ?? "#FFB300";

  // Skewed plate, Wanderpark style.
  const skew = 18;
  ctx.beginPath();
  ctx.moveTo(40 + skew, 16);
  ctx.lineTo(472, 16);
  ctx.lineTo(472 - skew, 112);
  ctx.lineTo(40, 112);
  ctx.closePath();
  ctx.fillStyle = "rgba(16, 20, 34, 0.92)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.stroke();
  // Accent slash.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(40 + skew, 16);
  ctx.lineTo(40 + skew + 14, 16);
  ctx.lineTo(40 + 14, 112);
  ctx.lineTo(40, 112);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#F7F8FC";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const name = zone.name.length > 18 ? `${zone.name.slice(0, 17)}…` : zone.name;
  ctx.fillText(name.toUpperCase(), 262, 58);
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillStyle = "rgba(247,248,252,0.55)";
  ctx.fillText(`${zone.theme} zone · ${zone.pieces} pieces`, 262, 94);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function ZoneLayer() {
  const worldVersion = useGameStore((s) => s.worldVersion);
  const selectZone = useGameStore((s) => s.selectZone);

  const banners = useMemo(() => {
    const sim = useGameStore.getState().sim;
    if (!sim) return [];
    return sim.world.zones.map((zone) => {
      const material = new SpriteMaterial({
        map: bannerTexture(zone),
        transparent: true,
        depthWrite: false,
      });
      const sprite = new Sprite(material);
      sprite.position.set(
        (zone.x0 + zone.x1) / 2 + 0.5,
        2.6,
        (zone.z0 + zone.z1) / 2 + 0.5,
      );
      sprite.scale.set(4.6, 1.15, 1);
      return { key: zone.key, sprite };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion tracks world edits
  }, [worldVersion]);

  return (
    <>
      {banners.map(({ key, sprite }) => (
        <primitive
          key={key}
          object={sprite}
          onClick={(e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            selectZone(key);
          }}
        />
      ))}
    </>
  );
}
