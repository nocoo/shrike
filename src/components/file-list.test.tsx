import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileList } from "./file-list";
import type { BackupEntry } from "@/lib/types";

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
    path: "/Users/nocoo/Projects",
    item_type: "directory",
    added_at: "2026-02-18T01:00:00Z",
    last_synced: "2026-02-18T02:00:00Z",
  },
];

describe("FileList", () => {
  it("renders nothing when entries is empty", () => {
    const { container } = render(<FileList entries={[]} onRemove={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders file names from paths", () => {
    render(<FileList entries={mockEntries} onRemove={() => {}} />);
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("renders parent directory paths", () => {
    render(<FileList entries={mockEntries} onRemove={() => {}} />);
    expect(screen.getByText("/Users/nocoo/Documents")).toBeInTheDocument();
    expect(screen.getByText("/Users/nocoo")).toBeInTheDocument();
  });

  it("renders item type badges", () => {
    render(<FileList entries={mockEntries} onRemove={() => {}} />);
    expect(screen.getByText("file")).toBeInTheDocument();
    expect(screen.getByText("directory")).toBeInTheDocument();
  });

  it("calls onRemove with correct id when remove button clicked", () => {
    const onRemove = vi.fn();
    render(<FileList entries={mockEntries} onRemove={onRemove} />);

    // Find all remove buttons (X icons)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onRemove).toHaveBeenCalledWith("id-1");
  });

  it("renders correct number of entries", () => {
    render(<FileList entries={mockEntries} onRemove={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });
});
