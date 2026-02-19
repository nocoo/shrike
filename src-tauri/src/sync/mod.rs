//! Sync pipeline: filelist generation -> validation -> rsync execution.
//!
//! This module orchestrates the three-layer sync pipeline:
//! 1. **filelist** — Generate a `--files-from` temp file from BackupEntry list
//! 2. **validation** — Validate paths exist, are readable, no duplicates
//! 3. **executor** — Build rsync args, run rsync, parse output

pub mod executor;
pub mod filelist;
pub mod validation;

use std::sync::atomic::{AtomicBool, Ordering};

use crate::error::{Result, ShrikeError};
use crate::types::{AppSettings, BackupEntry, SyncResult};

/// Global lock to prevent concurrent rsync runs.
///
/// Both the Tauri IPC `trigger_sync` command and the webhook `POST /sync`
/// handler go through `execute_sync`, so a single atomic flag is sufficient
/// to serialize all sync operations.
static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

/// Returns true if a sync operation is currently in progress.
pub fn is_sync_running() -> bool {
    SYNC_RUNNING.load(Ordering::Relaxed)
}

/// Execute the full sync pipeline: generate filelist, validate, run rsync.
///
/// This is the main entry point used by commands and webhook handlers.
/// Only one sync operation can run at a time — concurrent calls are
/// rejected with `ShrikeError::SyncFailed`.
pub fn execute_sync(entries: &[BackupEntry], settings: &AppSettings) -> Result<SyncResult> {
    // Acquire the sync lock (compare-and-swap false → true)
    if SYNC_RUNNING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(ShrikeError::SyncFailed(
            "a sync operation is already in progress".to_string(),
        ));
    }

    // Ensure we always release the lock, even on error/panic
    let result = execute_sync_inner(entries, settings);
    SYNC_RUNNING.store(false, Ordering::SeqCst);
    result
}

/// Inner sync logic, separated so the lock guard in `execute_sync` stays clean.
fn execute_sync_inner(entries: &[BackupEntry], settings: &AppSettings) -> Result<SyncResult> {
    let destination = settings.destination_path()?;

    // Layer 1: Generate filelist
    let filelist_file = filelist::generate_filelist(entries)?;
    let filelist_path = filelist::filelist_path_str(&filelist_file)?;

    // Layer 2: Validate
    let paths = filelist::read_filelist(filelist_file.path())?;
    let _report = validation::pre_sync_check(&paths, &destination)?;

    // Layer 3: Execute rsync
    let args = executor::build_rsync_args(&filelist_path, &destination);
    let result = executor::run_rsync(&args)?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ItemType;
    use std::fs;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn test_settings(dest: &str) -> AppSettings {
        AppSettings {
            gdrive_path: dest.to_string(),
            backup_dir_name: "Backup".to_string(),
            machine_name: "TestMac".to_string(),
            webhook_port: 0,
            webhook_token: "test".to_string(),
            show_tray_icon: true,
            show_dock_icon: true,
            autostart: false,
            theme: "auto".to_string(),
            language: "auto".to_string(),
        }
    }

    #[test]
    fn execute_sync_empty_entries_fails() {
        let settings = test_settings("/tmp/test_gdrive");
        let result = execute_sync_inner(&[], &settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no entries"));
    }

    #[test]
    fn execute_sync_real_file() {
        let dest_dir = tempfile::tempdir().unwrap();
        let settings = test_settings(dest_dir.path().to_str().unwrap());

        let mut source = NamedTempFile::new().unwrap();
        writeln!(source, "hello shrike").unwrap();
        let source_path = source.path().to_str().unwrap().to_string();

        let entries = vec![BackupEntry::new(source_path.clone(), ItemType::File)];
        let result = execute_sync_inner(&entries, &settings).unwrap();

        assert!(result.is_success());
        assert_eq!(result.exit_code, 0);

        let expected_path = format!(
            "{}/Backup/TestMac{}",
            dest_dir.path().display(),
            source_path
        );
        assert!(std::path::Path::new(&expected_path).exists());

        let content = fs::read_to_string(&expected_path).unwrap();
        assert!(content.contains("hello shrike"));
    }

    #[test]
    fn execute_sync_nonexistent_file_fails() {
        let dest_dir = tempfile::tempdir().unwrap();
        let settings = test_settings(dest_dir.path().to_str().unwrap());

        let entries = vec![BackupEntry::new(
            "/nonexistent/file_abc123.txt".into(),
            ItemType::File,
        )];
        let result = execute_sync_inner(&entries, &settings);
        assert!(result.is_err());
    }

    #[test]
    fn execute_sync_pipeline_integration() {
        // Test the full pipeline: generate -> validate -> execute
        let source_dir = tempfile::tempdir().unwrap();
        let dest_dir = tempfile::tempdir().unwrap();

        // Create source files
        let file1 = source_dir.path().join("doc.md");
        fs::write(&file1, "# Hello").unwrap();
        let file1_path = fs::canonicalize(&file1)
            .unwrap()
            .to_string_lossy()
            .to_string();

        let file2 = source_dir.path().join("notes.txt");
        fs::write(&file2, "some notes").unwrap();
        let file2_path = fs::canonicalize(&file2)
            .unwrap()
            .to_string_lossy()
            .to_string();

        let settings = test_settings(dest_dir.path().to_str().unwrap());
        let entries = vec![
            BackupEntry::new(file1_path.clone(), ItemType::File),
            BackupEntry::new(file2_path.clone(), ItemType::File),
        ];

        let result = execute_sync_inner(&entries, &settings).unwrap();
        assert!(result.is_success());

        // Verify both files exist in backup
        let dest = dest_dir.path().display();
        assert!(
            std::path::Path::new(&format!("{dest}/Backup/TestMac{file1_path}")).exists(),
            "doc.md should be backed up"
        );
        assert!(
            std::path::Path::new(&format!("{dest}/Backup/TestMac{file2_path}")).exists(),
            "notes.txt should be backed up"
        );
    }

    #[test]
    fn execute_sync_rejects_concurrent_runs() {
        // Simulate a lock being held by setting the flag manually
        SYNC_RUNNING.store(true, Ordering::SeqCst);

        let settings = test_settings("/tmp/test_gdrive");
        let entries = vec![BackupEntry::new("/etc/hosts".into(), ItemType::File)];
        let result = execute_sync(&entries, &settings);

        // Must release the lock before asserting, so other tests aren't affected
        SYNC_RUNNING.store(false, Ordering::SeqCst);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("already in progress"));
    }

    #[test]
    fn is_sync_running_reflects_state() {
        assert!(!is_sync_running());
        SYNC_RUNNING.store(true, Ordering::SeqCst);
        assert!(is_sync_running());
        SYNC_RUNNING.store(false, Ordering::SeqCst);
        assert!(!is_sync_running());
    }
}
