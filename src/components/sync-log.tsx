"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SyncResult } from "@/lib/types";

interface SyncLogPageProps {
  result: SyncResult | null;
  error: string | null;
  onBack: () => void;
}

/** Format the sync result header line. */
function formatHeader(result: SyncResult | null, error: string | null): string {
  if (error) return "Sync failed";
  if (!result) return "No sync result";
  const parts: string[] = [];
  if (result.files_transferred > 0) {
    parts.push(
      `${result.files_transferred} ${result.files_transferred === 1 ? "file" : "files"}`,
    );
  }
  if (result.dirs_transferred > 0) {
    parts.push(
      `${result.dirs_transferred} ${result.dirs_transferred === 1 ? "dir" : "dirs"}`,
    );
  }
  if (parts.length === 0) return "Synced (no changes)";
  return `Synced ${parts.join(", ")}`;
}

export function SyncLogPage({ result, error, onBack }: SyncLogPageProps) {
  return (
    <div
      className="flex h-screen flex-col pt-[74px]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header with back button */}
      <header
        data-tauri-drag-region
        className="fixed top-0 right-0 left-0 z-50 border-b bg-background"
      >
        <div data-tauri-drag-region className="h-[38px]" />
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-4 pb-3"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">Sync Log</h1>
        </div>
      </header>

      {/* Summary line */}
      <div className="border-b px-4 py-2">
        <p className="text-sm font-medium">
          {error ? (
            <span className="text-destructive">{formatHeader(null, error)}</span>
          ) : (
            <span className="text-green-600 dark:text-green-400">
              {formatHeader(result, null)}
            </span>
          )}
        </p>
      </div>

      {/* Log output */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground">
            {error || result?.stdout || "No output"}
          </pre>
          {result?.stderr && (
            <pre className="mt-3 whitespace-pre-wrap text-[11px] text-destructive">
              {result.stderr}
            </pre>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { formatHeader };
