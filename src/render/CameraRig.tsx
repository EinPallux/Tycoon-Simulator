"use client";

/**
 * RTS camera rig (UI_UX_DESIGN.md §9, TECHNICAL_ARCHITECTURE.md §8):
 * WASD/middle-drag pan · Q/E 45° yaw snaps · wheel zoom-to-cursor with
 * pitch easing · bounds clamp · smooth damping. State persists into
 * world.camera so a save restores the exact view.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { clamp, damp, dampAngle, lerp } from "@/shared/mathx";
import { useGameStore } from "@/ui/stores/gameStore";
import { useAppStore } from "@/ui/stores/appStore";

const GROUND = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();

const MIN_DIST = 7;
const MAX_DIST = 95;
const MIN_PITCH = 0.62; // ~35°
const MAX_PITCH = 1.08; // ~62°
const PAN_MARGIN = 12;

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const sim = useGameStore((s) => s.sim);

  const state = useRef({
    // live (damped) values
    x: 64,
    z: 64,
    yaw: 0,
    zoom: 0.45,
    // targets
    tx: 64,
    tz: 64,
    tyaw: 0,
    tzoom: 0.45,
    keys: new Set<string>(),
    dragging: false,
    lastPointer: { x: 0, y: 0 },
  });

  // Init from the saved camera.
  useEffect(() => {
    if (!sim) return;
    const c = sim.world.camera;
    const s = state.current;
    s.x = s.tx = c.targetX;
    s.z = s.tz = c.targetZ;
    s.yaw = s.tyaw = c.yaw;
    s.zoom = s.tzoom = c.zoom;
    return () => {
      // Persist on unmount for the save file.
      sim.world.camera = { targetX: s.tx, targetZ: s.tz, yaw: s.tyaw, zoom: s.tzoom };
    };
  }, [sim]);

  // Input listeners.
  useEffect(() => {
    const el = gl.domElement;
    const s = state.current;

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(k)) {
        if (down) s.keys.add(k);
        else s.keys.delete(k);
      }
      if (down && (k === "q" || k === "e")) {
        s.tyaw += ((k === "q" ? 1 : -1) * Math.PI) / 4;
      }
    };
    const onKeyDown = onKey(true);
    const onKeyUp = onKey(false);

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const invert = useAppStore.getState().settings.invertZoom ? -1 : 1;
      const delta = Math.sign(e.deltaY) * invert;
      const prevZoom = s.tzoom;
      s.tzoom = clamp(s.tzoom + delta * 0.07, 0, 1);
      // Zoom-to-cursor: nudge the target toward the point under the mouse.
      if (s.tzoom < prevZoom) {
        const rect = el.getBoundingClientRect();
        ndc.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(GROUND, hit)) {
          const pull = 0.22;
          s.tx = lerp(s.tx, hit.x, pull);
          s.tz = lerp(s.tz, hit.z, pull);
        }
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button === 1) {
        e.preventDefault();
        s.dragging = true;
        s.lastPointer = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
      }
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!s.dragging) return;
      const dx = e.clientX - s.lastPointer.x;
      const dy = e.clientY - s.lastPointer.y;
      s.lastPointer = { x: e.clientX, y: e.clientY };
      const dist = lerp(MIN_DIST, MAX_DIST, s.zoom * s.zoom);
      const scale = dist * 0.0013;
      const sin = Math.sin(s.yaw);
      const cos = Math.cos(s.yaw);
      s.tx -= (dx * cos - dy * sin) * scale;
      s.tz -= (dx * sin + dy * cos) * scale * 1.4;
    };
    const onPointerUp = (e: PointerEvent): void => {
      if (e.button === 1) s.dragging = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [camera, gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;

    // WASD pan in yaw frame.
    let vx = 0;
    let vz = 0;
    if (s.keys.has("w")) vz -= 1;
    if (s.keys.has("s")) vz += 1;
    if (s.keys.has("a")) vx -= 1;
    if (s.keys.has("d")) vx += 1;
    if (vx !== 0 || vz !== 0) {
      const speed = lerp(9, 55, s.zoom * s.zoom) * dt;
      const sin = Math.sin(s.yaw);
      const cos = Math.cos(s.yaw);
      s.tx += (vx * cos - vz * sin) * speed;
      s.tz += (vx * sin + vz * cos) * speed;
    }

    // Clamp to park surroundings.
    const world = useGameStore.getState().sim?.world;
    if (world) {
      const r = world.ownedRect;
      s.tx = clamp(s.tx, r.x0 - PAN_MARGIN, r.x0 + r.w + PAN_MARGIN);
      s.tz = clamp(s.tz, r.z0 - PAN_MARGIN, r.z0 + r.d + PAN_MARGIN);
    }

    // Damp toward targets.
    s.x = damp(s.x, s.tx, 8, dt);
    s.z = damp(s.z, s.tz, 8, dt);
    s.yaw = dampAngle(s.yaw, s.tyaw, 10, dt);
    s.zoom = damp(s.zoom, s.tzoom, 10, dt);

    const dist = lerp(MIN_DIST, MAX_DIST, s.zoom * s.zoom);
    const pitch = lerp(MIN_PITCH, MAX_PITCH, s.zoom);
    const y = Math.sin(pitch) * dist;
    const horizontal = Math.cos(pitch) * dist;
    camera.position.set(
      s.x + Math.sin(s.yaw) * horizontal,
      y,
      s.z + Math.cos(s.yaw) * horizontal,
    );
    camera.lookAt(s.x, 0, s.z);
  });

  return null;
}
