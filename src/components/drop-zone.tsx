"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";

interface DropZoneProps {
  isDragging: boolean;
  hasEntries: boolean;
}

export function DropZone({ isDragging, hasEntries }: DropZoneProps) {
  const { t } = useLocale();

  // Full-window overlay when dragging
  if (isDragging) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="rounded-lg border-2 border-dashed border-primary px-12 py-8">
          <p className="text-sm font-medium text-primary">
            {t("dropZone.drop")}
          </p>
        </div>
      </div>
    );
  }

  // Empty state hint (only when no entries)
  if (!hasEntries) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-2 px-8"
        )}
      >
        <p className="text-sm text-muted-foreground">
          {t("dropZone.drag")}
        </p>
        <p className="text-[11px] text-muted-foreground/60">
          {t("dropZone.browse")}
        </p>
      </div>
    );
  }

  return null;
}
