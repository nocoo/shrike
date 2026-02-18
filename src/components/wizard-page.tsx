"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Search,
  Loader2,
  Check,
  FolderCog,
  ChevronRight,
  Folder,
  File,
} from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { scanCodingConfigsTree, addEntry } from "@/lib/commands";
import type { AgentTree, TreeChild } from "@/lib/types";

interface WizardPageProps {
  onBack: () => void;
  onDone: () => void;
}

type ScanState = "idle" | "scanning" | "done";

/** Tracks selection state for each selectable path */
type SelectionMap = Record<string, boolean>;

/** Tracks which paths have been successfully added */
type AddedMap = Record<string, boolean>;

/** Tracks error messages per path */
type ErrorMap = Record<string, string>;

/**
 * Collect all selectable paths from an agent tree.
 * For directory agents: children + siblings are selectable.
 * For file agents: the main path itself + siblings.
 * The parent directory itself is NOT directly selectable —
 * selecting all children is equivalent to selecting the whole folder.
 */
function getSelectablePaths(tree: AgentTree): string[] {
  if (tree.item_type === "file") {
    return [tree.path, ...tree.siblings.map((s) => s.path)];
  }
  return [
    ...tree.children.map((c) => c.path),
    ...tree.siblings.map((s) => s.path),
  ];
}

/**
 * Determine the parent checkbox state for a directory agent.
 * Returns: true (all selected), false (none selected), "indeterminate" (some selected).
 */
function getParentState(
  tree: AgentTree,
  selection: SelectionMap,
  added: AddedMap
): boolean | "indeterminate" {
  const paths = getSelectablePaths(tree);
  if (paths.length === 0) return false;

  const selectedCount = paths.filter(
    (p) => selection[p] || added[p]
  ).length;

  if (selectedCount === 0) return false;
  if (selectedCount === paths.length) return true;
  return "indeterminate";
}

/**
 * Compute all paths that should be added to backup.
 *
 * Smart folding: if every child of a directory agent is selected,
 * add the parent directory instead of individual children.
 * Siblings are always added individually.
 */
function computePathsToAdd(
  trees: AgentTree[],
  selection: SelectionMap,
  added: AddedMap
): string[] {
  const paths: string[] = [];

  for (const tree of trees) {
    if (tree.item_type === "file") {
      // File agent: just the file itself
      if (selection[tree.path] && !added[tree.path]) {
        paths.push(tree.path);
      }
    } else {
      // Directory agent: check if all children selected → fold to parent
      const childPaths = tree.children.map((c) => c.path);
      const selectedChildren = childPaths.filter(
        (p) => selection[p] && !added[p]
      );
      const alreadyAddedChildren = childPaths.filter((p) => added[p]);

      if (
        childPaths.length > 0 &&
        selectedChildren.length + alreadyAddedChildren.length ===
          childPaths.length &&
        selectedChildren.length > 0
      ) {
        // All children are either selected or already added → add parent
        paths.push(tree.path);
      } else {
        // Add individual selected children
        for (const p of selectedChildren) {
          paths.push(p);
        }
      }
    }

    // Siblings are always added individually
    for (const sibling of tree.siblings) {
      if (selection[sibling.path] && !added[sibling.path]) {
        paths.push(sibling.path);
      }
    }
  }

  return paths;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={className}
    />
  );
}

export function WizardPage({ onBack, onDone }: WizardPageProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [trees, setTrees] = useState<AgentTree[]>([]);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [added, setAdded] = useState<AddedMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});
  const [adding, setAdding] = useState(false);

  const handleScan = useCallback(async () => {
    setScanState("scanning");
    try {
      const detected = await scanCodingConfigsTree();
      setTrees(detected);

      // Pre-select all selectable paths
      const sel: SelectionMap = {};
      for (const tree of detected) {
        for (const p of getSelectablePaths(tree)) {
          sel[p] = true;
        }
      }
      setSelection(sel);
      setAdded({});
      setErrors({});
    } catch (err) {
      console.error("Scan failed:", err);
      setTrees([]);
    } finally {
      setScanState("done");
    }
  }, []);

  useEffect(() => {
    handleScan();
  }, [handleScan]);

  const togglePath = (path: string) => {
    setSelection((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleAgent = (tree: AgentTree) => {
    const paths = getSelectablePaths(tree);
    const parentState = getParentState(tree, selection, added);
    // If all or some selected → deselect all; if none → select all
    const newValue = parentState === false;
    setSelection((prev) => {
      const next = { ...prev };
      for (const p of paths) {
        if (!added[p]) {
          next[p] = newValue;
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    const allPaths = trees.flatMap(getSelectablePaths);
    const allSelected = allPaths.every((p) => selection[p] || added[p]);
    setSelection((prev) => {
      const next = { ...prev };
      for (const p of allPaths) {
        if (!added[p]) {
          next[p] = !allSelected;
        }
      }
      return next;
    });
  };

  const handleAdd = async () => {
    setAdding(true);
    const pathsToAdd = computePathsToAdd(trees, selection, added);

    // Build a map of parent paths to their children for smart folding
    const parentToChildren: Record<string, string[]> = {};
    for (const tree of trees) {
      if (tree.item_type === "directory" && tree.children.length > 0) {
        parentToChildren[tree.path] = tree.children.map((c) => c.path);
      }
    }

    for (const path of pathsToAdd) {
      try {
        await addEntry(path);
        // Mark this path as added
        const newAdded: AddedMap = { [path]: true };
        // If this is a parent directory (smart-folded), also mark all children as added
        if (parentToChildren[path]) {
          for (const childPath of parentToChildren[path]) {
            newAdded[childPath] = true;
          }
        }
        setAdded((prev) => ({ ...prev, ...newAdded }));
        setSelection((prev) => {
          const next = { ...prev };
          next[path] = false;
          if (parentToChildren[path]) {
            for (const childPath of parentToChildren[path]) {
              next[childPath] = false;
            }
          }
          return next;
        });
        setErrors((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrors((prev) => ({ ...prev, [path]: msg }));
      }
    }
    setAdding(false);
  };

  const allPaths = trees.flatMap(getSelectablePaths);
  const selectedCount = allPaths.filter(
    (p) => selection[p] && !added[p]
  ).length;
  const addedCount = allPaths.filter((p) => added[p]).length;
  const allAdded = allPaths.length > 0 && addedCount === allPaths.length;
  const allSelected = allPaths.every((p) => selection[p] || added[p]);

  const renderChildRow = (child: TreeChild) => {
    const isAdded = added[child.path];
    const isSelected = selection[child.path] || isAdded;
    const error = errors[child.path];

    return (
      <label
        key={child.path}
        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-muted/50 ${
          isAdded ? "opacity-60" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isAdded}
          onChange={() => togglePath(child.path)}
          className="h-3 w-3 rounded border-border accent-primary"
        />
        {child.item_type === "directory" ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px]">
          {child.name}
        </span>
        {isAdded && (
          <Check className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
        )}
        {error && (
          <span className="truncate text-[11px] text-destructive">
            {error}
          </span>
        )}
      </label>
    );
  };

  const renderAgentTree = (tree: AgentTree) => {
    const hasExpandableContent =
      tree.item_type === "directory" && tree.children.length > 0;
    const parentState = getParentState(tree, selection, added);

    // For file-type agents (like Aider), render a simple row
    if (tree.item_type === "file") {
      const isAdded = added[tree.path];
      const isSelected = selection[tree.path] || isAdded;
      const error = errors[tree.path];

      return (
        <div key={tree.path} className="border-b border-border last:border-b-0">
          <label
            className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 ${
              isAdded ? "opacity-60" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isAdded}
              onChange={() => togglePath(tree.path)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{tree.agent}</span>
                {isAdded && (
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                )}
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {tree.path}
              </p>
              {error && (
                <p className="text-[11px] text-destructive">{error}</p>
              )}
            </div>
          </label>
          {/* Siblings for file agents */}
          {tree.siblings.length > 0 && (
            <div className="border-t border-border/50 px-3 pb-2 pl-9">
              {tree.siblings.map(renderChildRow)}
            </div>
          )}
        </div>
      );
    }

    // Directory agent — collapsible tree
    return (
      <CollapsiblePrimitive.Root
        key={tree.path}
        className="border-b border-border last:border-b-0"
      >
        {/* Agent header row */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <IndeterminateCheckbox
            checked={parentState === true}
            indeterminate={parentState === "indeterminate"}
            disabled={allAdded}
            onChange={() => toggleAgent(tree)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">{tree.agent}</span>
              {parentState === true && addedCount > 0 && (
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
              )}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {tree.path}
            </p>
            {errors[tree.path] && (
              <p className="text-[11px] text-destructive">
                {errors[tree.path]}
              </p>
            )}
          </div>
          {hasExpandableContent && (
            <CollapsiblePrimitive.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="group h-6 w-6 shrink-0"
              >
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
              </Button>
            </CollapsiblePrimitive.Trigger>
          )}
        </div>

        {/* Expandable children */}
        {hasExpandableContent && (
          <CollapsiblePrimitive.Content className="border-t border-border/50 px-3 pb-2 pl-9">
            {tree.children.map(renderChildRow)}
          </CollapsiblePrimitive.Content>
        )}

        {/* Siblings always visible below the agent */}
        {tree.siblings.length > 0 && (
          <div className="border-t border-border/50 px-3 pb-2 pl-9">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Related files
            </p>
            {tree.siblings.map(renderChildRow)}
          </div>
        )}
      </CollapsiblePrimitive.Root>
    );
  };

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
          <h1 className="text-base font-semibold">AI CLI Backup</h1>
        </div>
      </header>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {scanState === "scanning" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scanning for AI CLI configs...
            </p>
          </div>
        )}

        {scanState === "done" && trees.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <FolderCog className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              No AI CLI configs found
            </p>
            <Button variant="outline" size="sm" onClick={handleScan}>
              <Search className="mr-1.5 h-3 w-3" />
              Scan Again
            </Button>
          </div>
        )}

        {scanState === "done" && trees.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Detected ({trees.length})
              </h2>
              <Button
                variant="ghost"
                size="xs"
                className="text-[11px] text-muted-foreground"
                onClick={toggleAll}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </Button>
            </div>

            <div className="divide-y-0 rounded-md border">
              {trees.map(renderAgentTree)}
            </div>

            {allAdded && (
              <p className="text-center text-[11px] text-green-600 dark:text-green-400">
                All configs added to sync list
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {scanState === "done" && trees.length > 0 && (
        <div className="border-t px-4 py-3">
          {allAdded ? (
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
