"use client";

import { useCallback, useEffect, useState } from "react";
import { listen, TauriEvent } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { addEntry, listEntries, removeEntry } from "@/lib/commands";
import { useLocale, formatDialogTitle } from "@/lib/i18n";
import type { BackupEntry } from "@/lib/types";

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

export function useFileList() {
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const { t, locale } = useLocale();

  // Load entries on mount
  useEffect(() => {
    listEntries()
      .then(setEntries)
      .catch(() => toast.error(t("error.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  // Listen for Tauri drag-drop events
  useEffect(() => {
    const unlistenEnter = listen<DragDropPayload>(TauriEvent.DRAG_ENTER, () =>
      setIsDragging(true)
    );
    const unlistenLeave = listen(TauriEvent.DRAG_LEAVE, () =>
      setIsDragging(false)
    );
    const unlistenDrop = listen<DragDropPayload>(
      TauriEvent.DRAG_DROP,
      async (event) => {
        setIsDragging(false);
        for (const path of event.payload.paths) {
          try {
            const entry = await addEntry(path);
            setEntries((prev) => [...prev, entry]);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`${t("error.addFailed")}: ${msg}`);
          }
        }
      }
    );

    return () => {
      unlistenEnter.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
      unlistenDrop.then((fn) => fn());
    };
  }, [t]);

  // Open native file picker to add files or folders
  const addViaDialog = useCallback(
    async (directory: boolean) => {
      const selected = await open({
        multiple: true,
        directory,
        title: formatDialogTitle(directory, locale),
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      for (const path of paths) {
        try {
          const entry = await addEntry(path);
          setEntries((prev) => [...prev, entry]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`${t("error.addFailed")}: ${msg}`);
        }
      }
    },
    [locale, t]
  );

  const remove = useCallback(async (id: string) => {
    await removeEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    const items = await listEntries();
    setEntries(items);
  }, []);

  return {
    entries,
    loading,
    isDragging,
    addViaDialog,
    remove,
    refresh,
  };
}
