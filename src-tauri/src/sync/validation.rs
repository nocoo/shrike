//! Layer 2: Filelist Validation
//!
//! Validates the generated filelist before handing it off to rsync.
//! Checks include: path existence, readability, duplicate detection,
//! absolute path requirement, and destination availability.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use crate::error::{Result, ShrikeError};

/// Result of validating a single path entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathValidation {
    /// Path is valid and ready for sync.
    Valid,
    /// Path does not exist on the filesystem.
    NotFound(String),
    /// Path exists but is not readable.
    NotReadable(String),
    /// Path is not an absolute path.
    NotAbsolute(String),
}

/// Result of validating an entire filelist.
#[derive(Debug, Clone)]
pub struct ValidationReport {
    /// Total number of paths checked.
    pub total: usize,
    /// Number of valid paths.
    pub valid_count: usize,
    /// Paths that failed validation, with reasons.
    pub errors: Vec<PathValidation>,
    /// Duplicate paths that were detected.
    pub duplicates: Vec<String>,
}

impl ValidationReport {
    /// Returns true if all paths are valid and there are no duplicates.
    pub fn is_ok(&self) -> bool {
        self.errors.is_empty() && self.duplicates.is_empty()
    }

    /// Returns true if there are any issues.
    pub fn has_issues(&self) -> bool {
        !self.is_ok()
    }

    /// Format a human-readable summary of validation issues.
    pub fn summary(&self) -> String {
        if self.is_ok() {
            return format!("all {} paths validated successfully", self.total);
        }

        let mut parts = Vec::new();

        if !self.errors.is_empty() {
            let not_found = self
                .errors
                .iter()
                .filter(|e| matches!(e, PathValidation::NotFound(_)))
                .count();
            let not_readable = self
                .errors
                .iter()
                .filter(|e| matches!(e, PathValidation::NotReadable(_)))
                .count();
            let not_absolute = self
                .errors
                .iter()
                .filter(|e| matches!(e, PathValidation::NotAbsolute(_)))
                .count();

            if not_found > 0 {
                parts.push(format!("{not_found} not found"));
            }
            if not_readable > 0 {
                parts.push(format!("{not_readable} not readable"));
            }
            if not_absolute > 0 {
                parts.push(format!("{not_absolute} not absolute"));
            }
        }

        if !self.duplicates.is_empty() {
            parts.push(format!("{} duplicates", self.duplicates.len()));
        }

        format!(
            "{}/{} paths valid; issues: {}",
            self.valid_count,
            self.total,
            parts.join(", ")
        )
    }
}

/// Validate a single path: must be absolute, must exist, must be readable.
pub fn validate_path(path: &str) -> PathValidation {
    if !path.starts_with('/') {
        return PathValidation::NotAbsolute(path.to_string());
    }

    let p = Path::new(path);
    if !p.exists() {
        return PathValidation::NotFound(path.to_string());
    }

    // Check readability by attempting to read metadata
    match fs::metadata(p) {
        Ok(_) => PathValidation::Valid,
        Err(_) => PathValidation::NotReadable(path.to_string()),
    }
}

/// Validate a list of path strings (typically read from a filelist file).
///
/// Checks each path for existence and readability, and detects duplicates.
pub fn validate_filelist(paths: &[String]) -> ValidationReport {
    let mut seen = HashSet::new();
    let mut errors = Vec::new();
    let mut duplicates = Vec::new();
    let mut valid_count = 0;

    for path in paths {
        if !seen.insert(path.clone()) {
            duplicates.push(path.clone());
            continue;
        }

        let validation = validate_path(path);
        match validation {
            PathValidation::Valid => valid_count += 1,
            other => errors.push(other),
        }
    }

    ValidationReport {
        total: paths.len(),
        valid_count,
        errors,
        duplicates,
    }
}

/// Validate that the destination directory exists or can be created.
pub fn validate_destination(destination: &str) -> Result<()> {
    let path = Path::new(destination);

    // If it already exists, just check it's a directory
    if path.exists() {
        if !path.is_dir() {
            return Err(ShrikeError::SyncFailed(format!(
                "destination is not a directory: {destination}"
            )));
        }
        return Ok(());
    }

    // Try to create it
    fs::create_dir_all(path)?;
    Ok(())
}

/// Run full pre-sync validation: check entries are non-empty, validate all
/// paths, validate destination. Returns an error if anything critical fails.
pub fn pre_sync_check(paths: &[String], destination: &str) -> Result<ValidationReport> {
    if paths.is_empty() {
        return Err(ShrikeError::SyncFailed("no entries to sync".to_string()));
    }

    let report = validate_filelist(paths);

    // If ALL paths are invalid, fail early
    if report.valid_count == 0 {
        return Err(ShrikeError::SyncFailed(format!(
            "no valid paths to sync: {}",
            report.summary()
        )));
    }

    // Validate destination
    validate_destination(destination)?;

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- validate_path ---

    #[test]
    fn validate_path_existing_file() {
        assert_eq!(validate_path("/etc/hosts"), PathValidation::Valid);
    }

    #[test]
    fn validate_path_existing_directory() {
        assert_eq!(validate_path("/tmp"), PathValidation::Valid);
    }

    #[test]
    fn validate_path_nonexistent() {
        assert_eq!(
            validate_path("/nonexistent/abc123xyz"),
            PathValidation::NotFound("/nonexistent/abc123xyz".into())
        );
    }

    #[test]
    fn validate_path_relative_path_rejected() {
        assert_eq!(
            validate_path("relative/path.txt"),
            PathValidation::NotAbsolute("relative/path.txt".into())
        );
    }

    #[test]
    fn validate_path_dot_relative_rejected() {
        assert_eq!(
            validate_path("./relative/path.txt"),
            PathValidation::NotAbsolute("./relative/path.txt".into())
        );
    }

    #[test]
    fn validate_path_empty_string_rejected() {
        assert_eq!(
            validate_path(""),
            PathValidation::NotAbsolute(String::new())
        );
    }

    #[test]
    fn validate_path_home_directory() {
        let home = std::env::var("HOME").unwrap();
        assert_eq!(validate_path(&home), PathValidation::Valid);
    }

    // --- validate_filelist ---

    #[test]
    fn validate_filelist_all_valid() {
        let paths = vec!["/etc/hosts".to_string(), "/tmp".to_string()];
        let report = validate_filelist(&paths);
        assert!(report.is_ok());
        assert_eq!(report.total, 2);
        assert_eq!(report.valid_count, 2);
        assert!(report.errors.is_empty());
        assert!(report.duplicates.is_empty());
    }

    #[test]
    fn validate_filelist_with_missing_paths() {
        let paths = vec![
            "/etc/hosts".to_string(),
            "/nonexistent/file.txt".to_string(),
        ];
        let report = validate_filelist(&paths);
        assert!(report.has_issues());
        assert_eq!(report.valid_count, 1);
        assert_eq!(report.errors.len(), 1);
        assert!(matches!(&report.errors[0], PathValidation::NotFound(_)));
    }

    #[test]
    fn validate_filelist_detects_duplicates() {
        let paths = vec![
            "/etc/hosts".to_string(),
            "/tmp".to_string(),
            "/etc/hosts".to_string(), // duplicate
        ];
        let report = validate_filelist(&paths);
        assert!(report.has_issues());
        assert_eq!(report.duplicates.len(), 1);
        assert_eq!(report.duplicates[0], "/etc/hosts");
        assert_eq!(report.valid_count, 2);
    }

    #[test]
    fn validate_filelist_multiple_duplicates() {
        let paths = vec![
            "/etc/hosts".to_string(),
            "/tmp".to_string(),
            "/etc/hosts".to_string(),
            "/tmp".to_string(),
            "/etc/hosts".to_string(),
        ];
        let report = validate_filelist(&paths);
        assert_eq!(report.duplicates.len(), 3);
        assert_eq!(report.valid_count, 2);
    }

    #[test]
    fn validate_filelist_all_invalid() {
        let paths = vec!["/nonexistent/a".to_string(), "/nonexistent/b".to_string()];
        let report = validate_filelist(&paths);
        assert_eq!(report.valid_count, 0);
        assert_eq!(report.errors.len(), 2);
    }

    #[test]
    fn validate_filelist_empty_list() {
        let paths: Vec<String> = vec![];
        let report = validate_filelist(&paths);
        assert!(report.is_ok()); // empty is technically valid (no errors)
        assert_eq!(report.total, 0);
        assert_eq!(report.valid_count, 0);
    }

    #[test]
    fn validate_filelist_relative_paths_rejected() {
        let paths = vec!["relative/file.txt".to_string(), "/etc/hosts".to_string()];
        let report = validate_filelist(&paths);
        assert_eq!(report.valid_count, 1);
        assert_eq!(report.errors.len(), 1);
        assert!(matches!(&report.errors[0], PathValidation::NotAbsolute(_)));
    }

    #[test]
    fn validate_filelist_mixed_issues() {
        let paths = vec![
            "/etc/hosts".to_string(),     // valid
            "/nonexistent/x".to_string(), // not found
            "relative.txt".to_string(),   // not absolute
            "/etc/hosts".to_string(),     // duplicate
        ];
        let report = validate_filelist(&paths);
        assert!(report.has_issues());
        assert_eq!(report.valid_count, 1);
        assert_eq!(report.errors.len(), 2); // not found + not absolute
        assert_eq!(report.duplicates.len(), 1);
    }

    // --- ValidationReport ---

    #[test]
    fn report_summary_all_valid() {
        let report = ValidationReport {
            total: 3,
            valid_count: 3,
            errors: vec![],
            duplicates: vec![],
        };
        assert_eq!(report.summary(), "all 3 paths validated successfully");
    }

    #[test]
    fn report_summary_with_issues() {
        let report = ValidationReport {
            total: 5,
            valid_count: 2,
            errors: vec![
                PathValidation::NotFound("/a".into()),
                PathValidation::NotReadable("/b".into()),
            ],
            duplicates: vec!["/c".into()],
        };
        let summary = report.summary();
        assert!(summary.contains("2/5"));
        assert!(summary.contains("1 not found"));
        assert!(summary.contains("1 not readable"));
        assert!(summary.contains("1 duplicates"));
    }

    #[test]
    fn report_is_ok_true_for_clean_report() {
        let report = ValidationReport {
            total: 1,
            valid_count: 1,
            errors: vec![],
            duplicates: vec![],
        };
        assert!(report.is_ok());
        assert!(!report.has_issues());
    }

    #[test]
    fn report_is_ok_false_with_errors() {
        let report = ValidationReport {
            total: 1,
            valid_count: 0,
            errors: vec![PathValidation::NotFound("/x".into())],
            duplicates: vec![],
        };
        assert!(!report.is_ok());
        assert!(report.has_issues());
    }

    #[test]
    fn report_is_ok_false_with_duplicates() {
        let report = ValidationReport {
            total: 2,
            valid_count: 1,
            errors: vec![],
            duplicates: vec!["/a".into()],
        };
        assert!(!report.is_ok());
    }

    // --- validate_destination ---

    #[test]
    fn validate_destination_existing_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(validate_destination(dir.path().to_str().unwrap()).is_ok());
    }

    #[test]
    fn validate_destination_creates_missing_dir() {
        let dir = tempfile::tempdir().unwrap();
        let nested = format!("{}/a/b/c", dir.path().display());
        assert!(validate_destination(&nested).is_ok());
        assert!(Path::new(&nested).is_dir());
    }

    #[test]
    fn validate_destination_file_not_dir_errors() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let result = validate_destination(file.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not a directory"));
    }

    // --- pre_sync_check ---

    #[test]
    fn pre_sync_check_empty_entries_errors() {
        let result = pre_sync_check(&[], "/tmp/dest");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no entries"));
    }

    #[test]
    fn pre_sync_check_all_valid() {
        let dir = tempfile::tempdir().unwrap();
        let paths = vec!["/etc/hosts".to_string()];
        let report = pre_sync_check(&paths, dir.path().to_str().unwrap()).unwrap();
        assert!(report.is_ok());
    }

    #[test]
    fn pre_sync_check_all_invalid_errors() {
        let dir = tempfile::tempdir().unwrap();
        let paths = vec!["/nonexistent/x".to_string()];
        let result = pre_sync_check(&paths, dir.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no valid paths"));
    }

    #[test]
    fn pre_sync_check_partial_valid_returns_report() {
        let dir = tempfile::tempdir().unwrap();
        let paths = vec![
            "/etc/hosts".to_string(),
            "/nonexistent/file.txt".to_string(),
        ];
        let report = pre_sync_check(&paths, dir.path().to_str().unwrap()).unwrap();
        assert!(report.has_issues());
        assert_eq!(report.valid_count, 1);
    }

    #[test]
    fn pre_sync_check_bad_destination_errors() {
        // Use a file as destination (not a dir)
        let file = tempfile::NamedTempFile::new().unwrap();
        let paths = vec!["/etc/hosts".to_string()];
        let result = pre_sync_check(&paths, file.path().to_str().unwrap());
        assert!(result.is_err());
    }
}
