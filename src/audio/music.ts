"use client";

/**
 * Music v2 — a fully procedural chip-orchestra (documented deviation from
 * "sourced CC0 packs" in ASSET_GUIDE §5: zero assets, zero licenses, tiny
 * footprint, and the mood system stays perfectly reactive).
 *
 * Four moods: menu (calm arps), day (bright plucks), night (slow pads),
 * storm (minor urgency). A 16-step scheduler walks pentatonic patterns from
 * a per-mood seeded PRNG — render-side randomness, never the sim's.
 */

import { musicBus, onAudioUnlocked } from "./bus";

export type MusicMood = "menu" | "day" | "night" | "storm";

interface MoodSpec {
  bpm: number;
  /** Semitone offsets of the scale (from the root). */
  scale: number[];
  /** Root frequencies cycled per bar (I–vi–IV–V feel). */
  roots: number[];
  lead: OscillatorType;
  leadVol: number;
  /** Probability a step plays a lead note. */
  density: number;
  pad: boolean;
  seed: number;
}

const MOODS: Record<MusicMood, MoodSpec> = {
  menu: {
    bpm: 84,
    scale: [0, 2, 4, 7, 9, 12, 14],
    roots: [130.81, 110.0, 87.31, 98.0],
    lead: "triangle",
    leadVol: 0.09,
    density: 0.55,
    pad: true,
    seed: 11,
  },
  day: {
    bpm: 112,
    scale: [0, 2, 4, 7, 9, 12, 16],
    roots: [130.81, 98.0, 110.0, 146.83],
    lead: "square",
    leadVol: 0.055,
    density: 0.7,
    pad: false,
    seed: 22,
  },
  night: {
    bpm: 72,
    scale: [0, 3, 5, 7, 10, 12],
    roots: [110.0, 87.31, 98.0, 82.41],
    lead: "sine",
    leadVol: 0.08,
    density: 0.35,
    pad: true,
    seed: 33,
  },
  storm: {
    bpm: 104,
    scale: [0, 3, 5, 7, 8, 12],
    roots: [110.0, 103.83, 87.31, 98.0],
    lead: "sawtooth",
    leadVol: 0.045,
    density: 0.6,
    pad: true,
    seed: 44,
  },
};

let currentMood: MusicMood | null = null;
let pendingMood: MusicMood | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextNoteAt = 0;
let step = 0;
let rngState = 1;
let moodGain: GainNode | null = null;
let hookArmed = false;

const rand = (): number => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0xffffffff;
};

function note(
  ctx: AudioContext,
  out: GainNode,
  freq: number,
  at: number,
  duration: number,
  type: OscillatorType,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function scheduleSteps(): void {
  const bus = musicBus();
  if (!bus || !currentMood || !moodGain) return;
  const spec = MOODS[currentMood];
  const stepSec = 60 / spec.bpm / 2; // eighth notes
  const { ctx } = bus;
  while (nextNoteAt < ctx.currentTime + 0.35) {
    const bar = Math.floor(step / 16) % spec.roots.length;
    const root = spec.roots[bar] as number;
    const inBar = step % 16;

    // Bass on the 1 and 3.
    if (inBar % 8 === 0) {
      note(ctx, moodGain, root, nextNoteAt, stepSec * 6, "triangle", 0.11);
    }
    // Pad: one soft fifth per bar.
    if (spec.pad && inBar === 0) {
      note(ctx, moodGain, root * 2, nextNoteAt, stepSec * 15, "sine", 0.05);
      note(ctx, moodGain, root * 3, nextNoteAt, stepSec * 15, "sine", 0.035);
    }
    // Lead: seeded random walk over the scale.
    if (rand() < spec.density) {
      const degree = spec.scale[Math.floor(rand() * spec.scale.length)] as number;
      const octave = rand() < 0.25 ? 8 : 4;
      const freq = root * octave * Math.pow(2, degree / 12);
      note(ctx, moodGain, freq, nextNoteAt, stepSec * (rand() < 0.3 ? 2.6 : 1.2), spec.lead, spec.leadVol);
    }
    nextNoteAt += stepSec;
    step++;
  }
}

function startEngine(mood: MusicMood): void {
  const bus = musicBus();
  if (!bus) return;
  const { ctx, out } = bus;
  if (!moodGain) {
    moodGain = ctx.createGain();
    moodGain.connect(out);
  }
  currentMood = mood;
  rngState = MOODS[mood].seed;
  step = 0;
  nextNoteAt = Math.max(nextNoteAt, ctx.currentTime + 0.1);
  moodGain.gain.cancelScheduledValues(ctx.currentTime);
  moodGain.gain.setValueAtTime(moodGain.gain.value, ctx.currentTime);
  moodGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.4);
  if (!timer) timer = setInterval(scheduleSteps, 110);
}

/** Switch the soundtrack mood (null = fade out and stop). */
export function setMusicMood(mood: MusicMood | null): void {
  if (mood === currentMood && mood !== null) return;
  const bus = musicBus();
  if (!bus) {
    // Audio not unlocked yet — start as soon as the first gesture lands.
    pendingMood = mood;
    if (!hookArmed) {
      hookArmed = true;
      onAudioUnlocked(() => {
        if (pendingMood) setMusicMood(pendingMood);
      });
    }
    return;
  }
  const { ctx } = bus;
  if (mood === null) {
    currentMood = null;
    if (moodGain) {
      moodGain.gain.cancelScheduledValues(ctx.currentTime);
      moodGain.gain.setValueAtTime(moodGain.gain.value, ctx.currentTime);
      moodGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    }
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    return;
  }
  // Crossfade: dip, swap pattern, swell.
  if (moodGain && currentMood) {
    moodGain.gain.cancelScheduledValues(ctx.currentTime);
    moodGain.gain.setValueAtTime(moodGain.gain.value, ctx.currentTime);
    moodGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.8);
  }
  startEngine(mood);
}
