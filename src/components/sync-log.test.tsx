import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { SyncLogPage, formatHeader } from "./sync-log";
import { resolveLocale } from "@/lib/i18n";
import type { SyncResult } from "@/lib/types";

function makeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    files_transferred: 3,
    dirs_transferred: 1,
    bytes_transferred: 4096,
    stdout: "sending incremental file list\nfile1.txt\nfile2.txt\nfile3.txt\n",
    stderr: "",
    exit_code: 0,
    synced_at: "2026-02-18T12:00:00Z",
    ...overrides,
  };
}

// Build an English translation lookup for unit-testing formatHeader
const en = {
  "syncLog.failed": "Sync failed",
  "syncLog.noResult": "No sync result",
  "syncLog.noChanges": "Synced (no changes)",
} as const;

const t = (key: string) => (en as Record<string, string>)[key] ?? key;
const locale = resolveLocale("auto"); // "en" in test env

describe("formatHeader", () => {
  it("returns failure message when error is provided", () => {
    expect(formatHeader(null, "connection refused", t, locale)).toBe("Sync failed");
  });

  it("returns no result message when both are null", () => {
    expect(formatHeader(null, null, t, locale)).toBe("No sync result");
  });

  it("formats files only", () => {
    const result = makeSyncResult({ files_transferred: 5, dirs_transferred: 0 });
    expect(formatHeader(result, null, t, locale)).toBe("Synced 5 files");
  });

  it("formats dirs only", () => {
    const result = makeSyncResult({ files_transferred: 0, dirs_transferred: 3 });
    expect(formatHeader(result, null, t, locale)).toBe("Synced 3 dirs");
  });

  it("formats files and dirs", () => {
    const result = makeSyncResult({ files_transferred: 2, dirs_transferred: 1 });
    expect(formatHeader(result, null, t, locale)).toBe("Synced 2 files, 1 dir");
  });

  it("uses singular for 1 file", () => {
    const result = makeSyncResult({ files_transferred: 1, dirs_transferred: 0 });
    expect(formatHeader(result, null, t, locale)).toBe("Synced 1 file");
  });

  it("uses singular for 1 dir", () => {
    const result = makeSyncResult({ files_transferred: 0, dirs_transferred: 1 });
    expect(formatHeader(result, null, t, locale)).toBe("Synced 1 dir");
  });

  it("returns no changes when both are 0", () => {
    const result = makeSyncResult({ files_transferred: 0, dirs_transferred: 0 });
    expect(formatHeader(result, null, t, locale)).toBe("Synced (no changes)");
  });
});

describe("SyncLogPage", () => {
  it("renders Sync Log title", () => {
    renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("Sync Log")).toBeInTheDocument();
  });

  it("renders back button", () => {
    renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={onBack} />,
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows success header for successful result", () => {
    renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("Synced 3 files, 1 dir")).toBeInTheDocument();
  });

  it("shows failure header for error", () => {
    renderWithLocale(
      <SyncLogPage result={null} error="rsync failed" onBack={() => {}} />,
    );
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
  });

  it("shows stdout content", () => {
    renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText(/file1\.txt/)).toBeInTheDocument();
  });

  it("shows stderr in red when present", () => {
    const result = makeSyncResult({ stderr: "warning: some issue" });
    renderWithLocale(
      <SyncLogPage result={result} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("warning: some issue")).toBeInTheDocument();
  });

  it("shows error message when error is provided", () => {
    renderWithLocale(
      <SyncLogPage result={null} error="connection refused" onBack={() => {}} />,
    );
    expect(screen.getByText("connection refused")).toBeInTheDocument();
  });

  it("shows 'No output' when result has empty stdout and no error", () => {
    const result = makeSyncResult({ stdout: "" });
    renderWithLocale(
      <SyncLogPage result={result} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("No output")).toBeInTheDocument();
  });

  it("has drag region header for window dragging", () => {
    renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-tauri-drag-region");
  });

  it("prevents context menu", () => {
    const { container } = renderWithLocale(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    const event = new MouseEvent("contextmenu", { bubbles: true });
    const spy = vi.spyOn(event, "preventDefault");
    container.firstElementChild!.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });
});
