"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Search, Loader2, Check, FolderCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanCodingConfigs, addEntry } from "@/lib/commands";
import type { DetectedConfig } from "@/lib/types";

interface WizardPageProps {
  onBack: () => void;
  onDone: () => void;
}

type ScanState = "idle" | "scanning" | "done";

interface ConfigItem extends DetectedConfig {
  selected: boolean;
  added: boolean;
  error: string | null;
}

export function WizardPage({ onBack, onDone }: WizardPageProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [adding, setAdding] = useState(false);

  const handleScan = useCallback(async () => {
    setScanState("scanning");
    try {
      const detected = await scanCodingConfigs();
      setConfigs(
        detected.map((c) => ({ ...c, selected: true, added: false, error: null }))
      );
    } catch (err) {
      console.error("Scan failed:", err);
      setConfigs([]);
    } finally {
      setScanState("done");
    }
  }, []);

  useEffect(() => {
    handleScan();
  }, [handleScan]);

  const toggleItem = (path: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.path === path ? { ...c, selected: !c.selected } : c
      )
    );
  };

  const toggleAll = () => {
    const allSelected = configs.every((c) => c.selected || c.added);
    setConfigs((prev) =>
      prev.map((c) => (c.added ? c : { ...c, selected: !allSelected }))
    );
  };

  const handleAdd = async () => {
    setAdding(true);
    const toAdd = configs.filter((c) => c.selected && !c.added);

    for (const config of toAdd) {
      try {
        await addEntry(config.path);
        setConfigs((prev) =>
          prev.map((c) =>
            c.path === config.path
              ? { ...c, added: true, selected: false, error: null }
              : c
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setConfigs((prev) =>
          prev.map((c) =>
            c.path === config.path ? { ...c, error: msg } : c
          )
        );
      }
    }
    setAdding(false);
  };

  const selectedCount = configs.filter((c) => c.selected && !c.added).length;
  const addedCount = configs.filter((c) => c.added).length;

  return (
    <div
      className="flex h-screen flex-col pt-[74px]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
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
          <h1 className="text-sm font-semibold">Quick Add</h1>
        </div>
      </header>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {scanState === "scanning" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Scanning for coding agent configs...
            </p>
          </div>
        )}

        {scanState === "done" && configs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <FolderCog className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              No coding agent configs found
            </p>
            <Button variant="outline" size="sm" onClick={handleScan}>
              <Search className="mr-1.5 h-3 w-3" />
              Scan Again
            </Button>
          </div>
        )}

        {scanState === "done" && configs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Detected ({configs.length})
              </h2>
              <Button
                variant="ghost"
                size="xs"
                className="text-[10px] text-muted-foreground"
                onClick={toggleAll}
              >
                {configs.every((c) => c.selected || c.added)
                  ? "Deselect all"
                  : "Select all"}
              </Button>
            </div>

            <div className="divide-y divide-border rounded-md border">
              {configs.map((config) => (
                <label
                  key={config.path}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                    config.added
                      ? "opacity-60"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={config.selected || config.added}
                    disabled={config.added}
                    onChange={() => toggleItem(config.path)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">
                        {config.agent}
                      </span>
                      {config.added && (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {config.path}
                    </p>
                    {config.error && (
                      <p className="text-[10px] text-destructive">
                        {config.error}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {addedCount > 0 && addedCount === configs.length && (
              <p className="text-center text-[10px] text-green-600 dark:text-green-400">
                All configs added to sync list
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {scanState === "done" && configs.length > 0 && (
        <div className="border-t px-4 py-3">
          {addedCount === configs.length ? (
            <Button size="sm" className="w-full" onClick={onDone}>
              Done
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={selectedCount === 0 || adding}
              onClick={handleAdd}
            >
              {adding ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedCount} to Sync List`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
