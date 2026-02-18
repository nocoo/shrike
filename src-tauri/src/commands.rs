use std::fs;
use std::path::Path;

use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

use crate::error::{Result, ShrikeError};
use crate::sync;
use crate::types::{AgentTree, AppSettings, BackupEntry, DetectedConfig, ItemType, SyncResult};

const STORE_FILE: &str = "shrike_data.json";
const ITEMS_KEY: &str = "items";
const SETTINGS_KEY: &str = "settings";

/// Validate that a path exists and is readable, returning its item type.
fn validate_path(path: &str) -> Result<ItemType> {
    let p = Path::new(path);

    if !p.exists() {
        return Err(ShrikeError::PathNotFound(path.to_string()));
    }

    // Check readability by attempting to read metadata
    let metadata = fs::metadata(p)?;

    if metadata.is_file() {
        Ok(ItemType::File)
    } else if metadata.is_dir() {
        Ok(ItemType::Directory)
    } else {
        // Symlink or other — resolve and check
        let resolved = fs::canonicalize(p)?;
        let resolved_meta = fs::metadata(&resolved)?;
        if resolved_meta.is_file() {
            Ok(ItemType::File)
        } else {
            Ok(ItemType::Directory)
        }
    }
}

/// Load items from the store, returning an empty vec if not found.
fn load_items(app: &AppHandle) -> Result<Vec<BackupEntry>> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| ShrikeError::StoreError(e.to_string()))?;

    match store.get(ITEMS_KEY) {
        Some(val) => {
            let items: Vec<BackupEntry> =
                serde_json::from_value(val).map_err(|e| ShrikeError::StoreError(e.to_string()))?;
            Ok(items)
        }
        None => Ok(Vec::new()),
    }
}

/// Save items to the store.
fn save_items(app: &AppHandle, items: &[BackupEntry]) -> Result<()> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| ShrikeError::StoreError(e.to_string()))?;

    store.set(ITEMS_KEY.to_string(), json!(items));

    Ok(())
}

/// Add a file or directory to the backup list.
#[tauri::command]
pub fn add_entry(app: AppHandle, path: String) -> Result<BackupEntry> {
    let item_type = validate_path(&path)?;

    // Canonicalize the path to resolve symlinks and relative segments
    let canonical = fs::canonicalize(&path)?;
    let canonical_str = canonical.to_string_lossy().to_string();

    let mut items = load_items(&app)?;

    // Check for duplicates
    if items.iter().any(|e| e.path == canonical_str) {
        return Err(ShrikeError::DuplicateEntry(canonical_str));
    }

    let entry = BackupEntry::new(canonical_str, item_type);
    items.push(entry.clone());
    save_items(&app, &items)?;

    Ok(entry)
}

/// Remove an entry by its UUID.
#[tauri::command]
pub fn remove_entry(app: AppHandle, id: String) -> Result<()> {
    let uuid = Uuid::parse_str(&id).map_err(|e| ShrikeError::EntryNotFound(e.to_string()))?;

    let mut items = load_items(&app)?;
    let original_len = items.len();
    items.retain(|e| e.id != uuid);

    if items.len() == original_len {
        return Err(ShrikeError::EntryNotFound(id));
    }

    save_items(&app, &items)?;
    Ok(())
}

/// List all backup entries.
#[tauri::command]
pub fn list_entries(app: AppHandle) -> Result<Vec<BackupEntry>> {
    load_items(&app)
}

/// Get current application settings.
#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| ShrikeError::StoreError(e.to_string()))?;

    match store.get(SETTINGS_KEY) {
        Some(val) => {
            let settings: AppSettings =
                serde_json::from_value(val).map_err(|e| ShrikeError::StoreError(e.to_string()))?;
            Ok(settings)
        }
        None => {
            let defaults = AppSettings::default();
            store.set(SETTINGS_KEY.to_string(), json!(defaults));
            Ok(defaults)
        }
    }
}

/// Update application settings.
#[tauri::command]
pub fn update_settings(app: AppHandle, settings: AppSettings) -> Result<()> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| ShrikeError::StoreError(e.to_string()))?;

    store.set(SETTINGS_KEY.to_string(), json!(settings));

    Ok(())
}

/// Trigger a sync of all backup entries via rsync.
///
/// This command is async so that the blocking rsync subprocess does not
/// freeze the Tauri IPC thread (and therefore the UI).
#[tauri::command]
pub async fn trigger_sync(app: AppHandle) -> Result<SyncResult> {
    let entries = load_items(&app)?;
    let settings = get_settings(app)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        sync::execute_sync(&entries, &settings)
    })
    .await
    .map_err(|e| ShrikeError::SyncFailed(e.to_string()))??;
    Ok(result)
}

/// Check if autostart is enabled.
#[tauri::command]
pub fn get_autostart(app: AppHandle) -> Result<bool> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    autostart
        .is_enabled()
        .map_err(|e| ShrikeError::StoreError(e.to_string()))
}

/// Enable or disable autostart.
#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<()> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if enabled {
        autostart
            .enable()
            .map_err(|e| ShrikeError::StoreError(e.to_string()))?;
    } else {
        autostart
            .disable()
            .map_err(|e| ShrikeError::StoreError(e.to_string()))?;
    }
    // Persist in settings
    let mut settings = get_settings(app.clone())?;
    settings.autostart = enabled;
    update_settings(app, settings)?;
    Ok(())
}

/// Show or hide the tray icon.
#[tauri::command]
pub fn set_tray_visible(app: AppHandle, visible: bool) -> Result<()> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_visible(visible)
            .map_err(|e| ShrikeError::StoreError(e.to_string()))?;
    }
    // Persist in settings
    let mut settings = get_settings(app.clone())?;
    settings.show_tray_icon = visible;
    update_settings(app, settings)?;
    Ok(())
}

/// Show or hide the Dock icon (macOS only).
#[tauri::command]
pub fn set_dock_visible(app: AppHandle, visible: bool) -> Result<()> {
    #[cfg(target_os = "macos")]
    app.set_activation_policy(if visible {
        tauri::ActivationPolicy::Regular
    } else {
        tauri::ActivationPolicy::Accessory
    })
    .map_err(|e| ShrikeError::StoreError(e.to_string()))?;
    // Persist in settings
    let mut settings = get_settings(app.clone())?;
    settings.show_dock_icon = visible;
    update_settings(app, settings)?;
    Ok(())
}

/// Scan the user's home directory for known coding agent configurations.
#[tauri::command]
pub fn scan_coding_configs() -> Result<Vec<DetectedConfig>> {
    let home = dirs::home_dir().ok_or_else(|| ShrikeError::PathNotFound("~".to_string()))?;
    Ok(crate::types::scan_coding_configs(&home))
}

/// Scan the user's home directory for coding agent configurations,
/// returning a tree structure with first-level children and sibling files.
#[tauri::command]
pub fn scan_coding_configs_tree() -> Result<Vec<AgentTree>> {
    let home = dirs::home_dir().ok_or_else(|| ShrikeError::PathNotFound("~".to_string()))?;
    Ok(crate::types::scan_coding_configs_tree(&home))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_path_existing_file() {
        // /etc/hosts exists on all macOS systems
        let result = validate_path("/etc/hosts");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), ItemType::File);
    }

    #[test]
    fn validate_path_existing_directory() {
        let result = validate_path("/tmp");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), ItemType::Directory);
    }

    #[test]
    fn validate_path_nonexistent() {
        let result = validate_path("/nonexistent/path/abc123xyz");
        assert!(result.is_err());
        match result.unwrap_err() {
            ShrikeError::PathNotFound(p) => {
                assert_eq!(p, "/nonexistent/path/abc123xyz");
            }
            other => panic!("expected PathNotFound, got: {other}"),
        }
    }

    #[test]
    fn validate_path_resolves_symlink() {
        // /tmp on macOS is a symlink to /private/tmp
        let result = validate_path("/tmp");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), ItemType::Directory);
    }

    #[test]
    fn validate_path_home_dir() {
        let home = std::env::var("HOME").unwrap();
        let result = validate_path(&home);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), ItemType::Directory);
    }
}
