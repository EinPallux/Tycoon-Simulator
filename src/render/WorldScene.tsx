"use client";

/** Scene composition for one park (TECHNICAL_ARCHITECTURE.md §8). */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { CameraRig } from "./CameraRig";
import { SkyAndLights } from "./SkyAndLights";
import { Ground, ParkBoundary, ParkEntrance } from "./Ground";
import { PathLayer } from "./PathLayer";
import { EntitiesLayer } from "./EntitiesLayer";
import { BuildController } from "./BuildController";
import { frameStats } from "./stats";

export function WorldScene() {
  return (
    <>
      <CameraRig />
      <SkyAndLights />
      <Ground />
      <ParkBoundary />
      <ParkEntrance />
      <PathLayer />
      <EntitiesLayer />
      <BuildController />
      <StatsProbe />
    </>
  );
}

function StatsProbe() {
  const gl = useThree((s) => s.gl);
  const emaFps = useRef(60);
  useFrame((_, dt) => {
    if (dt > 0) {
      const fps = 1 / dt;
      emaFps.current = emaFps.current * 0.95 + fps * 0.05;
    }
    frameStats.fps = emaFps.current;
    frameStats.frameMs = dt * 1000;
    frameStats.drawCalls = gl.info.render.calls;
    frameStats.triangles = gl.info.render.triangles;
  });
  return null;
}
