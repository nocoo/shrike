import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { DropZone } from "./drop-zone";

describe("DropZone", () => {
  it("shows drag overlay when isDragging is true", () => {
    renderWithLocale(<DropZone isDragging={true} hasEntries={false} />);
    expect(screen.getByText("Drop to add to backup list")).toBeInTheDocument();
  });

  it("shows empty state when no entries and not dragging", () => {
    renderWithLocale(<DropZone isDragging={false} hasEntries={false} />);
    expect(screen.getByText("Drag files or folders here")).toBeInTheDocument();
    expect(screen.getByText("or click + to browse")).toBeInTheDocument();
  });

  it("renders nothing when has entries and not dragging", () => {
    const { container } = renderWithLocale(
      <DropZone isDragging={false} hasEntries={true} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows overlay even when has entries if dragging", () => {
    renderWithLocale(<DropZone isDragging={true} hasEntries={true} />);
    expect(screen.getByText("Drop to add to backup list")).toBeInTheDocument();
  });
});
