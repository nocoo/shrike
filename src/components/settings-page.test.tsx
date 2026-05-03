import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";

// Mock next-themes
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: mockSetTheme,
    resolvedTheme: "light",
    themes: ["light", "dark", "system"],
  }),
}));

// Mock sonner toast so tests can assert on calls
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Tauri commands
const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockSetAutostart = vi.fn();
const mockSetTrayVisible = vi.fn();
const mockSetDockVisible = vi.fn();

vi.mock("@/lib/commands", () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  setAutostart: (...args: unknown[]) => mockSetAutostart(...args),
  setTrayVisible: (...args: unknown[]) => mockSetTrayVisible(...args),
  setDockVisible: (...args: unknown[]) => mockSetDockVisible(...args),
}));

import { SettingsPage } from "./settings-page";

const defaultSettings = {
  gdrive_path: "/Users/test/Library/CloudStorage/GoogleDrive-user@example.com/My Drive",
  backup_dir_name: "ShrikeBackup",
  machine_name: "TestMac",
  webhook_port: 7015,
  webhook_token: "test-token",
  show_tray_icon: true,
  show_dock_icon: true,
  autostart: false,
  theme: "auto",
  language: "auto",
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ ...defaultSettings });
    mockUpdateSettings.mockResolvedValue(undefined);
    mockSetAutostart.mockResolvedValue(undefined);
    mockSetTrayVisible.mockResolvedValue(undefined);
    mockSetDockVisible.mockResolvedValue(undefined);
  });

  it("renders settings title", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders back button", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const buttons = screen.getAllByRole("button");
    // First button is back arrow
    expect(buttons[0]).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    renderWithLocale(<SettingsPage onBack={onBack} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("loads and displays settings", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

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
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Appearance")).toBeInTheDocument();
      expect(screen.getByText("Sync")).toBeInTheDocument();
      expect(screen.getByText("Webhook")).toBeInTheDocument();
    });
  });

  it("renders autostart toggle", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Launch at Login")).toBeInTheDocument();
    });
  });

  it("renders tray icon toggle", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Show in Menu Bar")).toBeInTheDocument();
    });
  });

  it("calls setAutostart when autostart toggle is clicked", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

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
    renderWithLocale(<SettingsPage onBack={() => {}} />);

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

  it("renders dock icon toggle", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Show in Dock")).toBeInTheDocument();
      expect(
        screen.getByText("Display app icon in the macOS Dock")
      ).toBeInTheDocument();
    });
  });

  it("calls setDockVisible when dock toggle is clicked", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Show in Dock")).toBeInTheDocument();
    });

    // Find the dock switch (third switch)
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[2]);

    await waitFor(() => {
      expect(mockSetDockVisible).toHaveBeenCalledWith(false);
    });
  });

  it("saves settings and calls onBack", async () => {
    const onBack = vi.fn();
    renderWithLocale(<SettingsPage onBack={onBack} />);

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
    const { container } = renderWithLocale(<SettingsPage onBack={() => {}} />);
    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    // header + traffic light zone + content row = 3 drag regions
    expect(dragRegions.length).toBe(3);
  });

  it("prevents context menu", async () => {
    const { container } = renderWithLocale(<SettingsPage onBack={() => {}} />);
    const mainDiv = container.firstElementChild as HTMLElement;
    const event = new MouseEvent("contextmenu", { bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    mainDiv.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("renders theme selector buttons", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Theme")).toBeInTheDocument();
      // "Auto" appears twice (theme + language), so use getAllByText
      expect(screen.getAllByText("Auto")).toHaveLength(2);
      expect(screen.getByText("Light")).toBeInTheDocument();
      expect(screen.getByText("Dark")).toBeInTheDocument();
    });
  });

  it("renders language selector buttons", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Language")).toBeInTheDocument();
      // "Auto" already asserted above; check language-specific labels
      expect(screen.getByText("中文")).toBeInTheDocument();
      expect(screen.getByText("English")).toBeInTheDocument();
    });
  });

  it("calls updateSettings when theme is changed", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Dark")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Dark"));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark" })
      );
    });
  });

  it("calls updateSettings when language is changed", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("中文")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("中文"));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ language: "zh" })
      );
    });
  });

  it("shows toast when initial getSettings fails", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSettings.mockRejectedValueOnce(new Error("nope"));
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load data");
    });
    errSpy.mockRestore();
  });

  it("logs and toasts when handleSave fails", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateSettings.mockRejectedValueOnce(new Error("save fail"));
    const onBack = vi.fn();
    renderWithLocale(<SettingsPage onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });
    expect(onBack).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("logs and toasts when setAutostart rejects", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSetAutostart.mockRejectedValueOnce(new Error("boom"));
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Launch at Login")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update setting");
    });
    errSpy.mockRestore();
  });

  it("logs and toasts when setTrayVisible rejects", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSetTrayVisible.mockRejectedValueOnce(new Error("boom"));
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Show in Menu Bar")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole("switch")[1]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update setting");
    });
    errSpy.mockRestore();
  });

  it("logs and toasts when setDockVisible rejects", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSetDockVisible.mockRejectedValueOnce(new Error("boom"));
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Show in Dock")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole("switch")[2]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update setting");
    });
    errSpy.mockRestore();
  });

  it("logs and toasts when handleThemeChange rejects", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateSettings.mockRejectedValueOnce(new Error("boom"));
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Dark")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Dark"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update setting");
    });
    errSpy.mockRestore();
  });

  it("logs and toasts when handleLanguageChange rejects", async () => {
    const { toast } = await import("sonner");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateSettings.mockRejectedValueOnce(new Error("boom"));
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("中文")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("中文"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update setting");
    });
    errSpy.mockRestore();
  });

  it("updates gdrive path input", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const input = (await screen.findByLabelText("Google Drive Path")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/new/path" } });
    expect(input.value).toBe("/new/path");
  });

  it("updates backup directory name input", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const input = (await screen.findByLabelText("Backup Directory Name")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "MyBackup" } });
    expect(input.value).toBe("MyBackup");
  });

  it("updates machine name input", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const input = (await screen.findByLabelText("Machine Name")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Workstation" } });
    expect(input.value).toBe("Workstation");
  });

  it("updates webhook port input as a number", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const input = (await screen.findByLabelText("Port")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "8080" } });
    expect(input.value).toBe("8080");
  });

  it("falls back to default port when webhook port input is invalid", async () => {
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const input = (await screen.findByLabelText("Port")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    // parseInt returns NaN → fallback to 7015
    expect(input.value).toBe("7015");
  });

  it("copies the webhook curl command and toggles to Copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithLocale(<SettingsPage onBack={() => {}} />);
    const button = await screen.findByText("Copy curl");
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("Authorization: Bearer test-token")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    // Wait past the 2s timeout — label flips back to "Copy curl"
    await waitFor(
      () => {
        expect(screen.getByText("Copy curl")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("maps non-auto themes directly to next-themes setTheme", async () => {
    mockGetSettings.mockResolvedValueOnce({ ...defaultSettings, theme: "dark" });
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });
  });

  it("maps auto theme to next-themes 'system'", async () => {
    mockGetSettings.mockResolvedValueOnce({ ...defaultSettings, theme: "auto" });
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith("system");
    });
  });

  it("does not crash when handleSave is called before settings load", async () => {
    // Hold getSettings unresolved so settings stays null
    let resolve: (v: typeof defaultSettings) => void = () => {};
    mockGetSettings.mockImplementationOnce(
      () => new Promise<typeof defaultSettings>((r) => (resolve = r))
    );
    renderWithLocale(<SettingsPage onBack={() => {}} />);
    // Save button is gated by settings, so it should not be present
    expect(screen.queryByText("Save Settings")).not.toBeInTheDocument();
    // Resolve to clean up
    resolve(defaultSettings);
    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });
  });
});
