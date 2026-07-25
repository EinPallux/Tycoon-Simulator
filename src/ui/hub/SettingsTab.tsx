"use client";

import { useEffect } from "react";
import { useAppStore } from "@/ui/stores/appStore";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { Button } from "@/ui/kit/Button";
import { Slider } from "@/ui/kit/Slider";
import { Toggle } from "@/ui/kit/Toggle";
import { toast } from "@/ui/kit/Toast";

export function SettingsTab() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);

  // Apply live-effect settings to the document.
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
    document.documentElement.style.fontSize = `${16 * settings.uiScale}px`;
  }, [settings.reducedMotion, settings.uiScale]);

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
            hint="Minimizes shakes, wipes and parallax"
            checked={settings.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
          />
          <Toggle
            label="FPS overlay"
            hint="Also toggled in-game with F3"
            checked={settings.showFps}
            onChange={(v) => updateSettings({ showFps: v })}
          />
        </Section>

        <Section title="Audio" note="The audio engine arrives in Phase 2 — levels are saved now.">
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
          <div className="bg-paper-100 px-4 py-3 text-xs text-ink-600">
            <b className="text-ink-900">Keys:</b> WASD pan · Q/E rotate · Wheel zoom · Space pause ·
            1/2/3 speed · B build · R rotate piece · Del bulldoze · Z / Shift+Z undo/redo · Esc back
            — remapping arrives in Phase 4.
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
