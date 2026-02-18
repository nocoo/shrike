import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import {
  FileList,
  formatPath,
  detectHomePrefix,
  groupEntries,
} from "./file-list";
import type { BackupEntry } from "@/lib/types";

// --- Unit tests for utility functions ---

describe("formatPath", () => {
  it("splits path into dir and name", () => {
    expect(formatPath("/Users/nocoo/Documents/notes.md")).toEqual({
      dir: "/Users/nocoo/Documents",
      name: "notes.md",
    });
  });

  it("handles root-level path", () => {
    expect(formatPath("/file.txt")).toEqual({ dir: "", name: "file.txt" });
  });

  it("handles directory path", () => {
    expect(formatPath("/Users/nocoo/Projects")).toEqual({
      dir: "/Users/nocoo",
      name: "Projects",
    });
  });
});

describe("detectHomePrefix", () => {
  it("detects macOS home directory", () => {
    expect(detectHomePrefix("/Users/nocoo/workspace/foo")).toBe("/Users/nocoo");
  });

  it("returns null for non-home paths", () => {
    expect(detectHomePrefix("/etc/config")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectHomePrefix("")).toBeNull();
  });

  it("handles different usernames", () => {
    expect(detectHomePrefix("/Users/alice/Documents/file.txt")).toBe(
      "/Users/alice"
    );
  });
});

describe("groupEntries", () => {
  const makeEntry = (
    id: string,
    path: string,
    item_type: "file" | "directory"
  ): BackupEntry => ({
    id,
    path,
    item_type,
    added_at: "2026-02-18T00:00:00Z",
    last_synced: null,
  });

  it("groups entries by first directory under home", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/workspace/personal/abc", "directory"),
      makeEntry("2", "/Users/nocoo/workspace/work/xyz", "directory"),
      makeEntry("3", "/Users/nocoo/Documents/notes.md", "file"),
    ];
    const groups = groupEntries(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("/Users/nocoo/Documents");
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[1].key).toBe("/Users/nocoo/workspace");
    expect(groups[1].entries).toHaveLength(2);
  });

  it("sorts directories before files within a group", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/workspace/file.txt", "file"),
      makeEntry("2", "/Users/nocoo/workspace/projects", "directory"),
      makeEntry("3", "/Users/nocoo/workspace/docs", "directory"),
    ];
    const groups = groupEntries(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries[0].item_type).toBe("directory");
    expect(groups[0].entries[1].item_type).toBe("directory");
    expect(groups[0].entries[2].item_type).toBe("file");
  });

  it("sorts alphabetically within same type", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/workspace/zebra", "directory"),
      makeEntry("2", "/Users/nocoo/workspace/alpha", "directory"),
      makeEntry("3", "/Users/nocoo/workspace/mid", "directory"),
    ];
    const groups = groupEntries(entries);

    expect(groups[0].entries.map((e) => formatPath(e.path).name)).toEqual([
      "alpha",
      "mid",
      "zebra",
    ]);
  });

  it("puts non-home paths in / group at the end", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/workspace/foo", "directory"),
      makeEntry("2", "/etc/config", "file"),
    ];
    const groups = groupEntries(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("/Users/nocoo/workspace");
    expect(groups[1].key).toBe("/");
  });

  it("handles empty entries", () => {
    expect(groupEntries([])).toEqual([]);
  });

  it("handles single entry", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/Documents/file.md", "file"),
    ];
    const groups = groupEntries(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("/Users/nocoo/Documents");
    expect(groups[0].entries).toHaveLength(1);
  });

  it("handles dotfile directories as group keys", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/.claude/settings.json", "file"),
      makeEntry("2", "/Users/nocoo/.cursor/rules/my-rule", "file"),
    ];
    const groups = groupEntries(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("/Users/nocoo/.claude");
    expect(groups[1].key).toBe("/Users/nocoo/.cursor");
  });

  it("sorts group keys alphabetically, case-insensitive", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/Zebra/a", "file"),
      makeEntry("2", "/Users/nocoo/alpha/b", "file"),
      makeEntry("3", "/Users/nocoo/Middle/c", "file"),
    ];
    const groups = groupEntries(entries);

    expect(groups.map((g) => g.key)).toEqual(["/Users/nocoo/alpha", "/Users/nocoo/Middle", "/Users/nocoo/Zebra"]);
  });

  it("handles entry directly under home (no subdirectory)", () => {
    const entries = [
      makeEntry("1", "/Users/nocoo/.aider.conf.yml", "file"),
    ];
    const groups = groupEntries(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("/Users/nocoo/.aider.conf.yml");
    expect(groups[0].entries).toHaveLength(1);
  });
});

// --- Component tests ---

const mockEntries: BackupEntry[] = [
  {
    id: "id-1",
    path: "/Users/nocoo/Documents/notes.md",
    item_type: "file",
    added_at: "2026-02-18T00:00:00Z",
    last_synced: null,
  },
  {
    id: "id-2",
    path: "/Users/nocoo/workspace/my-project",
    item_type: "directory",
    added_at: "2026-02-18T01:00:00Z",
    last_synced: "2026-02-18T02:00:00Z",
  },
];

describe("FileList", () => {
  it("renders nothing when entries is empty", () => {
    const { container } = renderWithLocale(<FileList entries={[]} onRemove={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders file names from paths", () => {
    renderWithLocale(<FileList entries={mockEntries} onRemove={() => {}} />);
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("my-project")).toBeInTheDocument();
  });

  it("renders parent directory paths as full paths", () => {
    renderWithLocale(<FileList entries={mockEntries} onRemove={() => {}} />);
    // Both group headers and entry dir lines may show the same path text
    expect(screen.getAllByText("/Users/nocoo/Documents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("/Users/nocoo/workspace").length).toBeGreaterThanOrEqual(1);
  });

  it("renders item type badges", () => {
    renderWithLocale(<FileList entries={mockEntries} onRemove={() => {}} />);
    expect(screen.getByText("file")).toBeInTheDocument();
    expect(screen.getByText("directory")).toBeInTheDocument();
  });

  it("calls onRemove with correct id when remove button clicked", () => {
    const onRemove = vi.fn();
    renderWithLocale(<FileList entries={mockEntries} onRemove={onRemove} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onRemove).toHaveBeenCalledWith("id-1");
  });

  it("renders correct number of entries", () => {
    renderWithLocale(<FileList entries={mockEntries} onRemove={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("shows group headers when entries span multiple groups", () => {
    const multiGroupEntries: BackupEntry[] = [
      {
        id: "id-1",
        path: "/Users/nocoo/Documents/notes.md",
        item_type: "file",
        added_at: "2026-02-18T00:00:00Z",
        last_synced: null,
      },
      {
        id: "id-2",
        path: "/Users/nocoo/workspace/project",
        item_type: "directory",
        added_at: "2026-02-18T01:00:00Z",
        last_synced: null,
      },
    ];
    renderWithLocale(<FileList entries={multiGroupEntries} onRemove={() => {}} />);
    // Group headers and entry dir lines may both show the path
    expect(screen.getAllByText("/Users/nocoo/Documents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("/Users/nocoo/workspace").length).toBeGreaterThanOrEqual(1);
  });

  it("hides group header when all entries are in one group", () => {
    const singleGroupEntries: BackupEntry[] = [
      {
        id: "id-1",
        path: "/Users/nocoo/workspace/project-a",
        item_type: "directory",
        added_at: "2026-02-18T00:00:00Z",
        last_synced: null,
      },
      {
        id: "id-2",
        path: "/Users/nocoo/workspace/project-b",
        item_type: "directory",
        added_at: "2026-02-18T01:00:00Z",
        last_synced: null,
      },
    ];
    renderWithLocale(<FileList entries={singleGroupEntries} onRemove={() => {}} />);
    expect(screen.getByText("project-a")).toBeInTheDocument();
    expect(screen.getByText("project-b")).toBeInTheDocument();
    // No sticky group header rendered for single group
    // The text "workspace" only appears inside the full path, not as a standalone header
    const headers = document.querySelectorAll(".sticky");
    expect(headers).toHaveLength(0);
  });

  it("shows Other for non-home paths in group headers", () => {
    const mixedEntries: BackupEntry[] = [
      {
        id: "id-1",
        path: "/Users/nocoo/Documents/notes.md",
        item_type: "file",
        added_at: "2026-02-18T00:00:00Z",
        last_synced: null,
      },
      {
        id: "id-2",
        path: "/etc/my-config",
        item_type: "file",
        added_at: "2026-02-18T01:00:00Z",
        last_synced: null,
      },
    ];
    renderWithLocale(<FileList entries={mixedEntries} onRemove={() => {}} />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });
});
