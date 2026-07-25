/**
 * Save migration chain (TECHNICAL_ARCHITECTURE.md §9).
 * Each entry upgrades formatVersion N → N+1. The loader walks the chain,
 * then validates against the latest schema. Every migration ships with a
 * fixture test in __tests__/.
 */

import { CURRENT_FORMAT_VERSION, saveV1Schema, type SaveFile } from "./schema";

type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version the migration upgrades FROM. */
const MIGRATIONS: Record<number, Migration> = {
  // Example shape for the future:
  // 1: (save) => ({ ...save, formatVersion: 2, newField: defaultValue }),
};

export class SaveFormatError extends Error {}

export function migrateSave(raw: unknown): SaveFile {
  if (typeof raw !== "object" || raw === null) {
    throw new SaveFormatError("Save file is not an object");
  }
  let save = raw as Record<string, unknown>;
  let version = save.formatVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new SaveFormatError("Save file has no valid formatVersion");
  }
  if (version > CURRENT_FORMAT_VERSION) {
    throw new SaveFormatError(
      `Save is from a newer version of the game (v${version} > v${CURRENT_FORMAT_VERSION})`,
    );
  }
  while (version < CURRENT_FORMAT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveFormatError(`No migration path from save version ${version}`);
    save = step(save);
    const next = save.formatVersion;
    if (next !== version + 1) {
      throw new SaveFormatError(`Migration from v${version} produced v${String(next)}`);
    }
    version = next;
  }
  const parsed = saveV1Schema.safeParse(save);
  if (!parsed.success) {
    throw new SaveFormatError(`Save failed validation: ${parsed.error.issues[0]?.message ?? "?"}`);
  }
  return parsed.data;
}
