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
import { shouldDefaultSelect } from "./wizard-page";
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

  it("shows installed CLI count header", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Installed CLI (3)")).toBeInTheDocument();
    });
  });

  it("smart default selection: important items selected, others not", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Visible checkboxes when collapsed:
      // Claude Code: 1 parent (indeterminate — settings.json selected, projects not)
      // OpenCode: 1 parent (checked — opencode.json selected)
      // Aider: 1 file (checked)
      // Total visible = 3
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
    });

    // Smart defaults: 4 of 5 selectable paths are selected
    // (projects not selected, settings.json + .claude.json + opencode.json + aider = 4)
    expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
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

    // Find the "settings.json" checkbox — it's a child of Claude Code, selected by default
    const settingsLabel = screen.getByText("settings.json");
    const checkbox = settingsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;

    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("shows correct add button text with smart default count", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Smart defaults: settings.json + .claude.json + opencode.json + aider = 4
      // (projects is NOT default-selected for Claude Code)
      expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
    });
  });

  it("updates add button count when child is toggled", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
    });

    // Expand Claude Code collapsible
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("settings.json")).toBeInTheDocument();
    });

    // Deselect settings.json
    const settingsLabel = screen.getByText("settings.json");
    const checkbox = settingsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(screen.getByText("Add 3 to Sync List")).toBeInTheDocument();
  });

  it("calls addEntry for selected paths with smart folding", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
    });

    // Select "projects" too so all children are selected → triggers folding
    // Expand Claude Code collapsible
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
    });

    // Select projects (it's NOT selected by default)
    const projectsLabel = screen.getByText("projects");
    const projectsCheckbox = projectsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(projectsCheckbox);

    // Now all 5 are selected
    expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();

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
      // Default: settings.json selected, projects NOT selected → not all children
      expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
    });

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
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // First, select all items (including projects which is not default-selected)
    // Expand Claude Code collapsible
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
    });

    // Select projects
    const projectsLabel = screen.getByText("projects");
    const projectsCheckbox = projectsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(projectsCheckbox);

    expect(screen.getByText("Add 5 to Sync List")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add 5 to Sync List"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("calls onDone when Done button is clicked", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // Select all (including projects)
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByText("projects")).toBeInTheDocument();
    });

    const projectsLabel = screen.getByText("projects");
    const projectsCheckbox = projectsLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(projectsCheckbox);

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
      expect(screen.getByText("Add 4 to Sync List")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add 4 to Sync List"));

    // The first path to fail is settings.json (inside collapsible)
    // Need to expand Claude Code collapsible to see the error
    await waitFor(() => {
      const claudeRow = screen.getByText("Claude Code").closest("div")!;
      const expandBtn = claudeRow
        .closest("[data-state]")!
        .querySelector("button");
      fireEvent.click(expandBtn!);
    });

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("disables add button when no items selected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // 3 visible checkboxes (collapsibles closed)
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    });

    // With smart defaults, starts with "Select all" (not all selected)
    // First select all, then deselect all
    fireEvent.click(screen.getByText("Select all"));
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

  it("shows Deselect all when smart defaults are not all selected", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      // Not all items are selected (projects is deselected), so shows "Select all"
      // Wait, let me check: allSelected checks if every path is selected or added
      // projects is NOT selected → allSelected = false → shows "Select all"
      expect(screen.getByText("Select all")).toBeInTheDocument();
    });
  });

  it("toggles between Select all and Deselect all", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Select all")).toBeInTheDocument();
    });

    // Click Select all to select everything
    fireEvent.click(screen.getByText("Select all"));
    expect(screen.getByText("Deselect all")).toBeInTheDocument();

    // Click Deselect all
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

  it("shows sibling files inside collapsible as peers", async () => {
    render(<WizardPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
    });

    // Siblings are now inside the collapsible, not visible by default
    expect(screen.queryByText(".claude.json")).not.toBeInTheDocument();

    // Expand Claude Code collapsible
    const claudeRow = screen.getByText("Claude Code").closest("div")!;
    const expandBtn = claudeRow
      .closest("[data-state]")!
      .querySelector("button");
    fireEvent.click(expandBtn!);

    await waitFor(() => {
      // Now siblings appear as peers alongside children
      expect(screen.getByText(".claude.json")).toBeInTheDocument();
      expect(screen.getByText("projects")).toBeInTheDocument();
      expect(screen.getByText("settings.json")).toBeInTheDocument();
    });
  });

  it("expands collapsible to show children and siblings", async () => {
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
      expect(screen.getByText(".claude.json")).toBeInTheDocument();
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

    // Claude parent is indeterminate (settings.json selected, projects not)
    // Clicking indeterminate → deselects all
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

describe("shouldDefaultSelect", () => {
  it("selects important Claude Code children", () => {
    expect(shouldDefaultSelect("Claude Code", "settings.json")).toBe(true);
    expect(shouldDefaultSelect("Claude Code", "commands")).toBe(true);
    expect(shouldDefaultSelect("Claude Code", "skills")).toBe(true);
    expect(shouldDefaultSelect("Claude Code", "CLAUDE.md")).toBe(true);
    expect(shouldDefaultSelect("Claude Code", "plugins")).toBe(true);
  });

  it("skips unimportant Claude Code children", () => {
    expect(shouldDefaultSelect("Claude Code", "projects")).toBe(false);
    expect(shouldDefaultSelect("Claude Code", "transcripts")).toBe(false);
    expect(shouldDefaultSelect("Claude Code", "debug")).toBe(false);
    expect(shouldDefaultSelect("Claude Code", "telemetry")).toBe(false);
  });

  it("selects important OpenCode children", () => {
    expect(shouldDefaultSelect("OpenCode", "opencode.json")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "commands")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "skills")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "plugin")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "agents")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "modes")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "tools")).toBe(true);
    expect(shouldDefaultSelect("OpenCode", "themes")).toBe(true);
  });

  it("skips OpenCode node_modules via skip patterns", () => {
    expect(shouldDefaultSelect("OpenCode", "node_modules")).toBe(false);
  });

  it("selects important Cursor children", () => {
    expect(shouldDefaultSelect("Cursor", "rules")).toBe(true);
    expect(shouldDefaultSelect("Cursor", "commands")).toBe(true);
    expect(shouldDefaultSelect("Cursor", "cli-config.json")).toBe(true);
  });

  it("skips Cursor extensions", () => {
    expect(shouldDefaultSelect("Cursor", "extensions")).toBe(false);
  });

  it("applies universal skip patterns", () => {
    expect(shouldDefaultSelect("Windsurf", "package-lock.json")).toBe(false);
    expect(shouldDefaultSelect("Windsurf", "bun.lock")).toBe(false);
    expect(shouldDefaultSelect("Windsurf", "node_modules")).toBe(false);
    expect(shouldDefaultSelect("Windsurf", "stats-cache.json")).toBe(false);
    expect(shouldDefaultSelect("Windsurf", "paste-cache")).toBe(false);
    expect(shouldDefaultSelect("Windsurf", "Cache")).toBe(false);
  });

  it("selects all children for agents without explicit important list", () => {
    // Windsurf has no IMPORTANT_CHILDREN entry → all selected by default
    expect(shouldDefaultSelect("Windsurf", "mcp_config.json")).toBe(true);
    expect(shouldDefaultSelect("Windsurf", "config.json")).toBe(true);
  });

  it("skip patterns take precedence over important list", () => {
    // Even if "cache" were in the important list, skip patterns would reject it
    expect(shouldDefaultSelect("Claude Code", "stats-cache.json")).toBe(false);
  });
});
