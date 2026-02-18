/**
 * Tauri command bindings.
 * Wraps invoke() calls to the Rust backend with proper types.
 */

import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, BackupEntry, SyncResult } from "./types";

export async function addEntry(path: string): Promise<BackupEntry> {
  return invoke<BackupEntry>("add_entry", { path });
}

export async function removeEntry(id: string): Promise<void> {
  return invoke<void>("remove_entry", { id });
}

export async function listEntries(): Promise<BackupEntry[]> {
  return invoke<BackupEntry[]>("list_entries");
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSettings(
  settings: AppSettings
): Promise<void> {
  return invoke<void>("update_settings", { settings });
}

export async function triggerSync(): Promise<SyncResult> {
  return invoke<SyncResult>("trigger_sync");
}

export async function getAutostart(): Promise<boolean> {
  return invoke<boolean>("get_autostart");
}

export async function setAutostart(enabled: boolean): Promise<void> {
  return invoke<void>("set_autostart", { enabled });
}

export async function setTrayVisible(visible: boolean): Promise<void> {
  return invoke<void>("set_tray_visible", { visible });
}
