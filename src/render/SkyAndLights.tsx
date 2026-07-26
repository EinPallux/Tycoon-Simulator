"use client";

/**
 * Day/night cycle: gradient sky dome + sun/moon lighting driven by sim time
 * (GAME_DESIGN.md §3). Procedural (shader dome) rather than the static Kenney
 * panoramas so dawn/dusk blend continuously — noted in ASSET_GUIDE.md §4.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  ShaderMaterial,
  Vector3,
} from "three";
import { timeOfDay01 } from "@/sim/world/time";
import type { WeatherKind } from "@/sim/balance/phase3";
import { clamp01, damp, lerp } from "@/shared/mathx";
import { useGameStore } from "@/ui/stores/gameStore";
import { daylight } from "./Ground";

/** Weather grading: sun/ambient multipliers + how gray the sky goes. */
const WEATHER_GRADE: Record<WeatherKind, { sun: number; ambient: number; gray: number }> = {
  sun: { sun: 1, ambient: 1, gray: 0 },
  cloud: { sun: 0.7, ambient: 0.88, gray: 0.3 },
  rain: { sun: 0.42, ambient: 0.72, gray: 0.58 },
  storm: { sun: 0.2, ambient: 0.55, gray: 0.8 },
  heat: { sun: 1.08, ambient: 1, gray: 0 },
};

const GRAY_ZENITH = new Color("#5d6a7d");
const GRAY_HORIZON = new Color("#8b96a6");

interface SkyStop {
  t: number;
  zenith: Color;
  horizon: Color;
  sun: number; // sun light intensity
  ambient: number;
}

const STOPS: SkyStop[] = [
  { t: 0.0, zenith: new Color("#0b1026"), horizon: new Color("#1b2233"), sun: 0, ambient: 0.35 },
  { t: 0.22, zenith: new Color("#0e1430"), horizon: new Color("#2c3a52"), sun: 0, ambient: 0.4 },
  { t: 0.28, zenith: new Color("#3a4a8c"), horizon: new Color("#ff9e6d"), sun: 0.9, ambient: 0.55 },
  { t: 0.38, zenith: new Color("#4f8fd8"), horizon: new Color("#bde3ff"), sun: 2.4, ambient: 0.8 },
  { t: 0.5, zenith: new Color("#3f7fd4"), horizon: new Color("#cfe9ff"), sun: 2.9, ambient: 0.9 },
  { t: 0.62, zenith: new Color("#4f8fd8"), horizon: new Color("#bde3ff"), sun: 2.4, ambient: 0.8 },
  { t: 0.72, zenith: new Color("#40509e"), horizon: new Color("#ff9e6d"), sun: 0.9, ambient: 0.55 },
  { t: 0.78, zenith: new Color("#101636"), horizon: new Color("#3a2c52"), sun: 0, ambient: 0.42 },
  { t: 1.0, zenith: new Color("#0b1026"), horizon: new Color("#1b2233"), sun: 0, ambient: 0.35 },
];

function sampleSky(t: number, outZenith: Color, outHorizon: Color): { sun: number; ambient: number } {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (a && b && t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      outZenith.copy(a.zenith).lerp(b.zenith, f);
      outHorizon.copy(a.horizon).lerp(b.horizon, f);
      return { sun: lerp(a.sun, b.sun, f), ambient: lerp(a.ambient, b.ambient, f) };
    }
  }
  const last = STOPS[STOPS.length - 1];
  if (last) {
    outZenith.copy(last.zenith);
    outHorizon.copy(last.horizon);
    return { sun: last.sun, ambient: last.ambient };
  }
  return { sun: 1, ambient: 0.6 };
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform float uSunGlow;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.6));
  float sunDot = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(sunDot, 260.0) * uSunGlow;        // disc
  col += vec3(1.0, 0.75, 0.5) * pow(sunDot, 8.0) * 0.16 * uSunGlow;  // haze
  gl_FragColor = vec4(col, 1.0);
}
`;

export function SkyAndLights() {
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const zenith = useMemo(() => new Color(), []);
  const horizon = useMemo(() => new Color(), []);
  const sunDir = useMemo(() => new Vector3(0, 1, 0), []);
  const fog = useMemo(() => new Fog(new Color("#cfe9ff"), 90, 260), []);
  // Smoothed weather grade so fronts roll in instead of snapping.
  const grade = useRef({ sun: 1, ambient: 1, gray: 0 });

  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new Color("#3f7fd4") },
          uHorizon: { value: new Color("#cfe9ff") },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunGlow: { value: 1 },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      }),
    [],
  );

  useFrame(({ scene }, dt) => {
    const sim = useGameStore.getState().sim;
    if (!sim) return;
    const t = timeOfDay01(sim.world.time);
    let { sun, ambient } = sampleSky(t, zenith, horizon);

    // Weather rolls the grade toward its target (≈2 s time constant).
    const target = WEATHER_GRADE[sim.world.weather.current];
    const g = grade.current;
    const dtc = Math.min(dt, 0.05);
    g.sun = damp(g.sun, target.sun, 1.8, dtc);
    g.ambient = damp(g.ambient, target.ambient, 1.8, dtc);
    g.gray = damp(g.gray, target.gray, 1.8, dtc);
    sun *= g.sun;
    ambient *= g.ambient;
    if (g.gray > 0.01) {
      zenith.lerp(GRAY_ZENITH, g.gray * 0.8);
      horizon.lerp(GRAY_HORIZON, g.gray * 0.8);
    }

    // Sun path: rise 06:00 (t=.25) → set 18:00 (t=.75).
    const dayArc = clamp01((t - 0.25) / 0.5);
    const angle = dayArc * Math.PI;
    sunDir.set(Math.cos(angle) * 0.9, Math.max(Math.sin(angle), -0.15), 0.35).normalize();

    const uniforms = skyMaterial.uniforms;
    (uniforms.uZenith?.value as Color | undefined)?.copy(zenith);
    (uniforms.uHorizon?.value as Color | undefined)?.copy(horizon);
    (uniforms.uSunDir?.value as Vector3 | undefined)?.copy(sunDir);
    if (uniforms.uSunGlow) uniforms.uSunGlow.value = sun > 0 ? 1 - grade.current.gray : 0;

    const world = sim.world;
    const cx = world.ownedRect.x0 + world.ownedRect.w / 2;
    const cz = world.ownedRect.z0 + world.ownedRect.d / 2;

    const sunLight = sunRef.current;
    if (sunLight) {
      sunLight.position.set(cx + sunDir.x * 80, Math.max(sunDir.y, 0.05) * 80, cz + sunDir.z * 80);
      sunLight.target.position.set(cx, 0, cz);
      sunLight.target.updateMatrixWorld();
      sunLight.intensity = sun;
      sunLight.color.set(sun < 1.2 ? "#ffc9a0" : "#fff4e0");
    }
    if (hemiRef.current) hemiRef.current.intensity = ambient * 1.9;

    // Publish the daylight level for unlit materials (ground).
    daylight.value = clamp01((sun / 2.9) * 0.75 + (ambient - 0.35) / 0.55 / 2.5);

    fog.color.copy(horizon);
    scene.fog = fog;
    // Insurance for pixels beyond the dome/ground (e.g. extreme pitches).
    scene.background = horizon;
  });

  return (
    <>
      <mesh material={skyMaterial} frustumCulled={false} renderOrder={-100}>
        <sphereGeometry args={[400, 24, 12]} />
      </mesh>
      <hemisphereLight ref={hemiRef} args={["#cfe9ff", "#6f8f5c", 0.8]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={2.4}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={5}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
      />
    </>
  );
}
