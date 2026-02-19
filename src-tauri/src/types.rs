use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use std::path::{Component, Path, PathBuf};

use crate::error::ShrikeError;

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
    #[serde(default = "default_machine_name")]
    pub machine_name: String,
    pub webhook_port: u16,
    pub webhook_token: String,
    #[serde(default = "default_true")]
    pub show_tray_icon: bool,
    #[serde(default = "default_true")]
    pub show_dock_icon: bool,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default = "default_auto")]
    pub theme: String,
    #[serde(default = "default_auto")]
    pub language: String,
}

fn default_auto() -> String {
    "auto".to_string()
}

fn default_true() -> bool {
    true
}

/// Return the local machine's short hostname (e.g. "Mac", "MacBook-Pro").
fn default_machine_name() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_default()
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
            machine_name: default_machine_name(),
            webhook_port: 7022,
            webhook_token: Uuid::new_v4().to_string(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".to_string(),
            language: "auto".to_string(),
        }
    }
}

impl AppSettings {
    /// Full destination path for rsync: gdrive_path/backup_dir_name/machine_name
    ///
    /// Returns an error if:
    /// - `gdrive_path` is empty (Google Drive not detected)
    /// - `backup_dir_name` or `machine_name` contain path traversal (`..`)
    ///   or path separators (`/`)
    pub fn destination_path(&self) -> Result<String, ShrikeError> {
        if self.gdrive_path.is_empty() {
            return Err(ShrikeError::SyncFailed(
                "Google Drive path is not configured".to_string(),
            ));
        }

        // Sanitize backup_dir_name: must be a single, safe path component
        Self::validate_path_component(&self.backup_dir_name, "backup directory name")?;
        // Sanitize machine_name: must be a single, safe path component
        Self::validate_path_component(&self.machine_name, "machine name")?;

        Ok(format!(
            "{}/{}/{}",
            self.gdrive_path, self.backup_dir_name, self.machine_name
        ))
    }

    /// Validate that a string is a safe, single path component.
    ///
    /// Rejects empty strings, path separators, `..` traversal, and
    /// any component that is not a normal filename.
    fn validate_path_component(value: &str, field_name: &str) -> Result<(), ShrikeError> {
        if value.is_empty() {
            return Err(ShrikeError::SyncFailed(format!(
                "{field_name} cannot be empty"
            )));
        }

        // Must be a single normal component (no `/`, `..`, `.`)
        let path = Path::new(value);
        let components: Vec<Component> = path.components().collect();
        if components.len() != 1 {
            return Err(ShrikeError::SyncFailed(format!(
                "{field_name} contains path separators: {value}"
            )));
        }
        match components[0] {
            Component::Normal(_) => Ok(()),
            _ => Err(ShrikeError::SyncFailed(format!(
                "{field_name} contains invalid path component: {value}"
            ))),
        }
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
    /// Number of files transferred (not counting directories)
    pub files_transferred: u64,
    /// Number of directories transferred
    pub dirs_transferred: u64,
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

/// A child entry inside an agent's config directory (first level only).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TreeChild {
    /// File or directory name (not full path)
    pub name: String,
    /// Absolute path
    pub path: String,
    /// Whether this is a file or directory
    pub item_type: ItemType,
}

/// A tree-structured view of a coding agent's configuration.
///
/// Groups the agent's main config directory, its first-level children,
/// and any sibling files (e.g. `.claude.json` next to `.claude/`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentTree {
    /// Display name of the coding agent
    pub agent: String,
    /// Absolute path to the main config directory or file
    pub path: String,
    /// Whether the main config is a directory or file
    pub item_type: ItemType,
    /// First-level children (empty if main config is a file)
    pub children: Vec<TreeChild>,
    /// Sibling files that live next to the main config (e.g. `.claude.json`)
    pub siblings: Vec<TreeChild>,
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

/// Known sibling file patterns for each agent.
///
/// Each tuple: (agent_name, relative_sibling_path_from_home).
/// These are files that sit alongside the main config directory.
const KNOWN_AGENT_SIBLINGS: &[(&str, &str)] = &[("Claude Code", ".claude.json")];

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

/// Scan the user's home directory for known coding agent configurations,
/// returning a tree structure with first-level children and sibling files.
pub fn scan_coding_configs_tree(home_dir: &Path) -> Vec<AgentTree> {
    KNOWN_AGENT_CONFIGS
        .iter()
        .filter_map(|(agent, rel_path, is_dir)| {
            let full_path = home_dir.join(rel_path);
            if !full_path.exists() {
                return None;
            }

            let item_type = if *is_dir {
                ItemType::Directory
            } else {
                ItemType::File
            };

            // Collect first-level children for directories
            let children = if *is_dir {
                list_first_level_children(&full_path)
            } else {
                Vec::new()
            };

            // Collect sibling files
            let siblings = KNOWN_AGENT_SIBLINGS
                .iter()
                .filter(|(a, _)| *a == *agent)
                .filter_map(|(_, sibling_rel)| {
                    let sibling_path = home_dir.join(sibling_rel);
                    if sibling_path.exists() {
                        let sibling_type = if sibling_path.is_dir() {
                            ItemType::Directory
                        } else {
                            ItemType::File
                        };
                        Some(TreeChild {
                            name: sibling_rel.to_string(),
                            path: sibling_path.to_string_lossy().to_string(),
                            item_type: sibling_type,
                        })
                    } else {
                        None
                    }
                })
                .collect();

            Some(AgentTree {
                agent: (*agent).to_string(),
                path: full_path.to_string_lossy().to_string(),
                item_type,
                children,
                siblings,
            })
        })
        .collect()
}

/// List first-level children of a directory, sorted alphabetically.
/// Skips hidden files/directories (starting with '.') and .DS_Store.
fn list_first_level_children(dir: &Path) -> Vec<TreeChild> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut children: Vec<TreeChild> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            // Skip hidden files and .DS_Store
            !name_str.starts_with('.')
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            let item_type = if e.path().is_dir() {
                ItemType::Directory
            } else {
                ItemType::File
            };
            TreeChild {
                name,
                path,
                item_type,
            }
        })
        .collect();

    // Sort: directories first, then files, alphabetically within each group
    children.sort_by(|a, b| match (&a.item_type, &b.item_type) {
        (ItemType::Directory, ItemType::File) => std::cmp::Ordering::Less,
        (ItemType::File, ItemType::Directory) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    children
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
        assert!(!settings.machine_name.is_empty()); // auto-detected hostname
        assert_eq!(settings.webhook_port, 7022);
        assert!(!settings.webhook_token.is_empty());
        assert!(settings.show_tray_icon);
        assert!(settings.show_dock_icon);
        assert!(!settings.autostart);
        assert_eq!(settings.theme, "auto");
        assert_eq!(settings.language, "auto");
    }

    #[test]
    fn app_settings_destination_path() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "Backup".into(),
            machine_name: "TestMac".into(),
            webhook_port: 8080,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".into(),
            language: "auto".into(),
        };
        assert_eq!(
            settings.destination_path().unwrap(),
            "/mnt/gdrive/Backup/TestMac"
        );
    }

    #[test]
    fn destination_path_rejects_empty_gdrive() {
        let settings = AppSettings {
            gdrive_path: String::new(),
            backup_dir_name: "Backup".into(),
            machine_name: "TestMac".into(),
            webhook_port: 7022,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".into(),
            language: "auto".into(),
        };
        let err = settings.destination_path().unwrap_err();
        assert!(err.to_string().contains("Google Drive path"));
    }

    #[test]
    fn destination_path_rejects_traversal_in_backup_dir() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "../etc".into(),
            machine_name: "TestMac".into(),
            webhook_port: 7022,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".into(),
            language: "auto".into(),
        };
        let err = settings.destination_path().unwrap_err();
        assert!(err.to_string().contains("path separators"));
    }

    #[test]
    fn destination_path_rejects_traversal_in_machine_name() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "Backup".into(),
            machine_name: "../../root".into(),
            webhook_port: 7022,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".into(),
            language: "auto".into(),
        };
        let err = settings.destination_path().unwrap_err();
        assert!(err.to_string().contains("path separators"));
    }

    #[test]
    fn destination_path_rejects_slash_in_backup_dir() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "back/up".into(),
            machine_name: "TestMac".into(),
            webhook_port: 7022,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".into(),
            language: "auto".into(),
        };
        let err = settings.destination_path().unwrap_err();
        assert!(err.to_string().contains("path separators"));
    }

    #[test]
    fn destination_path_rejects_dotdot_machine_name() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "Backup".into(),
            machine_name: "..".into(),
            webhook_port: 7022,
            webhook_token: "token".into(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".into(),
            language: "auto".into(),
        };
        let err = settings.destination_path().unwrap_err();
        assert!(err.to_string().contains("invalid path component"));
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
            dirs_transferred: 2,
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
            dirs_transferred: 0,
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
        // Simulate loading old settings JSON that lacks machine_name, show_tray_icon, show_dock_icon, and autostart
        let json = r#"{
            "gdrive_path": "/some/path",
            "backup_dir_name": "Backup",
            "webhook_port": 7022,
            "webhook_token": "abc"
        }"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert!(!settings.machine_name.is_empty()); // default_machine_name
        assert!(settings.show_tray_icon); // default_true
        assert!(settings.show_dock_icon); // default_true
        assert!(!settings.autostart); // default false
        assert_eq!(settings.theme, "auto"); // default_auto
        assert_eq!(settings.language, "auto"); // default_auto
    }

    #[test]
    fn app_settings_roundtrips_with_new_fields() {
        let settings = AppSettings {
            gdrive_path: "/test".into(),
            backup_dir_name: "B".into(),
            machine_name: "M".into(),
            webhook_port: 9000,
            webhook_token: "tok".into(),
            show_tray_icon: false,
            show_dock_icon: false,
            autostart: true,
            theme: "dark".into(),
            language: "zh".into(),
        };
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, deserialized);
        assert!(!deserialized.show_tray_icon);
        assert!(!deserialized.show_dock_icon);
        assert!(deserialized.autostart);
        assert_eq!(deserialized.theme, "dark");
        assert_eq!(deserialized.language, "zh");
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

    // --- scan_coding_configs_tree ---

    #[test]
    fn scan_tree_empty_home() {
        let dir = tempfile::tempdir().unwrap();
        let results = scan_coding_configs_tree(dir.path());
        assert!(results.is_empty());
    }

    #[test]
    fn scan_tree_returns_children() {
        let dir = tempfile::tempdir().unwrap();
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(claude_dir.join("settings.json"), "{}").unwrap();
        std::fs::create_dir_all(claude_dir.join("projects")).unwrap();

        let results = scan_coding_configs_tree(dir.path());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "Claude Code");
        assert_eq!(results[0].children.len(), 2);

        // directories first, then files
        assert_eq!(results[0].children[0].name, "projects");
        assert_eq!(results[0].children[0].item_type, ItemType::Directory);
        assert_eq!(results[0].children[1].name, "settings.json");
        assert_eq!(results[0].children[1].item_type, ItemType::File);
    }

    #[test]
    fn scan_tree_skips_hidden_children() {
        let dir = tempfile::tempdir().unwrap();
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(claude_dir.join(".DS_Store"), "").unwrap();
        std::fs::write(claude_dir.join(".hidden"), "").unwrap();
        std::fs::write(claude_dir.join("visible.json"), "{}").unwrap();

        let results = scan_coding_configs_tree(dir.path());
        assert_eq!(results[0].children.len(), 1);
        assert_eq!(results[0].children[0].name, "visible.json");
    }

    #[test]
    fn scan_tree_finds_sibling_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".claude")).unwrap();
        std::fs::write(dir.path().join(".claude.json"), "{}").unwrap();

        let results = scan_coding_configs_tree(dir.path());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].siblings.len(), 1);
        assert_eq!(results[0].siblings[0].name, ".claude.json");
        assert_eq!(results[0].siblings[0].item_type, ItemType::File);
    }

    #[test]
    fn scan_tree_no_siblings_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".claude")).unwrap();
        // No .claude.json file

        let results = scan_coding_configs_tree(dir.path());
        assert_eq!(results[0].siblings.len(), 0);
    }

    #[test]
    fn scan_tree_file_agent_has_no_children() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".aider.conf.yml"), "model: gpt-4").unwrap();

        let results = scan_coding_configs_tree(dir.path());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "Aider");
        assert_eq!(results[0].item_type, ItemType::File);
        assert!(results[0].children.is_empty());
    }

    #[test]
    fn scan_tree_children_sorted_dirs_first() {
        let dir = tempfile::tempdir().unwrap();
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(claude_dir.join("alpha.txt"), "").unwrap();
        std::fs::create_dir_all(claude_dir.join("beta")).unwrap();
        std::fs::write(claude_dir.join("gamma.txt"), "").unwrap();
        std::fs::create_dir_all(claude_dir.join("delta")).unwrap();

        let results = scan_coding_configs_tree(dir.path());
        let names: Vec<&str> = results[0]
            .children
            .iter()
            .map(|c| c.name.as_str())
            .collect();
        // dirs first (alpha sorted), then files (alpha sorted)
        assert_eq!(names, vec!["beta", "delta", "alpha.txt", "gamma.txt"]);
    }

    #[test]
    fn scan_tree_serializes() {
        let tree = AgentTree {
            agent: "Claude Code".into(),
            path: "/Users/test/.claude".into(),
            item_type: ItemType::Directory,
            children: vec![TreeChild {
                name: "settings.json".into(),
                path: "/Users/test/.claude/settings.json".into(),
                item_type: ItemType::File,
            }],
            siblings: vec![TreeChild {
                name: ".claude.json".into(),
                path: "/Users/test/.claude.json".into(),
                item_type: ItemType::File,
            }],
        };
        let json = serde_json::to_value(&tree).unwrap();
        assert_eq!(json["agent"], "Claude Code");
        assert_eq!(json["children"][0]["name"], "settings.json");
        assert_eq!(json["siblings"][0]["name"], ".claude.json");
    }
}
