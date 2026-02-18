"use client";

import Image from "next/image";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings-dialog";

interface ToolbarProps {
  entryCount: number;
  onAdd: () => void;
}

export function Toolbar({ entryCount, onAdd }: ToolbarProps) {
  return (
    <header
      data-tauri-drag-region
      className="fixed top-0 right-0 left-0 z-50 border-b bg-background"
    >
      {/* Row 1: traffic light zone (drag region only) */}
      <div data-tauri-drag-region className="h-[38px]" />
      {/* Row 2: logo + title | buttons */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-4 pb-3"
      >
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo-64.png"
            alt="Shrike"
            width={24}
            height={24}
            className="rounded"
          />
          <h1 className="text-sm font-semibold">Shrike</h1>
          {entryCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {entryCount} item{entryCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
            <Plus className="h-4 w-4" />
          </Button>
          <SettingsDialog>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Settings className="h-4 w-4" />
            </Button>
          </SettingsDialog>
        </div>
      </div>
    </header>
  );
}
