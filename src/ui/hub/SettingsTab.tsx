"use client";

import { useEffect, useState } from "react";
import {
  KEY_ACTION_LABELS,
  useAppStore,
  type KeyAction,
} from "@/ui/stores/appStore";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { Button } from "@/ui/kit/Button";
import { Slider } from "@/ui/kit/Slider";
import { Toggle } from "@/ui/kit/Toggle";
import { toast } from "@/ui/kit/Toast";

const keyLabel = (key: string): string => (key === " " ? "Space" : key.toUpperCase());

function KeymapEditor() {
  const keymap = useAppStore((s) => s.keymap);
  const rebindKey = useAppStore((s) => s.rebindKey);
  const resetKeymap = useAppStore((s) => s.resetKeymap);
  const [listening, setListening] = useState<KeyAction | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key !== "Escape") {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        rebindKey(listening, key);
        toast("success", `${KEY_ACTION_LABELS[listening]} → ${keyLabel(key)}`);
      }
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [listening, rebindKey]);

  return (
    <div className="flex flex-col gap-1.5">
      {(Object.keys(KEY_ACTION_LABELS) as KeyAction[]).map((action) => (
        <div key={action} className="flex items-center justify-between bg-paper-100 px-3 py-1.5">
          <span className="text-xs font-semibold text-ink-900">{KEY_ACTION_LABELS[action]}</span>
          <button
            onClick={() => setListening(listening === action ? null : action)}
            className={`min-w-20 cursor-pointer px-2.5 py-1 text-center text-xs font-bold uppercase ${
              listening === action
                ? "animate-pulse bg-accent-500 text-ink-900"
                : "bg-ink-900 text-paper-050 hover:bg-ink-700"
            }`}
          >
            {listening === action ? "Press a key…" : keyLabel(keymap[action])}
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          resetKeymap();
          toast("info", "Keys restored to defaults.");
        }}
        className="self-start text-[11px] font-bold uppercase tracking-wide text-ink-600 hover:text-ink-900"
      >
        Reset keys
      </button>
    </div>
  );
}

export function SettingsTab() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);

  // (Live application happens globally in ui/GlobalSettings.tsx.)

  return (
    <div className="mx-auto max-w-3xl">
      <HeroHeader title="Settings" />
      <div className="mt-10 flex flex-col gap-8">
        <Section title="Video & Interface">
          <Slider
            label="UI scale"
            value={Math.round(settings.uiScale * 100)}
            min={90}
            max={140}
            step={5}
            onChange={(v) => updateSettings({ uiScale: v / 100 })}
            format={(v) => `${v}%`}
          />
          <Toggle
            label="Reduced motion"
            hint="Minimizes shakes, particles and parallax"
            checked={settings.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
          />
          <Toggle
            label="Reduced flash"
            hint="No fireworks or bright bursts"
            checked={settings.reducedFlash}
            onChange={(v) => updateSettings({ reducedFlash: v })}
          />
          <Toggle
            label="Colorblind-safe statuses"
            hint="Blue = good, orange = trouble (instead of green/red)"
            checked={settings.colorblind}
            onChange={(v) => updateSettings({ colorblind: v })}
          />
          <Toggle
            label="Dyslexia-friendlier font"
            hint="Atkinson Hyperlegible for body text"
            checked={settings.dyslexiaFont}
            onChange={(v) => updateSettings({ dyslexiaFont: v })}
          />
          <Toggle
            label="FPS overlay"
            hint="Also toggled in-game with F3"
            checked={settings.showFps}
            onChange={(v) => updateSettings({ showFps: v })}
          />
        </Section>

        <Section title="Audio" note="Music, effects and the crowd share three faders.">
          <Slider
            label="Master volume"
            value={settings.masterVolume}
            min={0}
            max={100}
            onChange={(v) => updateSettings({ masterVolume: v })}
            format={(v) => `${v}%`}
          />
          <Slider
            label="Music"
            value={settings.musicVolume}
            min={0}
            max={100}
            onChange={(v) => updateSettings({ musicVolume: v })}
            format={(v) => `${v}%`}
          />
          <Slider
            label="Effects"
            value={settings.sfxVolume}
            min={0}
            max={100}
            onChange={(v) => updateSettings({ sfxVolume: v })}
            format={(v) => `${v}%`}
          />
        </Section>

        <Section title="Controls">
          <Toggle
            label="Edge panning"
            hint="Pan the camera when the cursor touches a screen edge"
            checked={settings.edgePan}
            onChange={(v) => updateSettings({ edgePan: v })}
          />
          <Toggle
            label="Invert zoom"
            checked={settings.invertZoom}
            onChange={(v) => updateSettings({ invertZoom: v })}
          />
          <KeymapEditor />
          <div className="bg-paper-100 px-4 py-3 text-xs text-ink-600">
            <b className="text-ink-900">Fixed keys:</b> WASD pan · Q/E rotate camera · Wheel zoom ·
            Del bulldoze · Z / Shift+Z undo/redo · Esc back · F3 fps · coaster drafting W/A/D/R/F/L.
          </div>
        </Section>

        <div>
          <Button
            variant="secondary"
            onClick={() => {
              resetSettings();
              toast("info", "Settings restored to defaults.");
            }}
          >
            Restore defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-paper-050/70">
        {title}
        {note && <span className="ml-3 normal-case tracking-normal text-paper-050/40">{note}</span>}
      </h3>
      <div className="skewed overflow-hidden bg-paper-050">
        <div className="unskew flex flex-col gap-px">{children}</div>
      </div>
    </section>
  );
}
