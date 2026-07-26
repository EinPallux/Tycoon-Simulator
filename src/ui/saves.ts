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
const backupKey = (id: string, n: number): string => `wanderpark.save.${id}.auto${n}`;
/** Rolling autosaves kept per park (TECHNICAL_ARCHITECTURE.md §9). */
export const BACKUP_DEPTH = 3;

/** FNV-1a over the serialized payload — cheap corruption tripwire. */
function checksumOf(save: SaveFile): number {
  const text = JSON.stringify(save);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface StoredEnvelope {
  save: SaveFile;
  checksum: number;
}

const isEnvelope = (raw: unknown): raw is StoredEnvelope =>
  typeof raw === "object" && raw !== null && "save" in raw && "checksum" in raw;

/** Unwrap + verify a stored record (legacy bare saves pass through). */
function openEnvelope(raw: unknown): { save: unknown; intact: boolean } {
  if (isEnvelope(raw)) {
    return { save: raw.save, intact: checksumOf(raw.save) === raw.checksum };
  }
  return { save: raw, intact: true }; // pre-1.0 record without a checksum
}

export async function listSaves(): Promise<SaveSlotMeta[]> {
  const index = (await get<SaveSlotMeta[]>(INDEX_KEY)) ?? [];
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadSave(id: string): Promise<SaveFile | undefined> {
  const raw = await get<unknown>(slotKey(id));
  if (raw === undefined) return undefined;
  const { save, intact } = openEnvelope(raw);
  if (!intact) throw new SaveFormatError("Save data failed its checksum (corrupted?)");
  return migrateSave(save);
}

/**
 * Recovery ladder: latest slot → auto1 → auto2 → auto3. Returns the first
 * record that verifies AND migrates, tagged with where it came from
 * (null = the main slot was fine; N = recovered from N saves ago).
 */
export async function loadSaveWithRecovery(
  id: string,
): Promise<{ save: SaveFile; recoveredFrom: number | null } | undefined> {
  const candidates: Array<{ key: string; from: number | null }> = [{ key: slotKey(id), from: null }];
  for (let n = 1; n <= BACKUP_DEPTH; n++) candidates.push({ key: backupKey(id, n), from: n });
  for (const candidate of candidates) {
    const raw = await get<unknown>(candidate.key);
    if (raw === undefined) continue;
    try {
      const { save, intact } = openEnvelope(raw);
      if (!intact) continue;
      return { save: migrateSave(save), recoveredFrom: candidate.from };
    } catch {
      continue; // corrupted or unmigratable — try the next rung
    }
  }
  return undefined;
}

export async function storeSave(id: string, save: SaveFile, day: number): Promise<void> {
  // Write-then-swap, emulated for IndexedDB: rotate the previous good copy
  // into the autosave ladder BEFORE overwriting the main slot — the newest
  // record is never the only copy.
  const previous = await get<unknown>(slotKey(id));
  if (previous !== undefined) {
    for (let n = BACKUP_DEPTH - 1; n >= 1; n--) {
      const older = await get<unknown>(backupKey(id, n));
      if (older !== undefined) await set(backupKey(id, n + 1), older);
    }
    await set(backupKey(id, 1), previous);
  }
  await set(slotKey(id), { save, checksum: checksumOf(save) } satisfies StoredEnvelope);
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
  for (let n = 1; n <= BACKUP_DEPTH; n++) await del(backupKey(id, n));
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
  await storeSave(id, save, dayOfTime(save.time)); // re-indexes with the new name
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
