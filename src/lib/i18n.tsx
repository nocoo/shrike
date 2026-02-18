"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { Language } from "@/lib/types";

// ─── Translation keys ────────────────────────────────────────────

type TranslationKey = keyof typeof en;

const en = {
  // Page titles
  "title.settings": "Settings",
  "title.about": "About",
  "title.wizard": "AI CLI Backup",
  "title.syncLog": "Sync Log",

  // Settings — section headers
  "settings.general": "General",
  "settings.appearance": "Appearance",
  "settings.sync": "Sync",
  "settings.webhook": "Webhook",

  // Settings — General
  "settings.launchAtLogin": "Launch at Login",
  "settings.launchAtLoginDesc": "Start Shrike when you log in",
  "settings.showInMenuBar": "Show in Menu Bar",
  "settings.showInMenuBarDesc": "Display tray icon in the menu bar",
  "settings.showInDock": "Show in Dock",
  "settings.showInDockDesc": "Display app icon in the macOS Dock",

  // Settings — Appearance
  "settings.theme": "Theme",
  "settings.themeAuto": "Auto",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.language": "Language",
  "settings.languageAuto": "Auto",

  // Settings — Sync
  "settings.gdrivePath": "Google Drive Path",
  "settings.gdrivePathDesc": "Path to your Google Drive mount directory",
  "settings.backupDirName": "Backup Directory Name",
  "settings.machineName": "Machine Name",
  "settings.machineNameDesc": "Subfolder per device for multi-machine backup",

  // Settings — Webhook
  "settings.port": "Port",
  "settings.copyCurl": "Copy curl",
  "settings.copied": "Copied!",

  // Settings — Actions
  "settings.saving": "Saving...",
  "settings.save": "Save Settings",

  // Toolbar
  "toolbar.addFiles": "Add Files",
  "toolbar.addFolders": "Add Folders",

  // Drop zone
  "dropZone.drop": "Drop to add to backup list",
  "dropZone.drag": "Drag files or folders here",
  "dropZone.browse": "or click + to browse",

  // Sync button
  "sync.syncing": "Syncing...",
  "sync.syncNow": "Sync Now",

  // Sync log
  "syncLog.failed": "Sync failed",
  "syncLog.noResult": "No sync result",
  "syncLog.noChanges": "Synced (no changes)",
  "syncLog.noOutput": "No output",

  // Wizard
  "wizard.scanning": "Scanning for AI CLI configs...",
  "wizard.noConfigs": "No AI CLI configs found",
  "wizard.scanAgain": "Scan Again",
  "wizard.deselectAll": "Deselect all",
  "wizard.selectAll": "Select all",
  "wizard.allAdded": "All configs added to sync list",
  "wizard.done": "Done",
  "wizard.adding": "Adding...",

  // File list
  "fileList.other": "Other",

  // Loading
  "loading": "Loading...",
} as const;

const zh: Record<TranslationKey, string> = {
  // Page titles
  "title.settings": "设置",
  "title.about": "关于",
  "title.wizard": "AI CLI 备份",
  "title.syncLog": "同步日志",

  // Settings — section headers
  "settings.general": "通用",
  "settings.appearance": "外观",
  "settings.sync": "同步",
  "settings.webhook": "Webhook",

  // Settings — General
  "settings.launchAtLogin": "开机自启",
  "settings.launchAtLoginDesc": "登录时自动启动 Shrike",
  "settings.showInMenuBar": "显示菜单栏图标",
  "settings.showInMenuBarDesc": "在菜单栏中显示托盘图标",
  "settings.showInDock": "显示 Dock 图标",
  "settings.showInDockDesc": "在 macOS Dock 中显示应用图标",

  // Settings — Appearance
  "settings.theme": "主题",
  "settings.themeAuto": "自动",
  "settings.themeLight": "浅色",
  "settings.themeDark": "深色",
  "settings.language": "语言",
  "settings.languageAuto": "自动",

  // Settings — Sync
  "settings.gdrivePath": "Google Drive 路径",
  "settings.gdrivePathDesc": "Google Drive 挂载目录路径",
  "settings.backupDirName": "备份目录名",
  "settings.machineName": "设备名称",
  "settings.machineNameDesc": "多设备备份的子文件夹名",

  // Settings — Webhook
  "settings.port": "端口",
  "settings.copyCurl": "复制 curl",
  "settings.copied": "已复制！",

  // Settings — Actions
  "settings.saving": "保存中...",
  "settings.save": "保存设置",

  // Toolbar
  "toolbar.addFiles": "添加文件",
  "toolbar.addFolders": "添加文件夹",

  // Drop zone
  "dropZone.drop": "松开以添加到备份列表",
  "dropZone.drag": "拖放文件或文件夹到这里",
  "dropZone.browse": "或点击 + 浏览",

  // Sync button
  "sync.syncing": "同步中...",
  "sync.syncNow": "立即同步",

  // Sync log
  "syncLog.failed": "同步失败",
  "syncLog.noResult": "暂无同步结果",
  "syncLog.noChanges": "已同步（无变更）",
  "syncLog.noOutput": "无输出",

  // Wizard
  "wizard.scanning": "正在扫描 AI CLI 配置...",
  "wizard.noConfigs": "未找到 AI CLI 配置",
  "wizard.scanAgain": "重新扫描",
  "wizard.deselectAll": "取消全选",
  "wizard.selectAll": "全选",
  "wizard.allAdded": "所有配置已添加到同步列表",
  "wizard.done": "完成",
  "wizard.adding": "添加中...",

  // File list
  "fileList.other": "其他",

  // Loading
  "loading": "加载中...",
};

// ─── Pluralization helpers ───────────────────────────────────────

/**
 * Pluralize item count for toolbar: "3 items" / "3 项"
 */
export function pluralizeItems(count: number, locale: "en" | "zh"): string {
  if (locale === "zh") return `${count} 项`;
  return `${count} item${count !== 1 ? "s" : ""}`;
}

/**
 * Pluralize file count for sync log: "3 files" / "3 个文件"
 */
export function pluralizeFiles(count: number, locale: "en" | "zh"): string {
  if (locale === "zh") return `${count} 个文件`;
  return `${count} ${count === 1 ? "file" : "files"}`;
}

/**
 * Pluralize dir count for sync log: "2 dirs" / "2 个目录"
 */
export function pluralizeDirs(count: number, locale: "en" | "zh"): string {
  if (locale === "zh") return `${count} 个目录`;
  return `${count} ${count === 1 ? "dir" : "dirs"}`;
}

/**
 * Format "Synced X files, Y dirs" line.
 */
export function formatSynced(
  files: number,
  dirs: number,
  locale: "en" | "zh"
): string {
  const parts: string[] = [];
  if (files > 0) parts.push(pluralizeFiles(files, locale));
  if (dirs > 0) parts.push(pluralizeDirs(dirs, locale));
  if (locale === "zh") {
    return `已同步 ${parts.join("、")}`;
  }
  return `Synced ${parts.join(", ")}`;
}

/**
 * Format wizard "Add N to Sync List" button text.
 */
export function formatAddToSyncList(count: number, locale: "en" | "zh"): string {
  if (locale === "zh") return `添加 ${count} 项到同步列表`;
  return `Add ${count} to Sync List`;
}

/**
 * Format wizard "Installed CLI (N)" header.
 */
export function formatInstalledCli(count: number, locale: "en" | "zh"): string {
  if (locale === "zh") return `已安装的 CLI (${count})`;
  return `Installed CLI (${count})`;
}

/**
 * Format dialog title for file picker.
 */
export function formatDialogTitle(directory: boolean, locale: "en" | "zh"): string {
  if (locale === "zh") {
    return directory ? "选择要备份的文件夹" : "选择要备份的文件";
  }
  return directory ? "Select folders to back up" : "Select files to back up";
}

// ─── Translations map ────────────────────────────────────────────

const translations: Record<"en" | "zh", Record<TranslationKey, string>> = {
  en,
  zh,
};

// ─── Detect system locale ────────────────────────────────────────

function detectSystemLocale(): "en" | "zh" {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

/** Resolve the effective locale from Language setting. */
export function resolveLocale(setting: Language): "en" | "zh" {
  if (setting === "auto") return detectSystemLocale();
  return setting;
}

// ─── React Context ───────────────────────────────────────────────

interface LocaleContextValue {
  /** Current effective locale */
  locale: "en" | "zh";
  /** Translate a key */
  t: (key: TranslationKey) => string;
  /** Update the language setting (triggers re-resolve) */
  setLanguage: (lang: Language) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initial = "auto",
  children,
}: {
  initial?: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(initial);
  const locale = useMemo(() => resolveLocale(language), [language]);

  const t = useCallback(
    (key: TranslationKey) => translations[locale][key] ?? key,
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t, setLanguage }),
    [locale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
