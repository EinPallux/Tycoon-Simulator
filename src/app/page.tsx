"use client";

/**
 * TITLE screen — DOM-only for instant LCP (TECHNICAL_ARCHITECTURE.md §12).
 * First visit creates the local profile (name + color); returning players
 * press straight through to the hub.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AVATAR_COLORS, useAppStore } from "@/ui/stores/appStore";
import { Button } from "@/ui/kit/Button";
import { Modal } from "@/ui/kit/Modal";

export default function TitlePage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const enter = (): void => {
    if (profile) router.push("/hub");
    else setCreating(true);
  };

  const confirmProfile = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setProfile({ name: trimmed.slice(0, 24), color });
    router.push("/hub");
  };

  return (
    <main className="facet-field relative flex min-h-dvh flex-col items-center justify-center overflow-hidden">
      {/* drifting diagonal sheen */}
      <div
        aria-hidden
        className="rays pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ transform: "scale(1.5) rotate(0.001deg)" }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.4em] text-info-400">
          Welcome to
        </p>
        <h1 className="display-hero text-[16vw] leading-none text-paper-050 drop-shadow-[0_10px_30px_rgba(27,34,51,0.8)] md:text-9xl">
          Wander<span className="text-accent-500">park</span>
        </h1>
        <p className="mt-5 max-w-md text-base text-paper-050/80">
          Build the park of your dreams. Survive the business behind it.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4">
          <Button size="lg" onClick={enter} autoFocus>
            {profile ? `Enter as ${profile.name}` : "Enter the Park"}
          </Button>
          {hydrated && profile && (
            <button
              onClick={() => {
                setName(profile.name);
                setColor(profile.color);
                setCreating(true);
              }}
              className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-paper-050/50 transition-colors hover:text-accent-500"
            >
              Change profile
            </button>
          )}
        </div>
      </div>

      <footer className="absolute bottom-4 flex w-full items-center justify-between px-6 text-[11px] text-paper-050/40">
        <span>v0.1.0 — Phase 1</span>
        <span>Assets: CC0 by Kenney &amp; Kay Lousberg</span>
      </footer>

      <Modal
        open={creating}
        title="Your Mogul Card"
        onClose={() => setCreating(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={confirmProfile} disabled={!name.trim()}>
              Let&apos;s build
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-600">
          No account, no email — this stays in your browser and signs your future leaderboard
          entries.
        </p>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-600">
          Park mogul name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmProfile()}
          maxLength={24}
          placeholder="e.g. Greta Loopington"
          autoFocus
          className="mb-5 w-full border-2 border-ink-900/20 bg-paper-100 px-3 py-2.5 text-base font-semibold text-ink-900 outline-none focus:border-accent-500"
        />
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-600">
          Banner color
        </label>
        <div className="flex gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`color ${c}`}
              onClick={() => setColor(c)}
              className={`skewed h-9 w-9 cursor-pointer transition-transform ${
                color === c ? "scale-110 ring-4 ring-ink-900" : "hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Modal>
    </main>
  );
}
