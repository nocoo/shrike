import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncLogPage, formatHeader } from "./sync-log";
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

describe("formatHeader", () => {
  it("returns failure message when error is provided", () => {
    expect(formatHeader(null, "connection refused")).toBe("Sync failed");
  });

  it("returns no result message when both are null", () => {
    expect(formatHeader(null, null)).toBe("No sync result");
  });

  it("formats files only", () => {
    const result = makeSyncResult({ files_transferred: 5, dirs_transferred: 0 });
    expect(formatHeader(result, null)).toBe("Synced 5 files");
  });

  it("formats dirs only", () => {
    const result = makeSyncResult({ files_transferred: 0, dirs_transferred: 3 });
    expect(formatHeader(result, null)).toBe("Synced 3 dirs");
  });

  it("formats files and dirs", () => {
    const result = makeSyncResult({ files_transferred: 2, dirs_transferred: 1 });
    expect(formatHeader(result, null)).toBe("Synced 2 files, 1 dir");
  });

  it("uses singular for 1 file", () => {
    const result = makeSyncResult({ files_transferred: 1, dirs_transferred: 0 });
    expect(formatHeader(result, null)).toBe("Synced 1 file");
  });

  it("uses singular for 1 dir", () => {
    const result = makeSyncResult({ files_transferred: 0, dirs_transferred: 1 });
    expect(formatHeader(result, null)).toBe("Synced 1 dir");
  });

  it("returns no changes when both are 0", () => {
    const result = makeSyncResult({ files_transferred: 0, dirs_transferred: 0 });
    expect(formatHeader(result, null)).toBe("Synced (no changes)");
  });
});

describe("SyncLogPage", () => {
  it("renders Sync Log title", () => {
    render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("Sync Log")).toBeInTheDocument();
  });

  it("renders back button", () => {
    render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={onBack} />,
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows success header for successful result", () => {
    render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("Synced 3 files, 1 dir")).toBeInTheDocument();
  });

  it("shows failure header for error", () => {
    render(
      <SyncLogPage result={null} error="rsync failed" onBack={() => {}} />,
    );
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
  });

  it("shows stdout content", () => {
    render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText(/file1\.txt/)).toBeInTheDocument();
  });

  it("shows stderr in red when present", () => {
    const result = makeSyncResult({ stderr: "warning: some issue" });
    render(
      <SyncLogPage result={result} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("warning: some issue")).toBeInTheDocument();
  });

  it("shows error message when error is provided", () => {
    render(
      <SyncLogPage result={null} error="connection refused" onBack={() => {}} />,
    );
    expect(screen.getByText("connection refused")).toBeInTheDocument();
  });

  it("shows 'No output' when result has empty stdout and no error", () => {
    const result = makeSyncResult({ stdout: "" });
    render(
      <SyncLogPage result={result} error={null} onBack={() => {}} />,
    );
    expect(screen.getByText("No output")).toBeInTheDocument();
  });

  it("has drag region header for window dragging", () => {
    render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-tauri-drag-region");
  });

  it("prevents context menu", () => {
    const { container } = render(
      <SyncLogPage result={makeSyncResult()} error={null} onBack={() => {}} />,
    );
    const event = new MouseEvent("contextmenu", { bubbles: true });
    const spy = vi.spyOn(event, "preventDefault");
    container.firstElementChild!.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });
});
