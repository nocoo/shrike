//! E2E integration tests for the sync workflow.
//!
//! These tests exercise the full rsync pipeline end-to-end:
//! creating real files on disk, running `execute_sync`, and verifying
//! that the backup destination contains the correct files with the
//! correct content and directory structure.

use std::fs;
use std::io::Write;

use shrike::sync::execute_sync;
use shrike::types::{AppSettings, BackupEntry, ItemType};

/// Helper: create a temp file with given content, return its canonical path.
fn create_temp_file(dir: &std::path::Path, name: &str, content: &str) -> String {
    let path = dir.join(name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut f = fs::File::create(&path).unwrap();
    write!(f, "{content}").unwrap();
    fs::canonicalize(&path)
        .unwrap()
        .to_string_lossy()
        .to_string()
}

/// Helper: build test settings pointing to a temp destination.
fn test_settings(dest: &str) -> AppSettings {
    AppSettings {
        gdrive_path: dest.to_string(),
        backup_dir_name: "Backup".to_string(),
        webhook_port: 0,
        webhook_token: "test".to_string(),
    }
}

#[test]
fn e2e_sync_single_file() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    let file_path = create_temp_file(source_dir.path(), "hello.txt", "hello world");
    let settings = test_settings(dest_dir.path().to_str().unwrap());
    let entries = vec![BackupEntry::new(file_path.clone(), ItemType::File)];

    let result = execute_sync(&entries, &settings).unwrap();

    assert!(result.is_success());
    assert_eq!(result.exit_code, 0);
    assert!(result.files_transferred >= 1);

    // Verify backup structure: <dest>/Backup/<full_source_path>
    let backup_path = format!("{}/Backup{}", dest_dir.path().display(), file_path);
    assert!(
        std::path::Path::new(&backup_path).exists(),
        "expected file at {backup_path}"
    );
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "hello world");
}

#[test]
fn e2e_sync_multiple_files_and_directories() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    // Create a nested directory structure
    let f1 = create_temp_file(source_dir.path(), "doc.md", "# README");
    let f2 = create_temp_file(source_dir.path(), "src/main.rs", "fn main() {}");
    let f3 = create_temp_file(source_dir.path(), "src/lib.rs", "pub mod foo;");
    let f4 = create_temp_file(
        source_dir.path(),
        "config/app.toml",
        "[app]\nname = \"test\"",
    );

    let settings = test_settings(dest_dir.path().to_str().unwrap());
    let entries = vec![
        BackupEntry::new(f1.clone(), ItemType::File),
        BackupEntry::new(f2.clone(), ItemType::File),
        BackupEntry::new(f3.clone(), ItemType::File),
        BackupEntry::new(f4.clone(), ItemType::File),
    ];

    let result = execute_sync(&entries, &settings).unwrap();

    assert!(result.is_success());

    // Verify all files exist in the backup
    let dest = dest_dir.path().display();
    for (path, content) in [
        (&f1, "# README"),
        (&f2, "fn main() {}"),
        (&f3, "pub mod foo;"),
        (&f4, "[app]\nname = \"test\""),
    ] {
        let backup_path = format!("{dest}/Backup{path}");
        assert!(
            std::path::Path::new(&backup_path).exists(),
            "missing: {backup_path}"
        );
        assert_eq!(
            fs::read_to_string(&backup_path).unwrap(),
            content,
            "content mismatch for {backup_path}"
        );
    }
}

#[test]
fn e2e_sync_preserves_directory_structure() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    // Create deeply nested files
    let f1 = create_temp_file(source_dir.path(), "a/b/c/deep.txt", "deep content");
    let f2 = create_temp_file(source_dir.path(), "x/y/z/deeper.txt", "deeper content");

    let settings = test_settings(dest_dir.path().to_str().unwrap());
    let entries = vec![
        BackupEntry::new(f1.clone(), ItemType::File),
        BackupEntry::new(f2.clone(), ItemType::File),
    ];

    let result = execute_sync(&entries, &settings).unwrap();
    assert!(result.is_success());

    // Verify the full directory path is preserved (rsync -R behavior)
    let dest = dest_dir.path().display();
    let bp1 = format!("{dest}/Backup{f1}");
    let bp2 = format!("{dest}/Backup{f2}");
    assert!(std::path::Path::new(&bp1).exists(), "missing: {bp1}");
    assert!(std::path::Path::new(&bp2).exists(), "missing: {bp2}");
}

#[test]
fn e2e_sync_incremental_no_rewrite() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    let f1 = create_temp_file(source_dir.path(), "stable.txt", "original");

    let settings = test_settings(dest_dir.path().to_str().unwrap());
    let entries = vec![BackupEntry::new(f1.clone(), ItemType::File)];

    // First sync
    let r1 = execute_sync(&entries, &settings).unwrap();
    assert!(r1.is_success());
    assert!(r1.files_transferred >= 1);

    // Second sync with same content — rsync should transfer fewer items
    // (macOS openrsync still lists directory entries in verbose output,
    // but actual file transfers should not occur)
    let r2 = execute_sync(&entries, &settings).unwrap();
    assert!(r2.is_success());
    assert!(
        r2.files_transferred < r1.files_transferred,
        "incremental sync should transfer fewer items: first={}, second={}",
        r1.files_transferred,
        r2.files_transferred
    );

    // Verify content is still correct
    let backup_path = format!("{}/Backup{}", dest_dir.path().display(), f1);
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "original");
}

#[test]
fn e2e_sync_empty_entries_returns_error() {
    let dest_dir = tempfile::tempdir().unwrap();
    let settings = test_settings(dest_dir.path().to_str().unwrap());

    let result = execute_sync(&[], &settings);
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(err.contains("no entries"), "unexpected error: {err}");
}

#[test]
fn e2e_sync_unicode_content_and_paths() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    // File with unicode name and content
    let f1 = create_temp_file(source_dir.path(), "日本語/ファイル.txt", "こんにちは世界");
    let f2 = create_temp_file(source_dir.path(), "中文/笔记.md", "# 你好世界");

    let settings = test_settings(dest_dir.path().to_str().unwrap());
    let entries = vec![
        BackupEntry::new(f1.clone(), ItemType::File),
        BackupEntry::new(f2.clone(), ItemType::File),
    ];

    let result = execute_sync(&entries, &settings).unwrap();
    assert!(result.is_success());

    let dest = dest_dir.path().display();
    assert_eq!(
        fs::read_to_string(format!("{dest}/Backup{f1}")).unwrap(),
        "こんにちは世界"
    );
    assert_eq!(
        fs::read_to_string(format!("{dest}/Backup{f2}")).unwrap(),
        "# 你好世界"
    );
}

#[test]
fn e2e_sync_updates_detect_content_change() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    let file_path_buf = source_dir.path().join("mutable.txt");
    fs::write(&file_path_buf, "version 1").unwrap();
    let file_path = fs::canonicalize(&file_path_buf)
        .unwrap()
        .to_string_lossy()
        .to_string();

    let settings = test_settings(dest_dir.path().to_str().unwrap());
    let entries = vec![BackupEntry::new(file_path.clone(), ItemType::File)];

    // First sync
    let r1 = execute_sync(&entries, &settings).unwrap();
    assert!(r1.is_success());

    let backup_path = format!("{}/Backup{}", dest_dir.path().display(), file_path);
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "version 1");

    // Modify source — sleep 1s to ensure mtime differs
    std::thread::sleep(std::time::Duration::from_secs(1));
    fs::write(&file_path_buf, "version 2").unwrap();

    // Second sync — should pick up changes
    let r2 = execute_sync(&entries, &settings).unwrap();
    assert!(r2.is_success());
    assert!(
        r2.files_transferred >= 1,
        "modified file should be re-transferred"
    );
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "version 2");
}
