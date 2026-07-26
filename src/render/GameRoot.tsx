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
import { loadSaveWithRecovery, storeSave } from "@/ui/saves";
import { useGameStore } from "@/ui/stores/gameStore";
import { useAppStore } from "@/ui/stores/appStore";
import { toast, ToastRail } from "@/ui/kit/Toast";
import { CrashGuard, WebGLWatchdog } from "@/ui/CrashGuard";
import { applyVolumes, setWallaLevel, sfx, unlockAudio } from "@/audio/bus";
import { setMusicMood, type MusicMood } from "@/audio/music";
import { timeOfDay01 } from "@/sim/world/time";
import { WorldScene } from "./WorldScene";
import { renderClock } from "./stats";
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
    void loadSaveWithRecovery(saveId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setLoadError("That park doesn't exist (anymore) — and no backup could be read.");
          return;
        }
        if (result.recoveredFrom !== null) {
          toast(
            "warning",
            `💾 The latest save was unreadable — recovered the autosave from ${result.recoveredFrom} save${result.recoveredFrom > 1 ? "s" : ""} ago.`,
          );
        }
        const handle = createSimHandle(worldFromSave(result.save));
        useGameStore.getState().attach(handle, saveId);
        wireSimEvents(handle);
        setSim(handle);
        // Deterministic hooks for e2e scripts and debugging.
        (window as unknown as Record<string, unknown>).__wanderpark = {
          sim: handle,
          store: useGameStore,
        };
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) setLoadError("This save could not be loaded (all backups included).");
      });
    return () => {
      cancelled = true;
      useGameStore.getState().detach();
    };
  }, [saveId]);

  useSimLoop(sim);
  useKeyboard(sim, saveId);
  useAutosave(sim, saveId);

  // Audio unlock needs a user gesture; volumes track settings live.
  useEffect(() => {
    const unlock = (): void => {
      unlockAudio();
      applyVolumes();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    const unsub = useAppStore.subscribe(() => applyVolumes());
    return () => {
      window.removeEventListener("pointerdown", unlock);
      unsub();
      setMusicMood(null); // leaving the park stops the soundtrack
    };
  }, []);

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
    <CrashGuard>
    <div className="relative h-dvh w-full overflow-hidden bg-ink-900">
      {sim && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.5, far: 600 }}
          gl={{ preserveDrawingBuffer: true }}
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
      {sim && sceneReady && <WebGLWatchdog />}
      <ToastRail />
    </div>
    </CrashGuard>
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
  sim.events.on("entity-added", () => {
    store.bumpWorld();
    sfx.thunk();
  });
  sim.events.on("entity-removed", () => store.bumpWorld());
  sim.events.on("surface-changed", () => {
    store.bumpWorld();
    sfx.thunk();
  });
  sim.events.on("command-rejected", ({ reason }) => {
    toast("warning", reason);
    sfx.boing();
  });
  // ── The living park ──
  sim.events.on("sale", () => {
    useGameStore.getState().setHud({ cash: sim.world.cash });
    sfx.clink();
  });
  sim.events.on("guests-changed", ({ count, lifetime }) =>
    useGameStore.getState().setHud({ guestCount: count, lifetimeGuests: lifetime }),
  );
  sim.events.on("rating-changed", ({ value }) =>
    useGameStore.getState().setHud({ ratingValue: value }),
  );
  sim.events.on("milestone", ({ tier, name, award }) => {
    useGameStore.getState().setMilestoneSheet({ tier, name, award });
    sfx.fanfare();
  });
  sim.events.on("notify", ({ tone, message }) => toast(tone, message));
  // ── Coasters & chaos ──
  sim.events.on("weather-changed", ({ kind }) => useGameStore.getState().setHud({ weather: kind }));
  sim.events.on("research-done", () => {
    // Unlock badges (dock, coaster trays) re-derive from the world.
    useGameStore.getState().bumpWorld();
    sfx.fanfare();
  });
  sim.events.on("ride-fixed", () => sfx.thunk());
  sim.events.on("park-over", ({ reason }) => {
    useGameStore.getState().setParkOver(reason);
    useGameStore.getState().setSpeed(0);
  });
}

/** Short HUD chip labels for active dynamic events. */
const EVENT_LABELS: Record<string, string> = {
  vip: "🎩 VIP visiting",
  influencer: "🤳 Streamer on site",
  "coaster-club": "🎢 Coaster Club visit",
};

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
      // Guest-position interpolation fraction for the render layers.
      renderClock.alpha = ticksPerSec > 0 ? Math.min(1, accumulator) : 1;

      // Ambient crowd volume tracks guest density (throttled inside).
      if (sim.world.time % 10 === 0) setWallaLevel(sim.world.guests.count / 250);

      const clock = formatClock(sim.world.time);
      if (clock !== lastClock) {
        lastClock = clock;
        // Once per sim-minute: clock + slow ambient mirrors (event chip).
        const active = sim.world.events.active;
        const eventLabel = active ? (EVENT_LABELS[active.kind] ?? null) : null;
        useGameStore.getState().setHud({ clock, eventLabel });
        // Soundtrack mood: storm > night > day (audio v2).
        const t01 = timeOfDay01(sim.world.time);
        const mood: MusicMood =
          sim.world.weather.current === "storm" ? "storm" : t01 > 0.27 && t01 < 0.76 ? "day" : "night";
        setMusicMood(mood);
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
      // Remappable actions first (GAME_DESIGN.md §18 — keymap in Settings).
      const keymap = useAppStore.getState().keymap;
      const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (pressed === keymap.pause) {
        e.preventDefault();
        store.togglePause();
        return;
      }
      if (pressed === keymap.speed1) return store.setSpeed(1);
      if (pressed === keymap.speed2) return store.setSpeed(2);
      if (pressed === keymap.speed3) return store.setSpeed(3);
      if (pressed === keymap.build) {
        store.setDockCategory(store.dockCategory === null ? "paths" : null);
        return;
      }
      if (pressed === keymap.bulldoze) {
        store.setTool({ kind: "bulldoze" });
        return;
      }
      if (pressed === keymap.rotate) {
        const tool = store.tool;
        if (tool.kind === "place") store.setTool({ ...tool, rot: (tool.rot + 1) % 4 });
        if (tool.kind === "move") store.setTool({ ...tool, rot: (tool.rot + 1) % 4 });
        if (tool.kind === "coaster" && store.coasterDraft === null)
          store.setTool({ ...tool, rot: (tool.rot + 1) % 4 });
        return;
      }
      if (pressed === keymap.photo) {
        store.setPhotoMode(!store.photoMode);
        return;
      }
      // Fixed keys.
      switch (e.key) {
        case "Escape":
          store.escape();
          break;
        case "Delete":
          store.setTool({ kind: "bulldoze" });
          break;
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
