"use client";

import { cn } from "@/lib/utils";

interface DropZoneProps {
  isDragging: boolean;
  hasEntries: boolean;
}

export function DropZone({ isDragging, hasEntries }: DropZoneProps) {
  if (!isDragging && hasEntries) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 bg-muted/50",
        hasEntries ? "py-4" : "py-16"
      )}
    >
      <p className="text-sm text-muted-foreground">
        {isDragging
          ? "Drop files here to add them"
          : "Drag and drop files or folders here to start backing up"}
      </p>
    </div>
  );
}
