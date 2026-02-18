//! E2E integration tests for the webhook HTTP layer.
//!
//! Since the webhook handlers require a Tauri `AppHandle` (which needs
//! a full Tauri runtime), these tests focus on verifying the sync
//! and type modules work correctly in combination — simulating the
//! same workflow that the webhook would trigger.

use std::fs;
use std::io::Write;

use shrike::sync::execute_sync;
use shrike::types::{AppSettings, BackupEntry, ItemType, SyncResult, SyncStatus};

/// Simulates the webhook /sync flow: load entries + settings, run sync.
fn simulate_webhook_sync(
    entries: &[BackupEntry],
    settings: &AppSettings,
) -> Result<SyncResult, String> {
    if entries.is_empty() {
        return Err("no entries to sync".to_string());
    }
    execute_sync(entries, settings).map_err(|e| e.to_string())
}

#[test]
fn webhook_sync_flow_success() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    let path = source_dir.path().join("webhook_test.txt");
    let mut f = fs::File::create(&path).unwrap();
    write!(f, "webhook payload").unwrap();
    let canonical = fs::canonicalize(&path)
        .unwrap()
        .to_string_lossy()
        .to_string();

    let settings = AppSettings {
        gdrive_path: dest_dir.path().to_str().unwrap().to_string(),
        backup_dir_name: "WebhookBackup".to_string(),
        webhook_port: 0,
        webhook_token: "test-token".to_string(),
        show_tray_icon: true,
        autostart: false,
    };

    let entries = vec![BackupEntry::new(canonical.clone(), ItemType::File)];

    let result = simulate_webhook_sync(&entries, &settings).unwrap();
    assert!(result.is_success());

    // Verify file was backed up
    let backup_path = format!("{}/WebhookBackup{}", dest_dir.path().display(), canonical);
    assert!(std::path::Path::new(&backup_path).exists());
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "webhook payload");
}

#[test]
fn webhook_sync_flow_empty_entries_error() {
    let settings = AppSettings {
        gdrive_path: "/tmp".to_string(),
        backup_dir_name: "Backup".to_string(),
        webhook_port: 0,
        webhook_token: "token".to_string(),
        show_tray_icon: true,
        autostart: false,
    };

    let result = simulate_webhook_sync(&[], &settings);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("no entries"));
}

#[test]
fn webhook_token_validation_logic() {
    // Test the token validation using the same logic as webhook module
    use axum::http::{HeaderMap, HeaderValue};

    fn validate_bearer(headers: &HeaderMap, expected: &str) -> bool {
        headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "))
            .map(|token| token == expected)
            .unwrap_or(false)
    }

    // Valid token
    let mut h = HeaderMap::new();
    h.insert(
        "authorization",
        HeaderValue::from_static("Bearer secret-123"),
    );
    assert!(validate_bearer(&h, "secret-123"));

    // Wrong token
    let mut h = HeaderMap::new();
    h.insert("authorization", HeaderValue::from_static("Bearer wrong"));
    assert!(!validate_bearer(&h, "secret-123"));

    // Missing header
    let h = HeaderMap::new();
    assert!(!validate_bearer(&h, "secret-123"));

    // Wrong scheme
    let mut h = HeaderMap::new();
    h.insert(
        "authorization",
        HeaderValue::from_static("Basic secret-123"),
    );
    assert!(!validate_bearer(&h, "secret-123"));
}

#[test]
fn webhook_status_response_shape() {
    // Verify the status response JSON shape matches what the webhook returns
    let status = SyncStatus::Idle;
    let entries_count = 5usize;
    let destination = "/mnt/gdrive/ShrikeBackup";

    let json = serde_json::json!({
        "status": status,
        "entries_count": entries_count,
        "destination": destination,
    });

    assert_eq!(json["status"], "idle");
    assert_eq!(json["entries_count"], 5);
    assert_eq!(json["destination"], "/mnt/gdrive/ShrikeBackup");
}

#[test]
fn webhook_sync_result_serialization() {
    // Verify that SyncResult serializes correctly for the webhook JSON response
    let result = SyncResult {
        files_transferred: 3,
        bytes_transferred: 4096,
        stdout: "sending incremental file list\nfile1.txt\nfile2.txt\nfile3.txt\n".to_string(),
        stderr: String::new(),
        exit_code: 0,
        synced_at: chrono::Utc::now(),
    };

    let json = serde_json::to_value(&result).unwrap();
    assert_eq!(json["files_transferred"], 3);
    assert_eq!(json["bytes_transferred"], 4096);
    assert_eq!(json["exit_code"], 0);
    assert!(json["synced_at"].is_string());
    assert!(json["stdout"].as_str().unwrap().contains("file1.txt"));
}
