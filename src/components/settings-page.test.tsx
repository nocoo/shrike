import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock Tauri commands
const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockSetAutostart = vi.fn();
const mockSetTrayVisible = vi.fn();

vi.mock("@/lib/commands", () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  setAutostart: (...args: unknown[]) => mockSetAutostart(...args),
  setTrayVisible: (...args: unknown[]) => mockSetTrayVisible(...args),
}));

import { SettingsPage } from "./settings-page";

const defaultSettings = {
  gdrive_path: "/Users/test/Library/CloudStorage/GoogleDrive-user@example.com/My Drive",
  backup_dir_name: "ShrikeBackup",
  webhook_port: 7022,
  webhook_token: "test-token",
  show_tray_icon: true,
  autostart: false,
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ ...defaultSettings });
    mockUpdateSettings.mockResolvedValue(undefined);
    mockSetAutostart.mockResolvedValue(undefined);
    mockSetTrayVisible.mockResolvedValue(undefined);
  });

  it("renders settings title", async () => {
    render(<SettingsPage onBack={() => {}} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders back button", async () => {
    render(<SettingsPage onBack={() => {}} />);
    const buttons = screen.getAllByRole("button");
    // First button is back arrow
    expect(buttons[0]).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    render(<SettingsPage onBack={onBack} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("loads and displays settings", async () => {
    render(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Google Drive Path")).toHaveValue(
        defaultSettings.gdrive_path
      );
    });
  });

  it("renders section headers", async () => {
    render(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Sync")).toBeInTheDocument();
      expect(screen.getByText("Webhook")).toBeInTheDocument();
    });
  });

  it("renders autostart toggle", async () => {
    render(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Launch at Login")).toBeInTheDocument();
    });
  });

  it("renders tray icon toggle", async () => {
    render(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Show in Menu Bar")).toBeInTheDocument();
    });
  });

  it("calls setAutostart when autostart toggle is clicked", async () => {
    render(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Launch at Login")).toBeInTheDocument();
    });

    // Find the autostart switch (first switch)
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(mockSetAutostart).toHaveBeenCalledWith(true);
    });
  });

  it("calls setTrayVisible when tray toggle is clicked", async () => {
    render(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Show in Menu Bar")).toBeInTheDocument();
    });

    // Find the tray switch (second switch)
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[1]);

    await waitFor(() => {
      expect(mockSetTrayVisible).toHaveBeenCalledWith(false);
    });
  });

  it("saves settings and calls onBack", async () => {
    const onBack = vi.fn();
    render(<SettingsPage onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledOnce();
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  it("has drag region header for window dragging", async () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    // header + traffic light zone + content row = 3 drag regions
    expect(dragRegions.length).toBe(3);
  });

  it("prevents context menu", async () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    const mainDiv = container.firstElementChild as HTMLElement;
    const event = new MouseEvent("contextmenu", { bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    mainDiv.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
  });
});
