import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock Tauri commands
const mockScanCodingConfigsTree = vi.fn();
const mockAddEntry = vi.fn();

vi.mock("@/lib/commands", () => ({
  scanCodingConfigsTree: (...args: unknown[]) =>
    mockScanCodingConfigsTree(...args),
  addEntry: (...args: unknown[]) => mockAddEntry(...args),
}));

import { WizardPage } from "./wizard-page";
import type { AgentTree } from "@/lib/types";

const mockTrees: AgentTree[] = [
  {
    agent: "Claude Code",
    path: "/Users/test/.claude",
    item_type: "directory",
    children: [
      {
        name: "projects",
        path: "/Users/test/.claude/projects",
        item_type: "directory",
      },
      {
        name: "settings.json",
        path: "/Users/test/.claude/settings.json",
        item_type: "file",
      },
    ],
    siblings: [
      {
        name: ".claude.json",
        path: "/Users/test/.claude.json",
        item_type: "file",
      },
    ],
  },
  {
    agent: "OpenCode",
    path: "/Users/test/.config/opencode",
    item_type: "directory",
    children: [
      {
        name: "opencode.json",
        path: "/Users/test/.config/opencode/opencode.json",
        item_type: "file",
      },
    ],
    siblings: [],
  },
  {
    agent: "Aider",
    path: "/Users/test/.aider.conf.yml",
    item_type: "file",
    children: [],
    siblings: [],
  },
];

describe("WizardPage", () => {
  const defaultProps = {
    onBack: vi.fn(),
    onDone: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockScanCodingConfigsTree.mockResolvedValue(
      JSON.parse(JSON.stringify(mockTrees))
    );
    mockAddEntry.mockResolvedValue({
      id: "test-id",
      path: "/test",
      item_type: "directory",
      added_at: "2026-01-01T00:00:00Z",
      last_synced: null,
    });
  });

  it("renders AI CLI Backup title", async () => {
    render(<WizardPage {...defaultProps} />);
    expect(screen.getByText("AI CLI Backup")).toBeInTheDocument();
  });

  it("shows scanning state initially", async () => {
    mockScanCodingConfigsTree.mockReturnValue(new Promise(() => {}));
    render(<WizardPage {...defaultProps} />);

    expect(
      screen.getByText("Scanning for AI CLI configs...")
    ).toBeInTheDocument();
  });

  it("displays detected agents after scan", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
      expect(screen.getByText("OpenCode")).toBeInTheDocument();
      expect(screen.getByText("Aider")).toBeInTheDocument();
    });
  });

  it("shows empty state when no configs found", async () => {
    mockScanCodingConfigsTree.mockResolvedValue([]);
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("No AI CLI configs found")
      ).toBeInTheDocument();
    });
  });

  it("shows Scan Again button when no configs found", async () => {
    mockScanCodingConfigsTree.mockResolvedValue([]);
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

  it("all selectable paths are selected by default", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Visible checkboxes (collapsible closed):
      // Claude: 1 parent + 1 sibling (.claude.json) = 2
      // OpenCode: 1 parent = 1
      // Aider: 1 file = 1
      // Total visible = 4
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(4);
      checkboxes.forEach((cb) => expect(cb).toBeChecked());
    });
  });

  it("toggles individual child selection", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // Expand Claude Code collapsible to show children
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
    });

    // Find the "projects" checkbox — it's a child of Claude Code
    const projectsLabel = screen.getByText("projects");
    const checkbox = projectsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("shows correct add button text with count", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Claude: 2 children + 1 sibling = 3
      // OpenCode: 1 child = 1
      // Aider: 1 file = 1
      // Total = 5 selectable paths
      expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    });
  });

  it("updates add button count when child is deselected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    });

    // Expand Claude Code collapsible
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
    });

    const projectsLabel = screen.getByText("projects");
    const checkbox = projectsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
  });

  it("calls addEntry for selected paths", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 5 to Sync List"));

    await waitFor(() => {
      // When all children selected → folds to parent directory
      // Claude: all children selected → adds parent .claude + sibling .claude.json
      // OpenCode: all children selected → adds parent .config/opencode
      // Aider: file → adds .aider.conf.yml
      expect(mockAddEntry).toHaveBeenCalledWith("/Users/test/.claude");
      expect(mockAddEntry).toHaveBeenCalledWith("/Users/test/.claude.json");
      expect(mockAddEntry).toHaveBeenCalledWith(
        "/Users/test/.config/opencode"
      );
      expect(mockAddEntry).toHaveBeenCalledWith(
        "/Users/test/.aider.conf.yml"
      );
    });
  });

  it("adds individual children when not all selected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // Expand Claude Code collapsible
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
    });

    // Deselect "projects" child of Claude Code
    const projectsLabel = screen.getByText("projects");
    const checkbox = projectsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText("Add 4 to Sync List"));

    await waitFor(() => {
      // Claude: only settings.json selected (not all children) → adds individual child
      expect(mockAddEntry).toHaveBeenCalledWith(
        "/Users/test/.claude/settings.json"
      );
      // Sibling still added
      expect(mockAddEntry).toHaveBeenCalledWith("/Users/test/.claude.json");
      // Should NOT add parent .claude since not all children selected
      expect(mockAddEntry).not.toHaveBeenCalledWith("/Users/test/.claude");
    });
  });

  it("shows Done button after all items are added", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 5 to Sync List"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("calls onDone when Done button is clicked", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 5 to Sync List"));

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
    mockAddEntry.mockResolvedValue({
      id: "test-id",
      path: "/test",
      item_type: "directory",
      added_at: "2026-01-01T00:00:00Z",
      last_synced: null,
    });

    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 5 to Sync List"));

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("disables add button when no items selected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // 4 visible checkboxes (collapsibles closed)
      expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    });

    // Click Deselect all
    fireEvent.click(screen.getByText("Deselect all"));

    expect(screen.getByText("Add 0 to Sync List")).toBeInTheDocument();
    expect(
      screen.getByText("Add 0 to Sync List").closest("button")
    ).toBeDisabled();
  });

  it("has drag region header for window dragging", async () => {
    const { container } = render(<WizardPage {...defaultProps} />);
    const dragRegions = container.querySelectorAll(
      "[data-tauri-drag-region]"
    );
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

  it("shows agent paths", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("/Users/test/.claude")).toBeInTheDocument();
      expect(
        screen.getByText("/Users/test/.config/opencode")
      ).toBeInTheDocument();
      expect(
        screen.getByText("/Users/test/.aider.conf.yml")
      ).toBeInTheDocument();
    });
  });

  it("shows sibling files", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(".claude.json")).toBeInTheDocument();
    });
  });

  it("shows child items for directory agents", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Children are inside collapsible — should not be visible by default
      // but siblings labeled "Related files" should be visible
      expect(screen.getByText(".claude.json")).toBeInTheDocument();
    });
  });

  it("expands collapsible to show children", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // Find expand button for Claude Code (the chevron button)
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    if (expandBtn) {
      fireEvent.click(expandBtn);
    }

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
      expect(screen.getByText("settings.json")).toBeInTheDocument();
    });
  });

  it("handles scan failure gracefully", async () => {
    mockScanCodingConfigsTree.mockRejectedValue(new Error("Scan error"));
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("No AI CLI configs found")
      ).toBeInTheDocument();
    });
  });

  it("re-scans when Scan Again is clicked", async () => {
    mockScanCodingConfigsTree.mockResolvedValueOnce([]);
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Scan Again")).toBeInTheDocument();
    });

    mockScanCodingConfigsTree.mockResolvedValueOnce(
      JSON.parse(JSON.stringify(mockTrees))
    );
    fireEvent.click(screen.getByText("Scan Again"));

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    expect(mockScanCodingConfigsTree).toHaveBeenCalledTimes(2);
  });

  it("toggles agent parent checkbox to select/deselect all children", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // Find parent checkbox for Claude Code
    const claudeAgent = screen.getByText("Claude Code").closest("div")!;
    const parentCheckbox = claudeAgent
      .closest("[data-state]")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;

    // Deselect all children by clicking parent
    fireEvent.click(parentCheckbox);
    expect(parentCheckbox).not.toBeChecked();

    // Re-select all by clicking parent again
    fireEvent.click(parentCheckbox);
    expect(parentCheckbox).toBeChecked();
  });

  it("shows file icon for file-type agents", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Aider is a file-type agent, should be in the document
      expect(screen.getByText("Aider")).toBeInTheDocument();
      expect(
        screen.getByText("/Users/test/.aider.conf.yml")
      ).toBeInTheDocument();
    });
  });
});
