use std::fs;
use std::io::Write;
use std::process::Command;

use chrono::Utc;
use tempfile::NamedTempFile;

use crate::error::{Result, ShrikeError};
use crate::types::{AppSettings, BackupEntry, SyncResult};

/// Build the --files-from temp file containing all entry paths (one per line).
fn build_files_list(entries: &[BackupEntry]) -> Result<NamedTempFile> {
    let mut file = NamedTempFile::new()?;
    for entry in entries {
        writeln!(file, "{}", entry.path)?;
    }
    file.flush()?;
    Ok(file)
}

/// Build the rsync command arguments.
///
/// Command: rsync -avR --files-from=<tmpfile> / <destination>/
fn build_rsync_args(files_from_path: &str, destination: &str) -> Vec<String> {
    vec![
        "-avR".to_string(),
        format!("--files-from={files_from_path}"),
        "/".to_string(),
        format!("{destination}/"),
    ]
}

/// Execute rsync and return the result.
pub fn execute_sync(entries: &[BackupEntry], settings: &AppSettings) -> Result<SyncResult> {
    if entries.is_empty() {
        return Err(ShrikeError::SyncFailed("no entries to sync".to_string()));
    }

    let destination = settings.destination_path();

    // Ensure destination directory exists
    fs::create_dir_all(&destination)?;

    // Build the files-from list
    let files_list = build_files_list(entries)?;
    let files_list_path = files_list
        .path()
        .to_str()
        .ok_or_else(|| ShrikeError::SyncFailed("temp file path not valid UTF-8".into()))?
        .to_string();

    let args = build_rsync_args(&files_list_path, &destination);

    let output = Command::new("rsync").args(&args).output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    // Count transferred files from rsync verbose output.
    // rsync -v prints one line per file transferred (lines not starting with
    // special characters and not blank).
    let files_transferred = count_transferred_files(&stdout);

    let result = SyncResult {
        files_transferred,
        bytes_transferred: 0, // We could parse "total size" but it's not critical
        stdout,
        stderr,
        exit_code,
        synced_at: Utc::now(),
    };

    if !result.is_success() {
        return Err(ShrikeError::RsyncError {
            code: exit_code,
            message: result.stderr.clone(),
        });
    }

    Ok(result)
}

/// Count transferred files from rsync verbose output.
/// In rsync -v output, transferred files are listed one per line before the
/// summary block. The summary block starts with a blank line.
fn count_transferred_files(stdout: &str) -> u64 {
    let mut count = 0u64;
    for line in stdout.lines() {
        let trimmed = line.trim();
        // Skip empty lines, summary lines, and the trailing dot
        if trimmed.is_empty()
            || trimmed.starts_with("sending")
            || trimmed.starts_with("sent ")
            || trimmed.starts_with("total ")
            || trimmed.starts_with("building ")
            || trimmed == "."
            || trimmed == "./"
        {
            continue;
        }
        count += 1;
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ItemType;

    #[test]
    fn build_files_list_creates_temp_file() {
        let entries = vec![
            BackupEntry::new("/etc/hosts".into(), ItemType::File),
            BackupEntry::new("/tmp".into(), ItemType::Directory),
        ];
        let file = build_files_list(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        assert!(contents.contains("/etc/hosts"));
        assert!(contents.contains("/tmp"));
        // Each line should end with newline
        assert_eq!(contents.lines().count(), 2);
    }

    #[test]
    fn build_files_list_empty_entries() {
        let entries: Vec<BackupEntry> = vec![];
        let file = build_files_list(&entries).unwrap();
        let contents = fs::read_to_string(file.path()).unwrap();
        assert!(contents.is_empty());
    }

    #[test]
    fn build_rsync_args_correct_format() {
        let args = build_rsync_args("/tmp/filelist.txt", "/mnt/backup");
        assert_eq!(args.len(), 4);
        assert_eq!(args[0], "-avR");
        assert_eq!(args[1], "--files-from=/tmp/filelist.txt");
        assert_eq!(args[2], "/");
        assert_eq!(args[3], "/mnt/backup/");
    }

    #[test]
    fn build_rsync_args_handles_unicode_destination() {
        let args = build_rsync_args("/tmp/list.txt", "/mnt/我的云端硬盘/ShrikeBackup");
        assert_eq!(args[3], "/mnt/我的云端硬盘/ShrikeBackup/");
    }

    #[test]
    fn count_transferred_files_parses_output() {
        let output = "\
sending incremental file list
Users/nocoo/.zshrc
Users/nocoo/.gitconfig
Users/nocoo/Documents/notes.txt

sent 1234 bytes  received 56 bytes  2580.00 bytes/sec
total size is 1000  speedup is 0.78
";
        assert_eq!(count_transferred_files(output), 3);
    }

    #[test]
    fn count_transferred_files_empty_output() {
        assert_eq!(count_transferred_files(""), 0);
    }

    #[test]
    fn count_transferred_files_no_transfers() {
        let output = "\
sending incremental file list

sent 100 bytes  received 20 bytes  240.00 bytes/sec
total size is 0  speedup is 0.00
";
        assert_eq!(count_transferred_files(output), 0);
    }

    #[test]
    fn count_transferred_files_skips_dot_and_dotslash() {
        let output = "\
sending incremental file list
./
.
Users/nocoo/file.txt

sent 500 bytes  received 30 bytes  1060.00 bytes/sec
total size is 400  speedup is 0.75
";
        assert_eq!(count_transferred_files(output), 1);
    }

    #[test]
    fn execute_sync_empty_entries_fails() {
        let settings = AppSettings {
            gdrive_path: "/tmp/test_gdrive".into(),
            backup_dir_name: "TestBackup".into(),
            webhook_port: 18888,
            webhook_token: "token".into(),
        };
        let result = execute_sync(&[], &settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no entries"));
    }

    #[test]
    fn execute_sync_real_file() {
        // Create a temp directory as the backup destination
        let dest_dir = tempfile::tempdir().unwrap();
        let dest_path = dest_dir.path().to_str().unwrap().to_string();

        let settings = AppSettings {
            gdrive_path: dest_path.clone(),
            backup_dir_name: "Backup".into(),
            webhook_port: 18888,
            webhook_token: "token".into(),
        };

        // Create a temp file to sync
        let mut source = NamedTempFile::new().unwrap();
        writeln!(source, "hello shrike").unwrap();
        let source_path = source.path().to_str().unwrap().to_string();

        let entries = vec![BackupEntry::new(source_path.clone(), ItemType::File)];

        let result = execute_sync(&entries, &settings).unwrap();
        assert!(result.is_success());
        assert_eq!(result.exit_code, 0);

        // Verify the file was actually copied
        // rsync -R preserves the full path, so the file should be at
        // <dest>/Backup/<source_path>
        let expected_path = format!("{}/Backup{}", dest_path, source_path);
        assert!(
            std::path::Path::new(&expected_path).exists(),
            "expected file at {expected_path}"
        );

        // Verify content
        let content = fs::read_to_string(&expected_path).unwrap();
        assert!(content.contains("hello shrike"));
    }
}
