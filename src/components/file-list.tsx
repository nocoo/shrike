"use client";

import { X, File, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BackupEntry } from "@/lib/types";

interface FileListProps {
  entries: BackupEntry[];
  onRemove: (id: string) => void;
}

function formatPath(path: string): { dir: string; name: string } {
  const parts = path.split("/");
  const name = parts.pop() || path;
  const dir = parts.join("/");
  return { dir, name };
}

export function FileList({ entries, onRemove }: FileListProps) {
  if (entries.length === 0) return null;

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {entries.map((entry) => {
          const { dir, name } = formatPath(entry.path);
          return (
            <div
              key={entry.id}
              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
            >
              {entry.item_type === "file" ? (
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">{name}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {entry.item_type}
                  </Badge>
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{dir}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onRemove(entry.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
