/**
 * TypeScript types mirroring the Rust backend types.
 * These must stay in sync with src-tauri/src/types.rs.
 */

export type ItemType = "file" | "directory";

export interface BackupEntry {
  id: string;
  path: string;
  item_type: ItemType;
  added_at: string;
  last_synced: string | null;
}

export type Theme = "auto" | "light" | "dark";
export type Language = "auto" | "zh" | "en";

export interface AppSettings {
  gdrive_path: string;
  backup_dir_name: string;
  machine_name: string;
  webhook_port: number;
  webhook_token: string;
  show_tray_icon: boolean;
  show_dock_icon: boolean;
  autostart: boolean;
  theme: Theme;
  language: Language;
}

export interface SyncResult {
  files_transferred: number;
  dirs_transferred: number;
  bytes_transferred: number;
  stdout: string;
  stderr: string;
  exit_code: number;
  synced_at: string;
}

export type SyncStatus = "idle" | "running";

export interface DetectedConfig {
  agent: string;
  path: string;
  item_type: ItemType;
}

export interface TreeChild {
  name: string;
  path: string;
  item_type: ItemType;
}

export interface AgentTree {
  agent: string;
  path: string;
  item_type: ItemType;
  children: TreeChild[];
  siblings: TreeChild[];
}
