import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock Tauri commands
const mockScanCodingConfigs = vi.fn();
const mockAddEntry = vi.fn();

vi.mock("@/lib/commands", () => ({
  scanCodingConfigs: (...args: unknown[]) => mockScanCodingConfigs(...args),
  addEntry: (...args: unknown[]) => mockAddEntry(...args),
}));

import { WizardPage } from "./wizard-page";

const mockConfigs = [
  { agent: "Claude Code", path: "/Users/test/.claude", item_type: "directory" as const },
  { agent: "Cursor", path: "/Users/test/.cursor", item_type: "directory" as const },
  { agent: "OpenCode", path: "/Users/test/.config/opencode", item_type: "directory" as const },
];

describe("WizardPage", () => {
  const defaultProps = {
    onBack: vi.fn(),
    onDone: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockScanCodingConfigs.mockResolvedValue([...mockConfigs]);
    mockAddEntry.mockResolvedValue({
      id: "test-id",
      path: "/test",
      item_type: "directory",
      added_at: "2026-01-01T00:00:00Z",
      last_synced: null,
    });
  });

  it("renders Quick Add title", async () => {
    render(<WizardPage {...defaultProps} />);
    expect(screen.getByText("Quick Add")).toBeInTheDocument();
  });

  it("shows scanning state initially", async () => {
    // Keep the scan pending to see loading state
    mockScanCodingConfigs.mockReturnValue(new Promise(() => {}));
    render(<WizardPage {...defaultProps} />);

    expect(
      screen.getByText("Scanning for coding agent configs...")
    ).toBeInTheDocument();
  });

  it("displays detected configs after scan", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
      expect(screen.getByText("Cursor")).toBeInTheDocument();
      expect(screen.getByText("OpenCode")).toBeInTheDocument();
    });
  });

  it("shows empty state when no configs found", async () => {
    mockScanCodingConfigs.mockResolvedValue([]);
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("No coding agent configs found")
      ).toBeInTheDocument();
    });
  });

  it("shows Scan Again button when no configs found", async () => {
    mockScanCodingConfigs.mockResolvedValue([]);
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Scan Again")).toBeInTheDocument();
    });
  });

  it("shows detected count header", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Detected (3)")).toBeInTheDocument();
    });
  });

  it("all configs are selected by default", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
      checkboxes.forEach((cb) => expect(cb).toBeChecked());
    });
  });

  it("toggles individual config selection", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    expect(checkboxes[0]).not.toBeChecked();
  });

  it("shows correct add button text with count", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
    });
  });

  it("updates add button count when item is deselected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    expect(screen.getByText("Add 2 to Sync List")).toBeInTheDocument();
  });

  it("calls addEntry for each selected config", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 3 to Sync List"));

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledTimes(3);
      expect(mockAddEntry).toHaveBeenCalledWith("/Users/test/.claude");
      expect(mockAddEntry).toHaveBeenCalledWith("/Users/test/.cursor");
      expect(mockAddEntry).toHaveBeenCalledWith("/Users/test/.config/opencode");
    });
  });

  it("shows Done button after all configs are added", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 3 to Sync List"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("calls onDone when Done button is clicked", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 3 to Sync List"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Done"));
    expect(defaultProps.onDone).toHaveBeenCalledOnce();
  });

  it("calls onBack when back button is clicked", async () => {
    render(<WizardPage {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(defaultProps.onBack).toHaveBeenCalledOnce();
  });

  it("shows error message when addEntry fails", async () => {
    mockAddEntry.mockRejectedValueOnce(new Error("Permission denied"));
    // Subsequent calls succeed
    mockAddEntry.mockResolvedValue({
      id: "test-id",
      path: "/test",
      item_type: "directory",
      added_at: "2026-01-01T00:00:00Z",
      last_synced: null,
    });

    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 3 to Sync List"));

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("disables add button when no items selected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    });

    // Deselect all
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => fireEvent.click(cb));

    // The add button should be disabled (text shows "Add 0 to Sync List")
    expect(screen.getByText("Add 0 to Sync List")).toBeInTheDocument();
    expect(screen.getByText("Add 0 to Sync List").closest("button")).toBeDisabled();
  });

  it("has drag region header for window dragging", async () => {
    const { container } = render(<WizardPage {...defaultProps} />);
    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    // header + traffic light zone + content row = 3 drag regions
    expect(dragRegions.length).toBe(3);
  });

  it("prevents context menu", async () => {
    const { container } = render(<WizardPage {...defaultProps} />);
    const mainDiv = container.firstElementChild as HTMLElement;
    const event = new MouseEvent("contextmenu", { bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    mainDiv.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("shows Deselect all when all are selected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Deselect all")).toBeInTheDocument();
    });
  });

  it("toggles to Select all when deselect all is clicked", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Deselect all")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Deselect all"));

    expect(screen.getByText("Select all")).toBeInTheDocument();
  });

  it("shows config paths", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("/Users/test/.claude")).toBeInTheDocument();
      expect(screen.getByText("/Users/test/.cursor")).toBeInTheDocument();
      expect(
        screen.getByText("/Users/test/.config/opencode")
      ).toBeInTheDocument();
    });
  });

  it("handles scan failure gracefully", async () => {
    mockScanCodingConfigs.mockRejectedValue(new Error("Scan error"));
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("No coding agent configs found")
      ).toBeInTheDocument();
    });
  });

  it("re-scans when Scan Again is clicked", async () => {
    mockScanCodingConfigs.mockResolvedValueOnce([]);
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Scan Again")).toBeInTheDocument();
    });

    // Now return configs on second scan
    mockScanCodingConfigs.mockResolvedValueOnce([...mockConfigs]);
    fireEvent.click(screen.getByText("Scan Again"));

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    expect(mockScanCodingConfigs).toHaveBeenCalledTimes(2);
  });
});
