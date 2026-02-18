import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncSummary } from "./sync-summary";
import type { SyncResult } from "@/lib/types";

function makeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    files_transferred: 3,
    dirs_transferred: 1,
    bytes_transferred: 4096,
    stdout: "file1.txt\nfile2.txt\nfile3.txt\n",
    stderr: "",
    exit_code: 0,
    synced_at: "2026-02-18T12:00:00Z",
    ...overrides,
  };
}

describe("SyncSummary", () => {
  it("renders nothing when no result and no error", () => {
    const { container } = render(
      <SyncSummary result={null} error={null} onViewLog={() => {}} />,
    );
    expect(container.firstElementChild).toBeNull();
  });

  it("shows success summary for successful result", () => {
    render(
      <SyncSummary
        result={makeSyncResult()}
        error={null}
        onViewLog={() => {}}
      />,
    );
    expect(screen.getByText("Synced 3 files, 1 dir")).toBeInTheDocument();
  });

  it("shows failure summary for error", () => {
    render(
      <SyncSummary
        result={null}
        error="rsync failed"
        onViewLog={() => {}}
      />,
    );
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
  });

  it("calls onViewLog when clicked", () => {
    const onViewLog = vi.fn();
    render(
      <SyncSummary
        result={makeSyncResult()}
        error={null}
        onViewLog={onViewLog}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onViewLog).toHaveBeenCalledOnce();
  });

  it("shows chevron icon", () => {
    render(
      <SyncSummary
        result={makeSyncResult()}
        error={null}
        onViewLog={() => {}}
      />,
    );
    // ChevronRight renders as an svg
    const button = screen.getByRole("button");
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("shows files only when no dirs", () => {
    render(
      <SyncSummary
        result={makeSyncResult({ files_transferred: 5, dirs_transferred: 0 })}
        error={null}
        onViewLog={() => {}}
      />,
    );
    expect(screen.getByText("Synced 5 files")).toBeInTheDocument();
  });

  it("shows dirs only when no files", () => {
    render(
      <SyncSummary
        result={makeSyncResult({ files_transferred: 0, dirs_transferred: 2 })}
        error={null}
        onViewLog={() => {}}
      />,
    );
    expect(screen.getByText("Synced 2 dirs")).toBeInTheDocument();
  });

  it("shows no changes when both are 0", () => {
    render(
      <SyncSummary
        result={makeSyncResult({ files_transferred: 0, dirs_transferred: 0 })}
        error={null}
        onViewLog={() => {}}
      />,
    );
    expect(screen.getByText("Synced (no changes)")).toBeInTheDocument();
  });
});
