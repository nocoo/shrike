use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ShrikeError {
    #[error("path does not exist: {0}")]
    PathNotFound(String),

    #[error("path is not readable: {0}")]
    PathNotReadable(String),

    #[error("duplicate entry: {0}")]
    DuplicateEntry(String),

    #[error("entry not found: {0}")]
    EntryNotFound(String),

    #[error("sync failed: {0}")]
    SyncFailed(String),

    #[error("rsync error (exit code {code}): {message}")]
    RsyncError { code: i32, message: String },

    #[error("store error: {0}")]
    StoreError(String),

    #[error("io error: {0}")]
    IoError(#[from] std::io::Error),
}

// Serialize for Tauri IPC — Tauri requires commands return Result<T, String>
// or a serializable error type
pub type Result<T> = std::result::Result<T, ShrikeError>;

// Serialize for Tauri IPC — Tauri requires commands to return a serializable
// error type. We serialize the error as its Display string.
impl Serialize for ShrikeError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for ShrikeError {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(ShrikeError::SyncFailed(s))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_displays_path_not_found() {
        let err = ShrikeError::PathNotFound("/foo/bar".into());
        assert_eq!(err.to_string(), "path does not exist: /foo/bar");
    }

    #[test]
    fn error_displays_rsync_error() {
        let err = ShrikeError::RsyncError {
            code: 23,
            message: "partial transfer".into(),
        };
        assert_eq!(
            err.to_string(),
            "rsync error (exit code 23): partial transfer"
        );
    }

    #[test]
    fn error_serializes_to_string() {
        let err = ShrikeError::DuplicateEntry("/a/b".into());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"duplicate entry: /a/b\"");
    }

    #[test]
    fn io_error_converts() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "gone");
        let err: ShrikeError = io_err.into();
        assert!(err.to_string().contains("gone"));
    }
}
