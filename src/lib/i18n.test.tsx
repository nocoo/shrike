import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  pluralizeItems,
  pluralizeFiles,
  pluralizeDirs,
  formatSynced,
  formatAddToSyncList,
  formatInstalledCli,
  formatDialogTitle,
  resolveLocale,
  LocaleProvider,
  useLocale,
} from "./i18n";

describe("pluralizeItems", () => {
  it("returns Chinese item suffix", () => {
    expect(pluralizeItems(0, "zh")).toBe("0 项");
    expect(pluralizeItems(5, "zh")).toBe("5 项");
  });

  it("returns English singular without trailing s", () => {
    expect(pluralizeItems(1, "en")).toBe("1 item");
  });

  it("returns English plural with trailing s", () => {
    expect(pluralizeItems(0, "en")).toBe("0 items");
    expect(pluralizeItems(2, "en")).toBe("2 items");
  });
});

describe("pluralizeFiles", () => {
  it("returns Chinese file count", () => {
    expect(pluralizeFiles(3, "zh")).toBe("3 个文件");
  });

  it("returns English singular for 1", () => {
    expect(pluralizeFiles(1, "en")).toBe("1 file");
  });

  it("returns English plural for non-1", () => {
    expect(pluralizeFiles(0, "en")).toBe("0 files");
    expect(pluralizeFiles(4, "en")).toBe("4 files");
  });
});

describe("pluralizeDirs", () => {
  it("returns Chinese dir count", () => {
    expect(pluralizeDirs(2, "zh")).toBe("2 个目录");
  });

  it("returns English singular for 1", () => {
    expect(pluralizeDirs(1, "en")).toBe("1 dir");
  });

  it("returns English plural for non-1", () => {
    expect(pluralizeDirs(7, "en")).toBe("7 dirs");
  });
});

describe("formatSynced", () => {
  it("formats files and dirs in English", () => {
    expect(formatSynced(3, 2, "en")).toBe("Synced 3 files, 2 dirs");
  });

  it("formats files and dirs in Chinese", () => {
    expect(formatSynced(3, 2, "zh")).toBe("已同步 3 个文件、2 个目录");
  });

  it("omits zero parts", () => {
    expect(formatSynced(5, 0, "en")).toBe("Synced 5 files");
    expect(formatSynced(0, 1, "zh")).toBe("已同步 1 个目录");
  });
});

describe("formatAddToSyncList", () => {
  it("formats Chinese variant", () => {
    expect(formatAddToSyncList(4, "zh")).toBe("添加 4 项到同步列表");
  });

  it("formats English variant", () => {
    expect(formatAddToSyncList(4, "en")).toBe("Add 4 to Sync List");
  });
});

describe("formatInstalledCli", () => {
  it("formats Chinese variant", () => {
    expect(formatInstalledCli(2, "zh")).toBe("已安装的 CLI (2)");
  });

  it("formats English variant", () => {
    expect(formatInstalledCli(2, "en")).toBe("Installed CLI (2)");
  });
});

describe("formatDialogTitle", () => {
  it("returns Chinese folder title", () => {
    expect(formatDialogTitle(true, "zh")).toBe("选择要备份的文件夹");
  });

  it("returns Chinese file title", () => {
    expect(formatDialogTitle(false, "zh")).toBe("选择要备份的文件");
  });

  it("returns English folder title", () => {
    expect(formatDialogTitle(true, "en")).toBe("Select folders to back up");
  });

  it("returns English file title", () => {
    expect(formatDialogTitle(false, "en")).toBe("Select files to back up");
  });
});

describe("resolveLocale", () => {
  const originalNavigator = globalThis.navigator;
  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("returns explicit zh", () => {
    expect(resolveLocale("zh")).toBe("zh");
  });

  it("returns explicit en", () => {
    expect(resolveLocale("en")).toBe("en");
  });

  it("auto detects zh from navigator language", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "zh-CN" },
      configurable: true,
    });
    expect(resolveLocale("auto")).toBe("zh");
  });

  it("auto detects en from non-zh navigator language", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-US" },
      configurable: true,
    });
    expect(resolveLocale("auto")).toBe("en");
  });

  it("auto falls back to en when navigator is undefined", () => {
    // jsdom always defines navigator; simulate by stubbing global to undefined
    const stub = vi
      .spyOn(globalThis, "navigator", "get")
      .mockReturnValue(undefined as unknown as Navigator);
    expect(resolveLocale("auto")).toBe("en");
    stub.mockRestore();
  });
});

describe("useLocale / LocaleProvider", () => {
  it("throws when used outside provider", () => {
    // Suppress React error boundary noise
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useLocale())).toThrow(
      /useLocale must be used within a LocaleProvider/
    );
    errSpy.mockRestore();
  });

  it("translates with current locale and updates on setLanguage", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initial="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useLocale(), { wrapper });
    expect(result.current.locale).toBe("en");
    expect(result.current.t("settings.save")).toBe("Save Settings");

    act(() => {
      result.current.setLanguage("zh");
    });
    expect(result.current.locale).toBe("zh");
    expect(result.current.t("settings.save")).toBe("保存设置");
  });

  it("returns the key itself when translation is missing", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initial="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useLocale(), { wrapper });
    // Cast to bypass TS — the runtime fallback is what we want to exercise
    const t = result.current.t as (key: string) => string;
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});
