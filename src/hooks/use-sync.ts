"use client";

import { useCallback, useState } from "react";
import { triggerSync } from "@/lib/commands";
import type { SyncResult, SyncStatus } from "@/lib/types";

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setStatus("running");
    setError(null);
    try {
      const result = await triggerSync();
      setLastResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setStatus("idle");
    }
  }, []);

  return {
    status,
    lastResult,
    error,
    sync,
  };
}
