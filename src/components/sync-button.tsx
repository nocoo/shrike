"use client";

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncStatus } from "@/lib/types";

interface SyncButtonProps {
  status: SyncStatus;
  disabled: boolean;
  onSync: () => void;
}

export function SyncButton({ status, disabled, onSync }: SyncButtonProps) {
  const isRunning = status === "running";

  return (
    <div className="border-t px-4 py-3">
      <Button
        onClick={onSync}
        disabled={disabled || isRunning}
        size="sm"
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <Play className="mr-2 h-3.5 w-3.5" />
            Sync Now
          </>
        )}
      </Button>
    </div>
  );
}
