"use client";

/**
 * Park save-slot service (TECHNICAL_ARCHITECTURE.md §9).
 * IndexedDB via idb-keyval: one key per slot + an index record.
 * Wall-clock metadata lives HERE (UI layer) — the sim itself never
 * touches Date.
 */

import { del, get, set } from "idb-keyval";
import type { SaveFile } from "@/sim/save/schema";
import { migrateSave, SaveFormatError } from "@/sim/save/migrate";
import { dayOfTime } from "@/sim/world/time";

export interface SaveSlotMeta {
  id: string;
  name: string;
  updatedAt: number; // wall-clock ms
  day: number;
  cash: number;
  mapSize: string;
  difficulty: string;
}

const INDEX_KEY = "wanderpark.saves.index";
const slotKey = (id: string): string => `wanderpark.save.${id}`;

export async function listSaves(): Promise<SaveSlotMeta[]> {
  const index = (await get<SaveSlotMeta[]>(INDEX_KEY)) ?? [];
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadSave(id: string): Promise<SaveFile | undefined> {
  const raw = await get<unknown>(slotKey(id));
  if (raw === undefined) return undefined;
  return migrateSave(raw);
}

export async function storeSave(id: string, save: SaveFile, day: number): Promise<void> {
  await set(slotKey(id), save);
  const index = (await get<SaveSlotMeta[]>(INDEX_KEY)) ?? [];
  const meta: SaveSlotMeta = {
    id,
    name: save.meta.name,
    updatedAt: Date.now(),
    day,
    cash: save.cash,
    mapSize: save.meta.mapSize,
    difficulty: save.meta.difficulty,
  };
  const next = [meta, ...index.filter((m) => m.id !== id)];
  await set(INDEX_KEY, next);
}

export async function deleteSave(id: string): Promise<void> {
  await del(slotKey(id));
  const index = (await get<SaveSlotMeta[]>(INDEX_KEY)) ?? [];
  await set(
    INDEX_KEY,
    index.filter((m) => m.id !== id),
  );
}

export async function renameSave(id: string, name: string): Promise<void> {
  const save = await loadSave(id);
  if (!save) return;
  save.meta.name = name;
  const index = (await get<SaveSlotMeta[]>(INDEX_KEY)) ?? [];
  const meta = index.find((m) => m.id === id);
  await set(slotKey(id), save);
  if (meta) {
    meta.name = name;
    await set(INDEX_KEY, index);
  }
}

export function newSaveId(): string {
  return `park-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Export / import (.wanderpark.json) ───────────────────────────────────

export function exportSaveFile(save: SaveFile): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${save.meta.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "park"}.wanderpark.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSaveFile(file: File): Promise<{ id: string; save: SaveFile }> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveFormatError("That file isn't valid JSON");
  }
  const save = migrateSave(parsed); // throws SaveFormatError with a friendly message
  const id = newSaveId();
  await storeSave(id, save, dayOfTime(save.time));
  return { id, save };
}
