"use client";

/**
 * GameRoot — mounts one park session:
 * load save → build SimHandle → fixed-timestep loop → Canvas + HUD.
 * (TECHNICAL_ARCHITECTURE.md §4 runtime topology)
 */

import { Canvas } from "@react-three/fiber";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { createSimHandle, type SimHandle } from "@/sim/api";
import { worldFromSave } from "@/sim/save/serialize";
import { dayOfTime, formatClock, TICKS_PER_SEC } from "@/sim/world/time";
import { loadSave, storeSave } from "@/ui/saves";
import { useGameStore } from "@/ui/stores/gameStore";
import { toast, ToastRail } from "@/ui/kit/Toast";
import { WorldScene } from "./WorldScene";
import { Hud } from "@/ui/hud/Hud";

export default function GameRoot() {
  const router = useRouter();
  const params = useSearchParams();
  const saveId = params.get("id");
  const [sim, setSim] = useState<SimHandle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // ── Load the park ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!saveId) {
      setLoadError("No park selected.");
      return;
    }
    void loadSave(saveId)
      .then((save) => {
        if (cancelled) return;
        if (!save) {
          setLoadError("That park doesn't exist (anymore).");
          return;
        }
        const handle = createSimHandle(worldFromSave(save));
        useGameStore.getState().attach(handle, saveId);
        wireSimEvents(handle);
        setSim(handle);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) setLoadError("This save could not be loaded.");
      });
    return () => {
      cancelled = true;
      useGameStore.getState().detach();
    };
  }, [saveId]);

  useSimLoop(sim);
  useKeyboard(sim, saveId);
  useAutosave(sim, saveId);

  if (loadError) {
    return (
      <div className="facet-field flex min-h-dvh flex-col items-center justify-center gap-6">
        <div className="display-hero text-4xl text-paper-050">Lost in the park</div>
        <p className="text-paper-050/70">{loadError}</p>
        <button
          onClick={() => router.push("/hub")}
          className="skewed cursor-pointer bg-accent-500 px-6 py-3 font-bold uppercase text-ink-900"
        >
          <span className="unskew inline-block">Back to the hub</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink-900">
      {sim && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.5, far: 600 }}
          onCreated={() => setSceneReady(true)}
          className="!absolute inset-0"
        >
          <Suspense fallback={null}>
            <WorldScene />
          </Suspense>
        </Canvas>
      )}
      {(!sim || !sceneReady) && (
        <div className="facet-field absolute inset-0 z-40 flex flex-col items-center justify-center gap-6">
          <div className="display-hero text-6xl text-paper-050">
            Wander<span className="text-accent-500">park</span>
          </div>
          <div className="skewed h-2 w-64 overflow-hidden bg-paper-050/20">
            <div className="h-full w-2/3 animate-pulse bg-accent-500" />
          </div>
          <p className="text-sm text-paper-050/60">Unfolding the blueprints…</p>
        </div>
      )}
      {sim && <Hud />}
      <ToastRail />
    </div>
  );
}

// ── Sim events → HUD mirrors ─────────────────────────────────────────────

function wireSimEvents(sim: SimHandle): void {
  const store = useGameStore.getState();
  sim.events.on("cash-changed", ({ cash }) => useGameStore.getState().setHud({ cash }));
  sim.events.on("day-changed", ({ day }) => useGameStore.getState().setHud({ day }));
  sim.events.on("stack-changed", ({ undo, redo }) =>
    useGameStore.getState().setHud({ canUndo: undo > 0, canRedo: redo > 0 }),
  );
  sim.events.on("entity-added", () => store.bumpWorld());
  sim.events.on("entity-removed", () => store.bumpWorld());
  sim.events.on("surface-changed", () => store.bumpWorld());
  sim.events.on("command-rejected", ({ reason }) => toast("warning", reason));
}

// ── Fixed-timestep driver (10 Hz logic × speed) ──────────────────────────

function useSimLoop(sim: SimHandle | null): void {
  useEffect(() => {
    if (!sim) return;
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let lastClock = "";

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const { paused, speed, veilOpen } = useGameStore.getState();
      const ticksPerSec = paused || veilOpen ? 0 : TICKS_PER_SEC * speed;
      accumulator += dt * ticksPerSec;
      // Catch-up cap: excess ticks are dropped so sim-time slows instead of
      // spiraling on a slow frame (§4).
      const whole = Math.floor(accumulator);
      accumulator -= whole;
      let steps = Math.min(5, whole);
      while (steps-- > 0) sim.tick(1);

      const clock = formatClock(sim.world.time);
      if (clock !== lastClock) {
        lastClock = clock;
        useGameStore.getState().setHud({ clock });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
}

// ── Keyboard map (UI_UX_DESIGN.md §9) ────────────────────────────────────

function useKeyboard(sim: SimHandle | null, saveId: string | null): void {
  useEffect(() => {
    if (!sim) return;
    const onKey = (e: KeyboardEvent): void => {
      const store = useGameStore.getState();
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          store.togglePause();
          break;
        case "1":
          store.setSpeed(1);
          break;
        case "2":
          store.setSpeed(2);
          break;
        case "3":
          store.setSpeed(3);
          break;
        case "Escape":
          store.escape();
          break;
        case "b":
        case "B":
          store.setDockCategory(store.dockCategory === null ? "paths" : null);
          break;
        case "Delete":
        case "x":
        case "X":
          store.setTool({ kind: "bulldoze" });
          break;
        case "r":
        case "R": {
          const tool = store.tool;
          if (tool.kind === "place") store.setTool({ ...tool, rot: (tool.rot + 1) % 4 });
          if (tool.kind === "move") store.setTool({ ...tool, rot: (tool.rot + 1) % 4 });
          break;
        }
        case "z":
          if (e.shiftKey) sim.redo();
          else sim.undo();
          break;
        case "Z":
          sim.redo();
          break;
        case "F3":
          e.preventDefault();
          store.togglePerfOverlay();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim, saveId]);
}

// ── Autosave: every game day + on hide (TECHNICAL_ARCHITECTURE.md §9) ────

function useAutosave(sim: SimHandle | null, saveId: string | null): void {
  const busy = useRef(false);
  useEffect(() => {
    if (!sim || !saveId) return;
    const persist = (): void => {
      if (busy.current) return;
      busy.current = true;
      void storeSave(saveId, sim.serialize(), dayOfTime(sim.world.time)).finally(() => {
        busy.current = false;
      });
    };
    const off = sim.events.on("day-changed", persist);
    const onHide = (): void => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onHide);
      persist(); // save on unmount (exit to hub)
    };
  }, [sim, saveId]);
}
