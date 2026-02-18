//! Sync pipeline: filelist generation -> validation -> rsync execution.
//!
//! This module orchestrates the three-layer sync pipeline:
//! 1. **filelist** — Generate a `--files-from` temp file from BackupEntry list
//! 2. **validation** — Validate paths exist, are readable, no duplicates
//! 3. **executor** — Build rsync args, run rsync, parse output

pub mod executor;
pub mod filelist;
pub mod validation;

use crate::error::Result;
use crate::types::{AppSettings, BackupEntry, SyncResult};

/// Execute the full sync pipeline: generate filelist, validate, run rsync.
///
/// This is the main entry point used by commands and webhook handlers.
pub fn execute_sync(entries: &[BackupEntry], settings: &AppSettings) -> Result<SyncResult> {
    let destination = settings.destination_path();

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
            webhook_port: 0,
            webhook_token: "test".to_string(),
            show_tray_icon: true,
            autostart: false,
        }
    }

    #[test]
    fn execute_sync_empty_entries_fails() {
        let settings = test_settings("/tmp/test_gdrive");
        let result = execute_sync(&[], &settings);
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
        let result = execute_sync(&entries, &settings).unwrap();

        assert!(result.is_success());
        assert_eq!(result.exit_code, 0);

        let expected_path = format!("{}/Backup{}", dest_dir.path().display(), source_path);
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
        let result = execute_sync(&entries, &settings);
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

        let result = execute_sync(&entries, &settings).unwrap();
        assert!(result.is_success());

        // Verify both files exist in backup
        let dest = dest_dir.path().display();
        assert!(
            std::path::Path::new(&format!("{dest}/Backup{file1_path}")).exists(),
            "doc.md should be backed up"
        );
        assert!(
            std::path::Path::new(&format!("{dest}/Backup{file2_path}")).exists(),
            "notes.txt should be backed up"
        );
    }
}
