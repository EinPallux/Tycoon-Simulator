"use client";

/**
 * The last line of defense (ROADMAP P5): a React error boundary with a
 * friendly sheet, one-click diagnostics copy, and graceful WebGL-context-
 * lost recovery. A crash never eats a park — autosaves are already on disk.
 */

import { Component, useEffect, useState, type ReactNode } from "react";
import { APP_VERSION } from "@/sim/save/serialize";

interface CrashState {
  error: Error | null;
}

export class CrashGuard extends Component<{ children: ReactNode }, CrashState> {
  override state: CrashState = { error: null };

  static getDerivedStateFromError(error: Error): CrashState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error("Wanderpark crash:", error);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <CrashSheet error={this.state.error} />;
  }
}

function diagnostics(error: Error | null): string {
  const gl = (() => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const info = ctx?.getExtension("WEBGL_debug_renderer_info");
      return info && ctx ? String(ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
    } catch {
      return "unavailable";
    }
  })();
  return [
    `Wanderpark ${APP_VERSION}`,
    `When: ${new Date().toISOString()}`,
    `Where: ${location.pathname}${location.search}`,
    `Browser: ${navigator.userAgent}`,
    `GPU: ${gl}`,
    `Error: ${error?.message ?? "—"}`,
    `Stack: ${error?.stack?.split("\n").slice(0, 6).join(" | ") ?? "—"}`,
  ].join("\n");
}

export function CrashSheet({ error }: { error: Error | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="facet-field flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <div className="display-hero text-4xl text-paper-050">
        The teacups spun too hard
      </div>
      <p className="max-w-md text-center text-sm text-paper-050/70">
        Something crashed — but your park is safe: Wanderpark autosaves every day, on tab-switch,
        and keeps three rolling backups. Reload and carry on building.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => location.reload()}
          className="skewed cursor-pointer bg-accent-500 px-6 py-3 font-bold uppercase text-ink-900"
        >
          <span className="unskew inline-block">Reload the park</span>
        </button>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(diagnostics(error)).then(() => setCopied(true));
          }}
          className="skewed cursor-pointer border-2 border-paper-050/60 px-6 py-3 font-bold uppercase text-paper-050 hover:border-accent-500 hover:text-accent-500"
        >
          <span className="unskew inline-block">{copied ? "Copied ✓" : "Copy diagnostics"}</span>
        </button>
      </div>
      {error && (
        <code className="max-w-lg truncate text-xs text-paper-050/40">{error.message}</code>
      )}
    </div>
  );
}

/** Watches for WebGL context loss on the game canvas; offers a clean reload. */
export function WebGLWatchdog() {
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const onLost = (e: Event): void => {
      e.preventDefault();
      setLost(true);
    };
    const onRestored = (): void => setLost(false);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, []);
  if (!lost) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink-900/90">
      <div className="display-hero text-3xl text-paper-050">The graphics card blinked</div>
      <p className="max-w-sm text-center text-sm text-paper-050/70">
        The browser dropped the 3D context (usually a driver hiccup or too many tabs). Your park
        was autosaved — a reload puts you right back.
      </p>
      <button
        onClick={() => location.reload()}
        className="skewed cursor-pointer bg-accent-500 px-6 py-3 font-bold uppercase text-ink-900"
      >
        <span className="unskew inline-block">Reload</span>
      </button>
    </div>
  );
}
