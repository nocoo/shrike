"use client";

import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { SyncButton } from "@/components/sync-button";
import { SyncLog } from "@/components/sync-log";
import { Toolbar } from "@/components/toolbar";
import { useFileList } from "@/hooks/use-file-list";
import { useSync } from "@/hooks/use-sync";

export default function Home() {
  const { entries, loading, isDragging, addViaDialog, remove, refresh } =
    useFileList();
  const { status, lastResult, error, sync } = useSync();

  const handleSync = async () => {
    try {
      await sync();
      await refresh();
    } catch {
      // error is already captured in useSync
    }
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col pt-[74px]" onContextMenu={(e) => e.preventDefault()}>
      <Toolbar entryCount={entries.length} onAdd={addViaDialog} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {entries.length > 0 ? (
          <FileList entries={entries} onRemove={remove} />
        ) : (
          <DropZone isDragging={false} hasEntries={false} />
        )}
      </div>

      <DropZone isDragging={isDragging} hasEntries={entries.length > 0} />

      {(lastResult || error) && (
        <div className="border-t px-4 py-2">
          <SyncLog result={lastResult} error={error} />
        </div>
      )}

      <SyncButton
        status={status}
        disabled={entries.length === 0}
        onSync={handleSync}
      />
    </main>
  );
}
