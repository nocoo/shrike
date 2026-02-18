"use client";

import { X, File, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/lib/i18n";
import type { BackupEntry } from "@/lib/types";

interface FileListProps {
  entries: BackupEntry[];
  onRemove: (id: string) => void;
}

/** Split an absolute path into parent directory and file/folder name. */
export function formatPath(path: string): { dir: string; name: string } {
  const parts = path.split("/");
  const name = parts.pop() || path;
  const dir = parts.join("/");
  return { dir, name };
}

export interface EntryGroup {
  /** Group key — full path to the first directory under home (e.g. "/Users/nocoo/workspace"), or "/" for non-home paths */
  key: string;
  entries: BackupEntry[];
}

/**
 * Detect the home directory prefix from a macOS absolute path.
 * Returns e.g. "/Users/nocoo" for "/Users/nocoo/workspace/foo",
 * or null if the path doesn't match /Users/<username>/... pattern.
 */
export function detectHomePrefix(path: string): string | null {
  const match = path.match(/^(\/Users\/[^/]+)/);
  return match ? match[1] : null;
}

/**
 * Group entries by the first directory component under the home directory.
 * Within each group, directories come first, then files, alphabetically by name.
 *
 * Example: /Users/nocoo/workspace/personal/abc → group key "/Users/nocoo/workspace"
 *          /Users/nocoo/.claude/settings.json  → group key "/Users/nocoo/.claude"
 *          /etc/config                         → group key "/"
 */
export function groupEntries(entries: BackupEntry[]): EntryGroup[] {
  // Detect home prefix from first available entry
  let homePrefix: string | null = null;
  for (const entry of entries) {
    homePrefix = detectHomePrefix(entry.path);
    if (homePrefix) break;
  }

  const groupMap = new Map<string, BackupEntry[]>();

  for (const entry of entries) {
    let key = "/";
    if (homePrefix && entry.path.startsWith(homePrefix + "/")) {
      // Extract first directory component after home prefix
      const relativePath = entry.path.slice(homePrefix.length + 1);
      const firstSlash = relativePath.indexOf("/");
      const firstDir = firstSlash === -1 ? relativePath : relativePath.slice(0, firstSlash);
      key = homePrefix + "/" + firstDir;
    }

    const group = groupMap.get(key);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(key, [entry]);
    }
  }

  // Sort entries within each group: directories first, then files, alphabetically by name
  const sortEntries = (a: BackupEntry, b: BackupEntry): number => {
    if (a.item_type !== b.item_type) {
      return a.item_type === "directory" ? -1 : 1;
    }
    const nameA = formatPath(a.path).name.toLowerCase();
    const nameB = formatPath(b.path).name.toLowerCase();
    return nameA.localeCompare(nameB);
  };

  // Build sorted groups array — sort group keys alphabetically, but "/" goes last
  const sortedKeys = [...groupMap.keys()].sort((a, b) => {
    if (a === "/") return 1;
    if (b === "/") return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  return sortedKeys.map((key) => ({
    key,
    entries: groupMap.get(key)!.sort(sortEntries),
  }));
}

export function FileList({ entries, onRemove }: FileListProps) {
  const { t } = useLocale();

  if (entries.length === 0) return null;

  const groups = groupEntries(entries);

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {groups.map((group) => (
          <div key={group.key}>
            {/* Only show group header when there are multiple groups */}
            {groups.length > 1 && (
              <div className="sticky top-0 z-10 bg-muted/80 px-4 py-1.5 backdrop-blur-sm">
                <span className="text-xs font-medium text-muted-foreground">
                  {group.key === "/" ? t("fileList.other") : group.key}
                </span>
              </div>
            )}
            {group.entries.map((entry) => {
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
                      <span className="truncate text-sm font-medium">
                        {name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[11px]"
                      >
                        {entry.item_type}
                      </Badge>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {dir}
                    </p>
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
        ))}
      </div>
    </ScrollArea>
  );
}
