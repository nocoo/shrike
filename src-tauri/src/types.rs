use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use std::path::{Path, PathBuf};

/// The type of a backup entry (file or directory).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemType {
    File,
    Directory,
}

/// A single file or directory tracked for backup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackupEntry {
    pub id: Uuid,
    pub path: String,
    pub item_type: ItemType,
    pub added_at: DateTime<Utc>,
    pub last_synced: Option<DateTime<Utc>>,
}

impl BackupEntry {
    /// Create a new backup entry for the given path and type.
    pub fn new(path: String, item_type: ItemType) -> Self {
        Self {
            id: Uuid::new_v4(),
            path,
            item_type,
            added_at: Utc::now(),
            last_synced: None,
        }
    }
}

/// Detect the Google Drive "My Drive" path on macOS.
///
/// Scans `~/Library/CloudStorage/` for directories matching `GoogleDrive-*`,
/// then looks inside for the user's drive root directory (e.g. "My Drive",
/// "我的云端硬盘", "マイドライブ", etc.) by picking the first visible,
/// non-special subdirectory.
///
/// Returns `None` if Google Drive is not installed or no drive root is found.
pub fn detect_gdrive_path(cloud_storage_dir: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(cloud_storage_dir).ok()?;

    // Find the first GoogleDrive-* directory
    let gdrive_account = entries.filter_map(|e| e.ok()).find(|e| {
        e.file_name().to_string_lossy().starts_with("GoogleDrive-") && e.path().is_dir()
    })?;

    // Known special directories inside the account folder to skip
    const SKIP_NAMES: &[&str] = &["Computers", "其他计算机", "他のパソコン"];

    // Look for the drive root: first non-hidden, non-special subdirectory
    let account_path = gdrive_account.path();
    let children = std::fs::read_dir(&account_path).ok()?;

    let drive_root = children
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            e.path().is_dir()
                && !name_str.starts_with('.')
                && !SKIP_NAMES.contains(&name_str.as_ref())
        })
        .min_by_key(|e| {
            // Prefer "My Drive" or localized equivalents over other dirs
            let name = e.file_name().to_string_lossy().to_string();
            if name == "My Drive" {
                0
            } else {
                1
            }
        })?;

    Some(drive_root.path())
}

/// Return the default CloudStorage directory for the current user.
pub fn default_cloud_storage_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join("Library/CloudStorage"))
}

/// Application settings persisted in the Tauri store.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppSettings {
    pub gdrive_path: String,
    pub backup_dir_name: String,
    pub webhook_port: u16,
    pub webhook_token: String,
    #[serde(default = "default_true")]
    pub show_tray_icon: bool,
    #[serde(default = "default_true")]
    pub show_dock_icon: bool,
    #[serde(default)]
    pub autostart: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        let gdrive_path = default_cloud_storage_dir()
            .and_then(|dir| detect_gdrive_path(&dir))
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        Self {
            gdrive_path,
            backup_dir_name: String::from("ShrikeBackup"),
            webhook_port: 7022,
            webhook_token: Uuid::new_v4().to_string(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
        }
    }
}

impl AppSettings {
    /// Full destination path for rsync: gdrive_path/backup_dir_name
    pub fn destination_path(&self) -> String {
        format!("{}/{}", self.gdrive_path, self.backup_dir_name)
    }
}

/// The full store schema persisted by Tauri Store Plugin.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoreData {
    pub items: Vec<BackupEntry>,
    pub settings: AppSettings,
}

/// Summary of a completed sync operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    /// Number of files transferred
    pub files_transferred: u64,
    /// Total bytes transferred
    pub bytes_transferred: u64,
    /// rsync stdout (verbose output)
    pub stdout: String,
    /// rsync stderr (warnings/errors)
    pub stderr: String,
    /// rsync exit code
    pub exit_code: i32,
    /// Timestamp of this sync
    pub synced_at: DateTime<Utc>,
}

impl SyncResult {
    pub fn is_success(&self) -> bool {
        self.exit_code == 0
    }
}

/// Current status of the sync engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Idle,
    Running,
}

/// A detected coding agent configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectedConfig {
    /// Display name of the coding agent (e.g. "Claude Code")
    pub agent: String,
    /// Absolute path to the config directory or file
    pub path: String,
    /// Whether this is a directory or single file
    pub item_type: ItemType,
}

/// Known coding agent configuration locations (macOS).
///
/// Each tuple: (agent_name, relative_path_from_home, is_directory).
const KNOWN_AGENT_CONFIGS: &[(&str, &str, bool)] = &[
    // Claude Code
    ("Claude Code", ".claude", true),
    // Cursor
    ("Cursor", ".cursor", true),
    // OpenCode
    ("OpenCode", ".config/opencode", true),
    // Windsurf
    ("Windsurf", ".windsurf", true),
    // GitHub Copilot
    ("GitHub Copilot", ".config/github-copilot", true),
    // Aider
    ("Aider", ".aider.conf.yml", false),
    // VS Code
    ("VS Code", "Library/Application Support/Code/User", true),
];

/// Scan the user's home directory for known coding agent configurations.
///
/// Returns a list of detected configs that actually exist on disk.
pub fn scan_coding_configs(home_dir: &Path) -> Vec<DetectedConfig> {
    KNOWN_AGENT_CONFIGS
        .iter()
        .filter_map(|(agent, rel_path, is_dir)| {
            let full_path = home_dir.join(rel_path);
            if full_path.exists() {
                Some(DetectedConfig {
                    agent: (*agent).to_string(),
                    path: full_path.to_string_lossy().to_string(),
                    item_type: if *is_dir {
                        ItemType::Directory
                    } else {
                        ItemType::File
                    },
                })
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_entry_new_sets_fields() {
        let entry = BackupEntry::new("/Users/nocoo/.zshrc".into(), ItemType::File);
        assert_eq!(entry.path, "/Users/nocoo/.zshrc");
        assert_eq!(entry.item_type, ItemType::File);
        assert!(entry.last_synced.is_none());
        // id should be a valid uuid v4
        assert_eq!(entry.id.get_version(), Some(uuid::Version::Random));
    }

    #[test]
    fn backup_entry_serializes_to_json() {
        let entry = BackupEntry::new("/tmp/test".into(), ItemType::Directory);
        let json = serde_json::to_value(&entry).unwrap();
        assert_eq!(json["path"], "/tmp/test");
        assert_eq!(json["item_type"], "directory");
        assert!(json["last_synced"].is_null());
    }

    #[test]
    fn backup_entry_roundtrips_json() {
        let entry = BackupEntry::new("/foo/bar".into(), ItemType::File);
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: BackupEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(entry, deserialized);
    }

    #[test]
    fn app_settings_default_values() {
        let settings = AppSettings::default();
        // gdrive_path is auto-detected; may be empty if Google Drive not installed
        assert_eq!(settings.backup_dir_name, "ShrikeBackup");
        assert_eq!(settings.webhook_port, 7022);
        assert!(!settings.webhook_token.is_empty());
        assert!(settings.show_tray_icon);
        assert!(settings.show_dock_icon);
        assert!(!settings.autostart);
    }

    #[test]
    fn app_settings_destination_path() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "Backup".into(),
            webhook_port: 8080,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
        };
        assert_eq!(settings.destination_path(), "/mnt/gdrive/Backup");
    }

    #[test]
    fn store_data_default_empty() {
        let store = StoreData::default();
        assert!(store.items.is_empty());
        assert_eq!(store.settings.webhook_port, 7022);
    }

    // --- detect_gdrive_path ---

    #[test]
    fn detect_gdrive_no_cloud_storage_dir() {
        let dir = tempfile::tempdir().unwrap();
        let result = detect_gdrive_path(&dir.path().join("nonexistent"));
        assert!(result.is_none());
    }

    #[test]
    fn detect_gdrive_empty_cloud_storage() {
        let dir = tempfile::tempdir().unwrap();
        let result = detect_gdrive_path(dir.path());
        assert!(result.is_none());
    }

    #[test]
    fn detect_gdrive_finds_my_drive() {
        let dir = tempfile::tempdir().unwrap();
        let account = dir.path().join("GoogleDrive-user@example.com");
        std::fs::create_dir_all(account.join("My Drive")).unwrap();
        std::fs::create_dir_all(account.join(".hidden")).unwrap();

        let result = detect_gdrive_path(dir.path());
        assert!(result.is_some());
        let path = result.unwrap();
        assert!(path.to_string_lossy().ends_with("My Drive"));
    }

    #[test]
    fn detect_gdrive_finds_localized_name() {
        let dir = tempfile::tempdir().unwrap();
        let account = dir.path().join("GoogleDrive-user@example.com");
        std::fs::create_dir_all(account.join("我的云端硬盘")).unwrap();

        let result = detect_gdrive_path(dir.path());
        assert!(result.is_some());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("我的云端硬盘"));
    }

    #[test]
    fn detect_gdrive_skips_hidden_and_special_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let account = dir.path().join("GoogleDrive-user@example.com");
        std::fs::create_dir_all(account.join(".Encrypted")).unwrap();
        std::fs::create_dir_all(account.join(".Trash")).unwrap();
        std::fs::create_dir_all(account.join("Computers")).unwrap();
        std::fs::create_dir_all(account.join("其他计算机")).unwrap();

        let result = detect_gdrive_path(dir.path());
        // No valid drive root found — all are hidden or special
        assert!(result.is_none());
    }

    #[test]
    fn detect_gdrive_prefers_my_drive_over_others() {
        let dir = tempfile::tempdir().unwrap();
        let account = dir.path().join("GoogleDrive-user@example.com");
        std::fs::create_dir_all(account.join("My Drive")).unwrap();
        std::fs::create_dir_all(account.join("Shared drives")).unwrap();

        let result = detect_gdrive_path(dir.path());
        assert!(result.is_some());
        assert!(result.unwrap().to_string_lossy().ends_with("My Drive"));
    }

    #[test]
    fn detect_gdrive_skips_non_gdrive_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("OneDrive-Personal/Documents")).unwrap();
        std::fs::create_dir_all(dir.path().join("Dropbox/Files")).unwrap();

        let result = detect_gdrive_path(dir.path());
        assert!(result.is_none());
    }

    #[test]
    fn detect_gdrive_real_system() {
        // On this machine, Google Drive should be detectable
        if let Some(cloud_dir) = default_cloud_storage_dir() {
            if cloud_dir.exists() {
                let result = detect_gdrive_path(&cloud_dir);
                // If Google Drive is installed, path should contain GoogleDrive
                if let Some(path) = result {
                    assert!(path.to_string_lossy().contains("GoogleDrive"));
                    assert!(path.is_dir());
                }
            }
        }
    }

    #[test]
    fn sync_result_success() {
        let result = SyncResult {
            files_transferred: 5,
            bytes_transferred: 1024,
            stdout: "sent 1024 bytes".into(),
            stderr: String::new(),
            exit_code: 0,
            synced_at: Utc::now(),
        };
        assert!(result.is_success());
    }

    #[test]
    fn sync_result_failure() {
        let result = SyncResult {
            files_transferred: 0,
            bytes_transferred: 0,
            stdout: String::new(),
            stderr: "rsync error".into(),
            exit_code: 23,
            synced_at: Utc::now(),
        };
        assert!(!result.is_success());
    }

    #[test]
    fn sync_status_serializes() {
        let status = SyncStatus::Running;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"running\"");
    }

    #[test]
    fn item_type_serializes_snake_case() {
        let file = ItemType::File;
        let dir = ItemType::Directory;
        assert_eq!(serde_json::to_string(&file).unwrap(), "\"file\"");
        assert_eq!(serde_json::to_string(&dir).unwrap(), "\"directory\"");
    }

    #[test]
    fn app_settings_serde_defaults_for_new_fields() {
        // Simulate loading old settings JSON that lacks show_tray_icon, show_dock_icon, and autostart
        let json = r#"{
            "gdrive_path": "/some/path",
            "backup_dir_name": "Backup",
            "webhook_port": 7022,
            "webhook_token": "abc"
        }"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert!(settings.show_tray_icon); // default_true
        assert!(settings.show_dock_icon); // default_true
        assert!(!settings.autostart); // default false
    }

    #[test]
    fn app_settings_roundtrips_with_new_fields() {
        let settings = AppSettings {
            gdrive_path: "/test".into(),
            backup_dir_name: "B".into(),
            webhook_port: 9000,
            webhook_token: "tok".into(),
            show_tray_icon: false,
            show_dock_icon: false,
            autostart: true,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, deserialized);
        assert!(!deserialized.show_tray_icon);
        assert!(!deserialized.show_dock_icon);
        assert!(deserialized.autostart);
    }

    // --- scan_coding_configs ---

    #[test]
    fn scan_coding_configs_empty_home() {
        let dir = tempfile::tempdir().unwrap();
        let results = scan_coding_configs(dir.path());
        assert!(results.is_empty());
    }

    #[test]
    fn scan_coding_configs_finds_claude() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".claude")).unwrap();
        let results = scan_coding_configs(dir.path());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "Claude Code");
        assert_eq!(results[0].item_type, ItemType::Directory);
        assert!(results[0].path.ends_with(".claude"));
    }

    #[test]
    fn scan_coding_configs_finds_cursor() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".cursor")).unwrap();
        let results = scan_coding_configs(dir.path());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "Cursor");
    }

    #[test]
    fn scan_coding_configs_finds_aider_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".aider.conf.yml"), "model: gpt-4").unwrap();
        let results = scan_coding_configs(dir.path());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "Aider");
        assert_eq!(results[0].item_type, ItemType::File);
    }

    #[test]
    fn scan_coding_configs_finds_multiple() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".claude")).unwrap();
        std::fs::create_dir_all(dir.path().join(".cursor")).unwrap();
        std::fs::create_dir_all(dir.path().join(".config/opencode")).unwrap();
        let results = scan_coding_configs(dir.path());
        assert_eq!(results.len(), 3);
        let agents: Vec<&str> = results.iter().map(|c| c.agent.as_str()).collect();
        assert!(agents.contains(&"Claude Code"));
        assert!(agents.contains(&"Cursor"));
        assert!(agents.contains(&"OpenCode"));
    }

    #[test]
    fn scan_coding_configs_skips_nonexistent() {
        let dir = tempfile::tempdir().unwrap();
        // Only create one, others should be skipped
        std::fs::create_dir_all(dir.path().join(".claude")).unwrap();
        let results = scan_coding_configs(dir.path());
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn scan_coding_configs_serializes() {
        let config = DetectedConfig {
            agent: "Claude Code".into(),
            path: "/Users/test/.claude".into(),
            item_type: ItemType::Directory,
        };
        let json = serde_json::to_value(&config).unwrap();
        assert_eq!(json["agent"], "Claude Code");
        assert_eq!(json["path"], "/Users/test/.claude");
        assert_eq!(json["item_type"], "directory");
    }
}
