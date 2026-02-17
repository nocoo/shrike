//! Layer 1: Filelist Generation
//!
//! Responsible for converting a list of `BackupEntry` items into a temporary
//! file suitable for rsync's `--files-from` flag. Each entry path is written
//! on its own line.

use std::fs;
use std::io::Write;
use std::path::Path;

use tempfile::NamedTempFile;

use crate::error::{Result, ShrikeError};
use crate::types::BackupEntry;

/// Write all entry paths into a temporary file (one path per line).
///
/// Returns the `NamedTempFile` handle. The caller must keep this handle alive
/// for as long as rsync needs to read from it; dropping it deletes the file.
pub fn generate_filelist(entries: &[BackupEntry]) -> Result<NamedTempFile> {
    let mut file = NamedTempFile::new()?;
    for entry in entries {
        writeln!(file, "{}", entry.path)?;
    }
    file.flush()?;
    Ok(file)
}

/// Read a filelist file back into a vector of path strings.
///
/// This is the inverse of `generate_filelist` and is used by the validation
/// layer to inspect what was actually written.
pub fn read_filelist(path: &Path) -> Result<Vec<String>> {
    let content = fs::read_to_string(path)?;
    let lines: Vec<String> = content
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect();
    Ok(lines)
}

/// Return the filelist path as a UTF-8 string, or error.
pub fn filelist_path_str(file: &NamedTempFile) -> Result<String> {
    file.path()
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| ShrikeError::SyncFailed("temp file path not valid UTF-8".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ItemType;

    #[test]
    fn generate_filelist_writes_all_paths() {
        let entries = vec![
            BackupEntry::new("/etc/hosts".into(), ItemType::File),
            BackupEntry::new("/tmp".into(), ItemType::Directory),
            BackupEntry::new("/Users/nocoo/.zshrc".into(), ItemType::File),
        ];
        let file = generate_filelist(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();

        assert!(contents.contains("/etc/hosts"));
        assert!(contents.contains("/tmp"));
        assert!(contents.contains("/Users/nocoo/.zshrc"));
        assert_eq!(contents.lines().count(), 3);
    }

    #[test]
    fn generate_filelist_empty_entries_produces_empty_file() {
        let entries: Vec<BackupEntry> = vec![];
        let file = generate_filelist(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        assert!(contents.is_empty());
    }

    #[test]
    fn generate_filelist_single_entry() {
        let entries = vec![BackupEntry::new("/foo/bar.txt".into(), ItemType::File)];
        let file = generate_filelist(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        assert_eq!(contents.trim(), "/foo/bar.txt");
        assert_eq!(contents.lines().count(), 1);
    }

    #[test]
    fn generate_filelist_unicode_paths() {
        let entries = vec![
            BackupEntry::new("/Users/nocoo/我的文件/笔记.md".into(), ItemType::File),
            BackupEntry::new("/tmp/日本語/ファイル.txt".into(), ItemType::File),
        ];
        let file = generate_filelist(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        assert!(contents.contains("我的文件/笔记.md"));
        assert!(contents.contains("日本語/ファイル.txt"));
    }

    #[test]
    fn generate_filelist_paths_with_spaces() {
        let entries = vec![BackupEntry::new(
            "/Users/nocoo/My Documents/file name.txt".into(),
            ItemType::File,
        )];
        let file = generate_filelist(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        assert!(contents.contains("/Users/nocoo/My Documents/file name.txt"));
    }

    #[test]
    fn generate_filelist_each_path_on_own_line() {
        let entries = vec![
            BackupEntry::new("/a".into(), ItemType::File),
            BackupEntry::new("/b".into(), ItemType::File),
            BackupEntry::new("/c".into(), ItemType::File),
        ];
        let file = generate_filelist(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        let lines: Vec<&str> = contents.lines().collect();
        assert_eq!(lines, vec!["/a", "/b", "/c"]);
    }

    #[test]
    fn read_filelist_roundtrip() {
        let entries = vec![
            BackupEntry::new("/etc/hosts".into(), ItemType::File),
            BackupEntry::new("/tmp".into(), ItemType::Directory),
        ];
        let file = generate_filelist(&entries).unwrap();
        let paths = read_filelist(file.path()).unwrap();
        assert_eq!(paths, vec!["/etc/hosts", "/tmp"]);
    }

    #[test]
    fn read_filelist_empty_file() {
        let file = NamedTempFile::new().unwrap();
        let paths = read_filelist(file.path()).unwrap();
        assert!(paths.is_empty());
    }

    #[test]
    fn read_filelist_skips_blank_lines() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "/a").unwrap();
        writeln!(file).unwrap(); // blank line
        writeln!(file, "/b").unwrap();
        file.flush().unwrap();

        let paths = read_filelist(file.path()).unwrap();
        assert_eq!(paths, vec!["/a", "/b"]);
    }

    #[test]
    fn read_filelist_nonexistent_file_errors() {
        let result = read_filelist(Path::new("/nonexistent/filelist.txt"));
        assert!(result.is_err());
    }

    #[test]
    fn filelist_path_str_returns_valid_utf8() {
        let file = NamedTempFile::new().unwrap();
        let path_str = filelist_path_str(&file).unwrap();
        assert!(!path_str.is_empty());
        assert!(Path::new(&path_str).exists());
    }

    #[test]
    fn generate_filelist_preserves_order() {
        let entries = vec![
            BackupEntry::new("/z/last.txt".into(), ItemType::File),
            BackupEntry::new("/a/first.txt".into(), ItemType::File),
            BackupEntry::new("/m/middle.txt".into(), ItemType::File),
        ];
        let file = generate_filelist(&entries).unwrap();
        let paths = read_filelist(file.path()).unwrap();
        assert_eq!(paths, vec!["/z/last.txt", "/a/first.txt", "/m/middle.txt"]);
    }

    #[test]
    fn generate_filelist_large_batch() {
        let entries: Vec<BackupEntry> = (0..1000)
            .map(|i| BackupEntry::new(format!("/path/to/file_{i}.txt"), ItemType::File))
            .collect();
        let file = generate_filelist(&entries).unwrap();
        let paths = read_filelist(file.path()).unwrap();
        assert_eq!(paths.len(), 1000);
        assert_eq!(paths[0], "/path/to/file_0.txt");
        assert_eq!(paths[999], "/path/to/file_999.txt");
    }
}
