"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { SyncResult } from "@/lib/types";

interface SyncLogProps {
  result: SyncResult | null;
  error: string | null;
}

export function SyncLog({ result, error }: SyncLogProps) {
  if (!result && !error) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
        Last sync{" "}
        {error ? (
          <span className="text-destructive">failed</span>
        ) : (
          <span className="text-green-600 dark:text-green-400">
            succeeded ({result?.files_transferred} files)
          </span>
        )}
      </p>
      <ScrollArea className="h-[120px]">
        <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground">
          {error || result?.stdout || "No output"}
        </pre>
        {result?.stderr && (
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-destructive">
            {result.stderr}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}
