"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteSave,
  exportSaveFile,
  importSaveFile,
  listSaves,
  loadSave,
  renameSave,
  type SaveSlotMeta,
} from "@/ui/saves";
import { SaveFormatError } from "@/sim/save/migrate";
import { formatMoney } from "@/ui/format";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { Button } from "@/ui/kit/Button";
import { Modal } from "@/ui/kit/Modal";
import { toast } from "@/ui/kit/Toast";

export function MyParksTab() {
  const router = useRouter();
  const [saves, setSaves] = useState<SaveSlotMeta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<SaveSlotMeta | null>(null);
  const [renaming, setRenaming] = useState<SaveSlotMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => setSaves(await listSaves()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onImport = async (file: File): Promise<void> => {
    try {
      const { save } = await importSaveFile(file);
      toast("success", `Imported "${save.meta.name}" — welcome back!`);
      await refresh();
    } catch (err) {
      toast("danger", err instanceof SaveFormatError ? err.message : "Import failed");
    }
  };

  const onExport = async (meta: SaveSlotMeta): Promise<void> => {
    const save = await loadSave(meta.id);
    if (save) exportSaveFile(save);
  };

  return (
    <div
      className="mx-auto max-w-4xl"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void onImport(file);
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <HeroHeader title="My Parks" chip={`${saves.length} saved`} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            Import .wanderpark
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        {saves.length === 0 && (
          <p className="text-paper-050/60">
            No parks saved yet — found one under <b>New Park</b>, or drop a{" "}
            <code>.wanderpark.json</code> anywhere on this screen.
          </p>
        )}
        {saves.map((meta) => (
          <div key={meta.id} className="skewed panel-shadow flex items-stretch bg-paper-050">
            <div className="w-2 shrink-0 bg-card-blue" aria-hidden />
            <div className="unskew flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
              <div className="min-w-40 flex-1">
                <div className="display-hero text-xl not-italic text-ink-900">{meta.name}</div>
                <div className="text-xs text-ink-600">
                  Day {meta.day} · {formatMoney(meta.cash)} · {meta.mapSize} ·{" "}
                  <span className="capitalize">{meta.difficulty}</span> ·{" "}
                  {new Date(meta.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => router.push(`/play?id=${meta.id}`)}>
                  Play
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="!text-ink-900"
                  onClick={() => {
                    setRenaming(meta);
                    setRenameValue(meta.name);
                  }}
                >
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="!text-ink-900"
                  onClick={() => void onExport(meta)}
                >
                  Export
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(meta)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={confirmDelete !== null}
        title="Demolish this park?"
        onClose={() => setConfirmDelete(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  void deleteSave(confirmDelete.id).then(() => {
                    toast("info", `"${confirmDelete.name}" was deleted.`);
                    setConfirmDelete(null);
                    void refresh();
                  });
                }
              }}
            >
              Delete forever
            </Button>
          </>
        }
      >
        <p>
          <b>{confirmDelete?.name}</b> (Day {confirmDelete?.day}) will be gone for good. Export it
          first if you might miss it.
        </p>
      </Modal>

      <Modal
        open={renaming !== null}
        title="Rename park"
        onClose={() => setRenaming(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim()}
              onClick={() => {
                if (renaming && renameValue.trim()) {
                  void renameSave(renaming.id, renameValue.trim().slice(0, 40)).then(() => {
                    setRenaming(null);
                    void refresh();
                  });
                }
              }}
            >
              Save name
            </Button>
          </>
        }
      >
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          maxLength={40}
          autoFocus
          className="w-full border-2 border-ink-900/20 bg-paper-100 px-3 py-2.5 text-base font-semibold text-ink-900 outline-none focus:border-accent-500"
        />
      </Modal>
    </div>
  );
}
