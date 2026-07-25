"use client";

/**
 * Litter bits on paths — small instanced crumples. The sim mutates litter
 * without commands, so this layer polls the count a few times a second and
 * re-derives when it changes.
 */

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { MAX_LITTER } from "@/sim/balance/guests";
import { useGameStore } from "@/ui/stores/gameStore";
import { InstancedMesh, Matrix4 } from "three";

const matrix = new Matrix4();

export function LitterLayer() {
  const meshRef = useRef<InstancedMesh>(null);
  const [, bump] = useState(0);
  const lastCount = useRef(-1);
  const pollAcc = useRef(0);

  useFrame((_, dt) => {
    pollAcc.current += dt;
    if (pollAcc.current < 0.4) return;
    pollAcc.current = 0;
    const sim = useGameStore.getState().sim;
    const mesh = meshRef.current;
    if (!sim || !mesh) return;
    const litter = sim.world.litter;
    if (litter.length === lastCount.current) return;
    lastCount.current = litter.length;
    const size = sim.world.tiles.size;
    for (let i = 0; i < litter.length; i++) {
      const item = litter[i];
      if (!item) continue;
      const x = (item.idx % size) + 0.5 + ((item.seed % 60) / 60 - 0.5) * 0.7;
      const z = Math.floor(item.idx / size) + 0.5 + (((item.seed * 7) % 60) / 60 - 0.5) * 0.7;
      matrix.makeRotationY((item.seed % 20) * 0.31);
      matrix.setPosition(x, 0.045, z);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.count = litter.length;
    mesh.instanceMatrix.needsUpdate = true;
    bump((n) => n + 1);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_LITTER]} frustumCulled={false}>
      <dodecahedronGeometry args={[0.06, 0]} />
      <meshStandardMaterial color="#c9b9a1" />
    </instancedMesh>
  );
}
