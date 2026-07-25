"use client";

/**
 * Emote bubbles above guests (GAME_DESIGN.md §5.4): a fixed pool of sprites
 * driven imperatively each frame — no React churn. Capped; nearest-first
 * ordering is skipped at Phase-2 scale (the cap itself bounds draws).
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Group, Sprite, SpriteMaterial, TextureLoader, type Texture } from "three";
import { EMOTE } from "@/sim/entities/guests";
import { spriteUrl, type SpriteAssetId } from "@/content/asset-manifest";
import { useGameStore } from "@/ui/stores/gameStore";
import { renderClock } from "./stats";

const EMOTE_SPRITES: Record<number, SpriteAssetId> = {
  [EMOTE.happy]: "emote/happy",
  [EMOTE.star]: "emote/star",
  [EMOTE.heart]: "emote/heart",
  [EMOTE.hungry]: "emote/hungry",
  [EMOTE.thirsty]: "emote/thirsty",
  [EMOTE.tired]: "emote/tired",
  [EMOTE.toilet]: "emote/toilet",
  [EMOTE.angry]: "emote/angry",
  [EMOTE.expensive]: "emote/expensive",
  [EMOTE.sad]: "emote/sad",
  [EMOTE.idea]: "emote/idea",
};

const POOL_SIZE = 24;

export function EmoteLayer() {
  const scene = useThree((s) => s.scene);

  const { group, pool, textures } = useMemo(() => {
    const loader = new TextureLoader();
    const textureCache = new Map<number, Texture>();
    for (const [emoteId, assetId] of Object.entries(EMOTE_SPRITES)) {
      textureCache.set(Number(emoteId), loader.load(spriteUrl(assetId)));
    }
    const g = new Group();
    const sprites: Sprite[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new Sprite(new SpriteMaterial({ depthWrite: false, transparent: true }));
      sprite.scale.setScalar(0.62);
      sprite.visible = false;
      g.add(sprite);
      sprites.push(sprite);
    }
    return { group: g, pool: sprites, textures: textureCache };
  }, []);

  useEffect(() => {
    scene.add(group);
    return () => {
      scene.remove(group);
      for (const sprite of pool) sprite.material.dispose();
    };
  }, [scene, group, pool]);

  useFrame(() => {
    const sim = useGameStore.getState().sim;
    if (!sim) {
      for (const sprite of pool) sprite.visible = false;
      return;
    }
    const g = sim.world.guests;
    const alpha = renderClock.alpha;
    let used = 0;
    for (let slot = 0; slot < g.count && used < POOL_SIZE; slot++) {
      const emote = g.emote[slot] as number;
      if (emote === EMOTE.none) continue;
      const texture = textures.get(emote);
      if (!texture) continue;
      const sprite = pool[used] as Sprite;
      const x = (g.px[slot] as number) + ((g.x[slot] as number) - (g.px[slot] as number)) * alpha;
      const z = (g.pz[slot] as number) + ((g.z[slot] as number) - (g.pz[slot] as number)) * alpha;
      // Gentle float-up as the emote ages.
      const ttl = g.emoteTtl[slot] as number;
      sprite.position.set(x, 1.32 + Math.max(0, (26 - ttl) * 0.004), z);
      if (sprite.material.map !== texture) {
        sprite.material.map = texture;
        sprite.material.needsUpdate = true;
      }
      sprite.material.opacity = Math.min(1, ttl / 8);
      sprite.visible = true;
      used++;
    }
    for (let i = used; i < POOL_SIZE; i++) (pool[i] as Sprite).visible = false;
  });

  return null;
}
