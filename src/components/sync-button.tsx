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
    <Button
      onClick={onSync}
      disabled={disabled || isRunning}
      className="w-full"
    >
      {isRunning ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Sync Now
        </>
      )}
    </Button>
  );
}
