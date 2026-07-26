"use client";

/**
 * AudioBus v1 — fully procedural WebAudio SFX (no audio assets needed yet;
 * sourced CC0 packs arrive with the Phase-4 music pass — ASSET_GUIDE §5).
 * Family-friendly synth bloops: UI taps, placement thunks, coin clinks,
 * error boings, milestone fanfares, and a crowd-walla noise bed that scales
 * with guest density (the park *sounds* like its rating — UI_UX §11).
 */

import { useAppStore } from "@/ui/stores/appStore";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let wallaGain: GainNode | null = null;
let wallaStarted = false;
let lastClinkAt = 0;
const unlockHooks: Array<() => void> = [];

function ensureContext(): boolean {
  if (typeof window === "undefined") return false;
  if (ctx) return true;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.connect(master);
    applyVolumes();
    return true;
  } catch {
    return false;
  }
}

export function applyVolumes(): void {
  if (!ctx || !master || !sfxGain || !musicGain) return;
  const { masterVolume, sfxVolume, musicVolume } = useAppStore.getState().settings;
  master.gain.value = (masterVolume / 100) * 0.8;
  sfxGain.gain.value = sfxVolume / 100;
  musicGain.gain.value = (musicVolume / 100) * 0.55;
}

/** Call from a user-gesture handler once; browsers require it. */
export function unlockAudio(): void {
  if (!ensureContext()) return;
  if (ctx && ctx.state === "suspended") void ctx.resume();
  startWalla();
  for (const hook of unlockHooks.splice(0)) hook();
}

/** Music engine hookup: runs now if unlocked, else on first gesture. */
export function onAudioUnlocked(hook: () => void): void {
  if (ctx && ctx.state === "running") hook();
  else unlockHooks.push(hook);
}

export function musicBus(): { ctx: AudioContext; out: GainNode } | null {
  if (!ctx || !musicGain) return null;
  return { ctx, out: musicGain };
}

function tone(
  freq: number,
  durationSec: number,
  type: OscillatorType,
  volume: number,
  delaySec = 0,
  freqEnd?: number,
): void {
  if (!ctx || !sfxGain) return;
  const t0 = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + durationSec);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
  osc.connect(gain).connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

export const sfx = {
  tap(): void {
    if (!ensureContext()) return;
    tone(660, 0.05, "square", 0.06);
  },
  thunk(): void {
    if (!ensureContext()) return;
    tone(180, 0.12, "sine", 0.3, 0, 90);
    tone(90, 0.16, "triangle", 0.18, 0.01);
  },
  clink(): void {
    if (!ensureContext() || !ctx) return;
    // Rate-limit: crowds of sales become a gentle shimmer, not a siren.
    if (ctx.currentTime - lastClinkAt < 0.09) return;
    lastClinkAt = ctx.currentTime;
    tone(1568, 0.09, "triangle", 0.12);
    tone(2093, 0.14, "triangle", 0.08, 0.03);
  },
  boing(): void {
    if (!ensureContext()) return;
    tone(280, 0.22, "sawtooth", 0.1, 0, 140);
  },
  fanfare(): void {
    if (!ensureContext()) return;
    tone(523, 0.16, "square", 0.12);
    tone(659, 0.16, "square", 0.12, 0.13);
    tone(784, 0.3, "square", 0.14, 0.26);
    tone(1046, 0.42, "triangle", 0.12, 0.39);
  },
  /** Firework crackle: short noise-ish burst via detuned saws. */
  pop(): void {
    if (!ensureContext()) return;
    tone(900, 0.07, "sawtooth", 0.07, 0, 220);
    tone(1400, 0.05, "square", 0.05, 0.01, 500);
  },
  /** Gentle two-note chime (zones, goals). */
  chime(): void {
    if (!ensureContext()) return;
    tone(1318, 0.22, "sine", 0.1);
    tone(1760, 0.34, "sine", 0.09, 0.12);
  },
  /** Camera / photo shutter-ish whoosh. */
  whoosh(): void {
    if (!ensureContext()) return;
    tone(320, 0.18, "triangle", 0.08, 0, 900);
  },
};

/** Brown-noise walla bed; call setWallaLevel with guest density 0..1. */
function startWalla(): void {
  if (!ctx || !master || wallaStarted) return;
  wallaStarted = true;
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1; // render-side noise, not sim
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 620;
  filter.Q.value = 0.6;
  wallaGain = ctx.createGain();
  wallaGain.gain.value = 0;
  source.connect(filter).connect(wallaGain).connect(master);
  source.start();
}

export function setWallaLevel(density01: number): void {
  if (!wallaGain || !ctx) return;
  // Walla rides the SFX fader — music got its own channel in Phase 4.
  const { sfxVolume } = useAppStore.getState().settings;
  const target = Math.min(0.16, density01 * 0.16) * (sfxVolume / 100);
  wallaGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.6);
}
