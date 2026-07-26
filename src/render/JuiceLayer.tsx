"use client";

/**
 * The juice pass (GAME_DESIGN.md §16): one pooled particle system feeding
 * every celebration — placement dust, demolish confetti, sale coin pops,
 * milestone fireworks, goal confetti. A single InstancedMesh, zero GC.
 * Respects reduced-motion (spawns nothing).
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Matrix4 } from "three";
import { getPlaceableDef } from "@/content/catalog";
import { rotatedFootprint } from "@/sim/validate";
import { sfx } from "@/audio/bus";
import { useAppStore } from "@/ui/stores/appStore";
import { useGameStore } from "@/ui/stores/gameStore";

const MAX_PARTICLES = 320;
const GRAVITY = -7.5;

// SoA particle pool (render-side only).
const px = new Float32Array(MAX_PARTICLES);
const py = new Float32Array(MAX_PARTICLES);
const pz = new Float32Array(MAX_PARTICLES);
const vx = new Float32Array(MAX_PARTICLES);
const vy = new Float32Array(MAX_PARTICLES);
const vz = new Float32Array(MAX_PARTICLES);
const life = new Float32Array(MAX_PARTICLES);
const maxLife = new Float32Array(MAX_PARTICLES);
const size = new Float32Array(MAX_PARTICLES);
const colorOf = new Float32Array(MAX_PARTICLES * 3);
let alive = 0;

const scratchColor = new Color();
const scratchMatrix = new Matrix4();

const CONFETTI = ["#FFB300", "#2E5AE8", "#D6337A", "#2FA84F", "#00A8A8", "#F2742C"];

function spawn(
  x: number,
  y: number,
  z: number,
  count: number,
  opts: {
    speed: number;
    up: number;
    spread: number;
    lifeSec: number;
    size: number;
    colors: string[];
  },
): void {
  for (let n = 0; n < count && alive < MAX_PARTICLES; n++) {
    const i = alive++;
    const angle = Math.random() * Math.PI * 2;
    const radial = Math.random() * opts.spread;
    px[i] = x;
    py[i] = y;
    pz[i] = z;
    vx[i] = Math.cos(angle) * radial * opts.speed;
    vz[i] = Math.sin(angle) * radial * opts.speed;
    vy[i] = opts.up * (0.6 + Math.random() * 0.7);
    life[i] = 0;
    maxLife[i] = opts.lifeSec * (0.7 + Math.random() * 0.6);
    size[i] = opts.size * (0.7 + Math.random() * 0.6);
    scratchColor.set(opts.colors[Math.floor(Math.random() * opts.colors.length)] as string);
    colorOf[i * 3] = scratchColor.r;
    colorOf[i * 3 + 1] = scratchColor.g;
    colorOf[i * 3 + 2] = scratchColor.b;
  }
}

const juice = {
  dust(x: number, z: number): void {
    spawn(x, 0.15, z, 10, {
      speed: 1.6,
      up: 1.6,
      spread: 1,
      lifeSec: 0.55,
      size: 0.12,
      colors: ["#c9bfa8", "#b8b2a2", "#ddd6c2"],
    });
  },
  confetti(x: number, y: number, z: number, count = 16): void {
    spawn(x, y, z, count, {
      speed: 2.2,
      up: 3.6,
      spread: 1,
      lifeSec: 1.1,
      size: 0.1,
      colors: CONFETTI,
    });
  },
  coin(x: number, z: number): void {
    spawn(x, 0.5, z, 2, {
      speed: 0.5,
      up: 2.6,
      spread: 0.5,
      lifeSec: 0.5,
      size: 0.09,
      colors: ["#FFD54A", "#FFB300"],
    });
  },
  firework(x: number, y: number, z: number): void {
    const color = CONFETTI[Math.floor(Math.random() * CONFETTI.length)] as string;
    spawn(x, y, z, 26, {
      speed: 4.2,
      up: 0.6,
      spread: 1,
      lifeSec: 1.2,
      size: 0.11,
      colors: [color, "#ffffff"],
    });
  },
};

export function JuiceLayer() {
  const ref = useRef<InstancedMesh>(null);
  const fireworkQueue = useRef<{ at: number; x: number; y: number; z: number }[]>([]);
  const sim = useGameStore((s) => s.sim);

  const reduced = (): boolean => useAppStore.getState().settings.reducedMotion;

  // ── Event wiring ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sim) return;
    const world = sim.world;
    const offs = [
      sim.events.on("entity-added", ({ entity }) => {
        if (reduced()) return;
        const def = getPlaceableDef(entity.defId);
        const [w, d] = rotatedFootprint(def, entity.rot);
        juice.dust(entity.x + w / 2, entity.z + d / 2);
      }),
      sim.events.on("entity-removed", ({ x, z }) => {
        if (reduced()) return;
        juice.confetti(x + 0.5, 0.5, z + 0.5, 12);
      }),
      sim.events.on("sale", ({ x, z }) => {
        if (reduced()) return;
        juice.coin(x + 0.5, z + 0.5);
      }),
      sim.events.on("opportunity-completed", () => {
        if (reduced()) return;
        const cam = world.camera;
        juice.confetti(cam.targetX, 2.2, cam.targetZ, 22);
        sfx.chime();
      }),
      sim.events.on("zone-formed", () => {
        if (reduced()) return;
        sfx.chime();
      }),
      sim.events.on("milestone", () => {
        // Fireworks respect BOTH reduced-motion and reduced-flash.
        if (reduced() || useAppStore.getState().settings.reducedFlash) return;
        // Three firework waves over the park center.
        const cx = world.ownedRect.x0 + world.ownedRect.w / 2;
        const cz = world.ownedRect.z0 + world.ownedRect.d / 2;
        const now = performance.now();
        for (let wave = 0; wave < 6; wave++) {
          fireworkQueue.current.push({
            at: now + wave * 420,
            x: cx + (Math.random() - 0.5) * 14,
            y: 6 + Math.random() * 4,
            z: cz + (Math.random() - 0.5) * 14,
          });
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [sim]);

  const baseColor = useMemo(() => new Color("#ffffff"), []);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const step = Math.min(dt, 0.05);

    // Launch queued fireworks.
    const now = performance.now();
    const queue = fireworkQueue.current;
    while (queue.length > 0 && (queue[0] as { at: number }).at <= now) {
      const shot = queue.shift() as { x: number; y: number; z: number };
      juice.firework(shot.x, shot.y, shot.z);
      sfx.pop();
    }

    // Integrate + compact the pool.
    for (let i = alive - 1; i >= 0; i--) {
      life[i] = (life[i] as number) + step;
      if ((life[i] as number) >= (maxLife[i] as number)) {
        // Swap-remove with the last live particle.
        const last = --alive;
        px[i] = px[last] as number;
        py[i] = py[last] as number;
        pz[i] = pz[last] as number;
        vx[i] = vx[last] as number;
        vy[i] = vy[last] as number;
        vz[i] = vz[last] as number;
        life[i] = life[last] as number;
        maxLife[i] = maxLife[last] as number;
        size[i] = size[last] as number;
        colorOf[i * 3] = colorOf[last * 3] as number;
        colorOf[i * 3 + 1] = colorOf[last * 3 + 1] as number;
        colorOf[i * 3 + 2] = colorOf[last * 3 + 2] as number;
        continue;
      }
      vy[i] = (vy[i] as number) + GRAVITY * step;
      px[i] = (px[i] as number) + (vx[i] as number) * step;
      py[i] = Math.max(0.02, (py[i] as number) + (vy[i] as number) * step);
      pz[i] = (pz[i] as number) + (vz[i] as number) * step;
    }

    for (let i = 0; i < alive; i++) {
      const t = (life[i] as number) / (maxLife[i] as number);
      const s = (size[i] as number) * (1 - t * 0.8);
      scratchMatrix.makeScale(s, s, s);
      scratchMatrix.setPosition(px[i] as number, py[i] as number, pz[i] as number);
      mesh.setMatrixAt(i, scratchMatrix);
      scratchColor.setRGB(
        colorOf[i * 3] as number,
        colorOf[i * 3 + 1] as number,
        colorOf[i * 3 + 2] as number,
      );
      mesh.setColorAt(i, scratchColor);
    }
    mesh.count = alive;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={baseColor} toneMapped={false} />
    </instancedMesh>
  );
}
