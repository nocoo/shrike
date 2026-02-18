"use client";

import { useState } from "react";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { SettingsPage } from "@/components/settings-page";
import { SyncButton } from "@/components/sync-button";
import { SyncLog } from "@/components/sync-log";
import { Toolbar } from "@/components/toolbar";
import { WizardPage } from "@/components/wizard-page";
import { useFileList } from "@/hooks/use-file-list";
import { useSync } from "@/hooks/use-sync";

type Page = "home" | "settings" | "wizard";

export default function Home() {
  const [page, setPage] = useState<Page>("home");
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

  if (page === "settings") {
    return <SettingsPage onBack={() => setPage("home")} />;
  }

  if (page === "wizard") {
    return (
      <WizardPage
        onBack={() => {
          refresh();
          setPage("home");
        }}
        onDone={() => {
          refresh();
          setPage("home");
        }}
      />
    );
  }

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col pt-[74px]" onContextMenu={(e) => e.preventDefault()}>
      <Toolbar
        entryCount={entries.length}
        onAdd={addViaDialog}
        onWizard={() => setPage("wizard")}
        onSettings={() => setPage("settings")}
      />

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
