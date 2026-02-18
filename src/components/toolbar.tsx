"use client";

import Image from "next/image";
import { File, Folder, Info, Plus, Settings, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale, pluralizeItems } from "@/lib/i18n";

interface ToolbarProps {
  entryCount: number;
  onAddFiles: () => void;
  onAddFolders: () => void;
  onWizard: () => void;
  onSettings: () => void;
  onAbout: () => void;
}

export function Toolbar({ entryCount, onAddFiles, onAddFolders, onWizard, onSettings, onAbout }: ToolbarProps) {
  const { t, locale } = useLocale();

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
          <h1 className="text-base font-semibold">Shrike</h1>
          {entryCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {pluralizeItems(entryCount, locale)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAddFiles}>
                <File className="mr-2 h-4 w-4" />
                {t("toolbar.addFiles")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddFolders}>
                <Folder className="mr-2 h-4 w-4" />
                {t("toolbar.addFolders")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onWizard}>
            <Wand2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSettings}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAbout}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
