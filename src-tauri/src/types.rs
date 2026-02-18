use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

/// Application settings persisted in the Tauri store.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppSettings {
    pub gdrive_path: String,
    pub backup_dir_name: String,
    pub webhook_port: u16,
    pub webhook_token: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            gdrive_path: String::from(
                "/Users/nocoo/Library/CloudStorage/GoogleDrive-user@example.com/我的云端硬盘",
            ),
            backup_dir_name: String::from("ShrikeBackup"),
            webhook_port: 7022,
            webhook_token: Uuid::new_v4().to_string(),
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
        assert!(settings.gdrive_path.contains("GoogleDrive"));
        assert_eq!(settings.backup_dir_name, "ShrikeBackup");
        assert_eq!(settings.webhook_port, 7022);
        assert!(!settings.webhook_token.is_empty());
    }

    #[test]
    fn app_settings_destination_path() {
        let settings = AppSettings {
            gdrive_path: "/mnt/gdrive".into(),
            backup_dir_name: "Backup".into(),
            webhook_port: 8080,
            webhook_token: "token".into(),
        };
        assert_eq!(settings.destination_path(), "/mnt/gdrive/Backup");
    }

    #[test]
    fn store_data_default_empty() {
        let store = StoreData::default();
        assert!(store.items.is_empty());
        assert_eq!(store.settings.webhook_port, 7022);
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
}
