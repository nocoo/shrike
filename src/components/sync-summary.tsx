"use client";

import { ChevronRight } from "lucide-react";
import type { SyncResult } from "@/lib/types";
import { formatHeader } from "@/components/sync-log";

interface SyncSummaryProps {
  result: SyncResult | null;
  error: string | null;
  onViewLog: () => void;
}

export function SyncSummary({ result, error, onViewLog }: SyncSummaryProps) {
  if (!result && !error) return null;

  return (
    <button
      type="button"
      onClick={onViewLog}
      className="flex w-full items-center justify-between border-t px-4 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <p className="text-[11px] font-medium">
        {error ? (
          <span className="text-destructive">{formatHeader(null, error)}</span>
        ) : (
          <span className="text-green-600 dark:text-green-400">
            {formatHeader(result, null)}
          </span>
        )}
      </p>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
