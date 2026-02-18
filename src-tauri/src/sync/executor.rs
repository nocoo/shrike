//! Layer 3: Rsync Execution
//!
//! Builds rsync command arguments, executes the rsync process, and parses
//! its output into a structured `SyncResult`.

use std::process::Command;

use chrono::Utc;

use crate::error::{Result, ShrikeError};
use crate::types::SyncResult;

/// Build the rsync command arguments.
///
/// Command: `rsync -avrR --files-from=<tmpfile> / <destination>/`
///
/// The explicit `-r` is required because `--files-from` disables the implicit
/// recursion that `-a` normally provides. Without it, directory entries in the
/// filelist are created as empty directories without their contents.
pub fn build_rsync_args(files_from_path: &str, destination: &str) -> Vec<String> {
    vec![
        "-avrR".to_string(),
        format!("--files-from={files_from_path}"),
        "/".to_string(),
        format!("{destination}/"),
    ]
}

/// Count transferred files and directories from rsync verbose output.
///
/// In rsync `-v` output, transferred items are listed one per line before the
/// summary block. Directories end with `/` (e.g. `dir1/`), files do not.
/// Returns `(files, dirs)` counts.
pub fn count_transferred_items(stdout: &str) -> (u64, u64) {
    let mut files = 0u64;
    let mut dirs = 0u64;
    for line in stdout.lines() {
        let trimmed = line.trim();
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
        if trimmed.ends_with('/') {
            dirs += 1;
        } else {
            files += 1;
        }
    }
    (files, dirs)
}

/// Execute rsync with the given arguments and return a `SyncResult`.
///
/// This function runs the actual rsync process. It is separated from argument
/// building so that argument construction can be tested independently.
pub fn run_rsync(args: &[String]) -> Result<SyncResult> {
    let output = Command::new("rsync").args(args).output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    let (files_transferred, dirs_transferred) = count_transferred_items(&stdout);

    let result = SyncResult {
        files_transferred,
        dirs_transferred,
        bytes_transferred: 0,
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

#[cfg(test)]
mod tests {
    use super::*;

    // --- build_rsync_args ---

    #[test]
    fn build_rsync_args_correct_format() {
        let args = build_rsync_args("/tmp/filelist.txt", "/mnt/backup");
        assert_eq!(args.len(), 4);
        assert_eq!(args[0], "-avrR");
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
    fn build_rsync_args_trailing_slash_on_destination() {
        let args = build_rsync_args("/tmp/f.txt", "/dest");
        assert!(args[3].ends_with('/'));
    }

    #[test]
    fn build_rsync_args_root_source() {
        let args = build_rsync_args("/tmp/f.txt", "/dest");
        assert_eq!(args[2], "/", "source must always be root /");
    }

    #[test]
    fn build_rsync_args_spaces_in_paths() {
        let args = build_rsync_args("/tmp/my list.txt", "/mnt/My Backup");
        assert_eq!(args[1], "--files-from=/tmp/my list.txt");
        assert_eq!(args[3], "/mnt/My Backup/");
    }

    // --- count_transferred_items ---

    #[test]
    fn count_transferred_items_typical_output() {
        let output = "\
sending incremental file list
Users/nocoo/.zshrc
Users/nocoo/.gitconfig
Users/nocoo/Documents/notes.txt

sent 1234 bytes  received 56 bytes  2580.00 bytes/sec
total size is 1000  speedup is 0.78
";
        assert_eq!(count_transferred_items(output), (3, 0));
    }

    #[test]
    fn count_transferred_items_empty_output() {
        assert_eq!(count_transferred_items(""), (0, 0));
    }

    #[test]
    fn count_transferred_items_no_transfers() {
        let output = "\
sending incremental file list

sent 100 bytes  received 20 bytes  240.00 bytes/sec
total size is 0  speedup is 0.00
";
        assert_eq!(count_transferred_items(output), (0, 0));
    }

    #[test]
    fn count_transferred_items_skips_dot_and_dotslash() {
        let output = "\
sending incremental file list
./
.
Users/nocoo/file.txt

sent 500 bytes  received 30 bytes  1060.00 bytes/sec
total size is 400  speedup is 0.75
";
        assert_eq!(count_transferred_items(output), (1, 0));
    }

    #[test]
    fn count_transferred_items_skips_building_line() {
        let output = "\
building file list ... done
sending incremental file list
file.txt

sent 100 bytes  received 20 bytes  240.00 bytes/sec
total size is 50  speedup is 0.42
";
        assert_eq!(count_transferred_items(output), (1, 0));
    }

    #[test]
    fn count_transferred_items_separates_files_and_dirs() {
        let output = "\
sending incremental file list
./
dir1/
dir1/file1.txt
dir2/
dir2/file2.txt
dir2/sub/
dir2/sub/file3.txt

sent 2000 bytes  received 100 bytes  4200.00 bytes/sec
total size is 1500  speedup is 0.71
";
        // dirs: dir1/, dir2/, dir2/sub/ = 3
        // files: dir1/file1.txt, dir2/file2.txt, dir2/sub/file3.txt = 3
        assert_eq!(count_transferred_items(output), (3, 3));
    }

    #[test]
    fn count_transferred_items_unicode_filenames() {
        let output = "\
sending incremental file list
Users/nocoo/日本語/ファイル.txt
Users/nocoo/中文/笔记.md

sent 500 bytes  received 30 bytes  1060.00 bytes/sec
total size is 400  speedup is 0.75
";
        assert_eq!(count_transferred_items(output), (2, 0));
    }

    #[test]
    fn count_transferred_items_whitespace_only_lines_skipped() {
        let output = "sending incremental file list\n  \n\t\nfile.txt\n\nsent 100 bytes  received 20 bytes  240.00 bytes/sec\n";
        assert_eq!(count_transferred_items(output), (1, 0));
    }

    // --- run_rsync ---

    #[test]
    fn run_rsync_with_nonexistent_source_fails() {
        let args = build_rsync_args("/nonexistent/filelist.txt", "/tmp");
        let result = run_rsync(&args);
        assert!(result.is_err());
    }

    #[test]
    fn run_rsync_with_empty_filelist_succeeds() {
        // Create an empty filelist
        let file = tempfile::NamedTempFile::new().unwrap();
        let dest = tempfile::tempdir().unwrap();
        let args = build_rsync_args(file.path().to_str().unwrap(), dest.path().to_str().unwrap());
        let result = run_rsync(&args).unwrap();
        assert!(result.is_success());
        // macOS openrsync may still output directory entries even with an
        // empty filelist, so we just check it succeeds without error
    }

    #[test]
    fn run_rsync_real_file_transfer() {
        use std::io::Write;

        // Create a source file
        let source_dir = tempfile::tempdir().unwrap();
        let source_file = source_dir.path().join("test.txt");
        let mut f = std::fs::File::create(&source_file).unwrap();
        write!(f, "rsync test content").unwrap();
        drop(f);

        let source_path = std::fs::canonicalize(&source_file)
            .unwrap()
            .to_string_lossy()
            .to_string();

        // Create filelist
        let mut filelist = tempfile::NamedTempFile::new().unwrap();
        writeln!(filelist, "{source_path}").unwrap();
        filelist.flush().unwrap();

        // Create destination
        let dest_dir = tempfile::tempdir().unwrap();

        let args = build_rsync_args(
            filelist.path().to_str().unwrap(),
            dest_dir.path().to_str().unwrap(),
        );
        let result = run_rsync(&args).unwrap();

        assert!(result.is_success());
        assert!(result.files_transferred >= 1);

        // Verify file was copied
        let backup_path = format!("{}{}", dest_dir.path().display(), source_path);
        assert!(std::path::Path::new(&backup_path).exists());
        assert_eq!(
            std::fs::read_to_string(&backup_path).unwrap(),
            "rsync test content"
        );
    }
}
