"use client";

import { useState } from "react";
import { AboutPage } from "@/components/about-page";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { SettingsPage } from "@/components/settings-page";
import { SyncButton } from "@/components/sync-button";
import { SyncLogPage } from "@/components/sync-log";
import { SyncSummary } from "@/components/sync-summary";
import { Toolbar } from "@/components/toolbar";
import { WizardPage } from "@/components/wizard-page";
import { useFileList } from "@/hooks/use-file-list";
import { useSync } from "@/hooks/use-sync";

type Page = "home" | "settings" | "wizard" | "about" | "sync-log";

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

  if (page === "about") {
    return <AboutPage onBack={() => setPage("home")} />;
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

  if (page === "sync-log") {
    return (
      <SyncLogPage
        result={lastResult}
        error={error}
        onBack={() => setPage("home")}
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
        onAddFiles={() => addViaDialog(false)}
        onAddFolders={() => addViaDialog(true)}
        onWizard={() => setPage("wizard")}
        onSettings={() => setPage("settings")}
        onAbout={() => setPage("about")}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {entries.length > 0 ? (
          <FileList entries={entries} onRemove={remove} />
        ) : (
          <DropZone isDragging={false} hasEntries={false} />
        )}
      </div>

      <DropZone isDragging={isDragging} hasEntries={entries.length > 0} />

      <SyncSummary
        result={lastResult}
        error={error}
        onViewLog={() => setPage("sync-log")}
      />

      <SyncButton
        status={status}
        disabled={entries.length === 0}
        onSync={handleSync}
      />
    </main>
  );
}
