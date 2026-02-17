"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { SyncButton } from "@/components/sync-button";
import { SyncLog } from "@/components/sync-log";
import { SettingsDialog } from "@/components/settings-dialog";
import { useFileList } from "@/hooks/use-file-list";
import { useSync } from "@/hooks/use-sync";

export default function Home() {
  const { entries, loading, isDragging, remove, refresh } = useFileList();
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
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Shrike</CardTitle>
          <SettingsDialog />
        </CardHeader>
        <CardContent className="space-y-4">
          <DropZone isDragging={isDragging} hasEntries={entries.length > 0} />
          <FileList entries={entries} onRemove={remove} />
          <SyncButton
            status={status}
            disabled={entries.length === 0}
            onSync={handleSync}
          />
          <SyncLog result={lastResult} error={error} />
        </CardContent>
      </Card>
    </main>
  );
}
