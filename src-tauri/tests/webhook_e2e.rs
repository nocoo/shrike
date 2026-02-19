//! E2E integration tests for the webhook HTTP layer.
//!
//! These tests exercise the actual axum router (built via `build_router`)
//! with a mock `DataStore`, sending real HTTP requests through
//! `tower::ServiceExt::oneshot`.  No Tauri runtime is required.
//!
//! Additionally, the original simulated tests verify that the sync pipeline
//! and serialization logic match what the webhook handlers expect.

use std::fs;
use std::io::Write;

use axum::body::Body;
use axum::http::{self, Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use shrike::sync::execute_sync;
use shrike::types::{AppSettings, BackupEntry, ItemType, SyncResult, SyncStatus};
use shrike::webhook::{build_router, DataStore};

// ---------------------------------------------------------------------------
// Mock DataStore
// ---------------------------------------------------------------------------

/// A mock data store that returns pre-configured settings and items.
#[derive(Clone)]
struct MockStore {
    settings: AppSettings,
    items: Vec<BackupEntry>,
}

impl MockStore {
    fn new(settings: AppSettings, items: Vec<BackupEntry>) -> Self {
        Self { settings, items }
    }
}

impl DataStore for MockStore {
    fn load_settings(&self) -> Result<AppSettings, String> {
        Ok(self.settings.clone())
    }

    fn load_items(&self) -> Result<Vec<BackupEntry>, String> {
        Ok(self.items.clone())
    }
}

/// A mock store that always fails to load — simulates store corruption.
#[derive(Clone)]
struct FailingStore;

impl DataStore for FailingStore {
    fn load_settings(&self) -> Result<AppSettings, String> {
        Err("store corrupted".to_string())
    }

    fn load_items(&self) -> Result<Vec<BackupEntry>, String> {
        Err("store corrupted".to_string())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn test_settings() -> AppSettings {
    AppSettings {
        gdrive_path: "/tmp/test_gdrive".to_string(),
        backup_dir_name: "Backup".to_string(),
        machine_name: "TestMac".to_string(),
        webhook_port: 0,
        webhook_token: "test-token".to_string(),
        show_tray_icon: true,
        show_dock_icon: true,
        autostart: false,
        theme: "auto".to_string(),
        language: "auto".to_string(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

/// Send a request through the router and return (status, body JSON).
async fn send_request(
    router: axum::Router,
    request: Request<Body>,
) -> (StatusCode, serde_json::Value) {
    let response = router.oneshot(request).await.unwrap();
    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    (status, json)
}

// ===========================================================================
// HTTP integration tests — GET /status
// ===========================================================================

#[tokio::test]
async fn status_returns_ok_with_valid_token() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/status")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["status"], "idle");
    assert_eq!(json["entries_count"], 0);
    assert_eq!(json["destination"], "/tmp/test_gdrive/Backup/TestMac");
}

#[tokio::test]
async fn status_returns_entries_count() {
    let items = vec![
        BackupEntry::new("/etc/hosts".into(), ItemType::File),
        BackupEntry::new("/etc/shells".into(), ItemType::File),
        BackupEntry::new("/tmp".into(), ItemType::Directory),
    ];
    let store = MockStore::new(test_settings(), items);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/status")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["entries_count"], 3);
}

#[tokio::test]
async fn status_rejects_missing_auth() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/status")
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(json["error"], "unauthorized");
}

#[tokio::test]
async fn status_rejects_wrong_token() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/status")
        .header("authorization", auth_header("wrong-token"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(json["error"], "unauthorized");
}

#[tokio::test]
async fn status_rejects_basic_auth_scheme() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/status")
        .header("authorization", "Basic test-token")
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(json["error"], "unauthorized");
}

#[tokio::test]
async fn status_returns_500_when_store_fails() {
    let router = build_router(FailingStore);

    let req = Request::builder()
        .uri("/status")
        .header("authorization", auth_header("anything"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(json["error"].as_str().unwrap().contains("corrupted"));
}

#[tokio::test]
async fn status_returns_500_when_gdrive_not_configured() {
    let mut settings = test_settings();
    settings.gdrive_path = String::new(); // empty = not configured
    let store = MockStore::new(settings, vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/status")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(json["error"]
        .as_str()
        .unwrap()
        .contains("Google Drive path"));
}

// ===========================================================================
// HTTP integration tests — POST /sync
// ===========================================================================

#[tokio::test]
async fn sync_rejects_missing_auth() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .method(http::Method::POST)
        .uri("/sync")
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(json["error"], "unauthorized");
}

#[tokio::test]
async fn sync_rejects_wrong_token() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .method(http::Method::POST)
        .uri("/sync")
        .header("authorization", auth_header("wrong"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(json["error"], "unauthorized");
}

#[tokio::test]
async fn sync_returns_400_when_no_entries() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .method(http::Method::POST)
        .uri("/sync")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(json["error"].as_str().unwrap().contains("no entries"));
}

#[tokio::test]
async fn sync_returns_500_when_store_fails() {
    let router = build_router(FailingStore);

    let req = Request::builder()
        .method(http::Method::POST)
        .uri("/sync")
        .header("authorization", auth_header("anything"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(json["error"].as_str().unwrap().contains("corrupted"));
}

#[tokio::test]
async fn sync_succeeds_with_real_file() {
    let source_dir = tempfile::tempdir().unwrap();
    let dest_dir = tempfile::tempdir().unwrap();

    let path = source_dir.path().join("webhook_http_test.txt");
    let mut f = fs::File::create(&path).unwrap();
    write!(f, "via HTTP").unwrap();
    let canonical = fs::canonicalize(&path)
        .unwrap()
        .to_string_lossy()
        .to_string();

    let settings = AppSettings {
        gdrive_path: dest_dir.path().to_str().unwrap().to_string(),
        backup_dir_name: "WebhookBackup".to_string(),
        machine_name: "TestMac".to_string(),
        webhook_port: 0,
        webhook_token: "test-token".to_string(),
        show_tray_icon: true,
        show_dock_icon: true,
        autostart: false,
        theme: "auto".to_string(),
        language: "auto".to_string(),
    };

    let entries = vec![BackupEntry::new(canonical.clone(), ItemType::File)];
    let store = MockStore::new(settings, entries);
    let router = build_router(store);

    let req = Request::builder()
        .method(http::Method::POST)
        .uri("/sync")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let (status, json) = send_request(router, req).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["exit_code"], 0);
    assert!(json["synced_at"].is_string());

    // Verify file was actually backed up
    let backup_path = format!(
        "{}/WebhookBackup/TestMac{}",
        dest_dir.path().display(),
        canonical
    );
    assert!(std::path::Path::new(&backup_path).exists());
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "via HTTP");
}

// ===========================================================================
// HTTP integration tests — wrong methods / unknown routes
// ===========================================================================

#[tokio::test]
async fn get_sync_returns_405() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .method(http::Method::GET)
        .uri("/sync")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn post_status_returns_405() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .method(http::Method::POST)
        .uri("/status")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn unknown_route_returns_404() {
    let store = MockStore::new(test_settings(), vec![]);
    let router = build_router(store);

    let req = Request::builder()
        .uri("/nonexistent")
        .header("authorization", auth_header("test-token"))
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// ===========================================================================
// Original simulated tests (retained for pipeline-level coverage)
// ===========================================================================

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
        machine_name: "TestMac".to_string(),
        webhook_port: 0,
        webhook_token: "test-token".to_string(),
        show_tray_icon: true,
        show_dock_icon: true,
        autostart: false,
        theme: "auto".to_string(),
        language: "auto".to_string(),
    };

    let entries = vec![BackupEntry::new(canonical.clone(), ItemType::File)];

    let result = simulate_webhook_sync(&entries, &settings).unwrap();
    assert!(result.is_success());

    // Verify file was backed up
    let backup_path = format!(
        "{}/WebhookBackup/TestMac{}",
        dest_dir.path().display(),
        canonical
    );
    assert!(std::path::Path::new(&backup_path).exists());
    assert_eq!(fs::read_to_string(&backup_path).unwrap(), "webhook payload");
}

#[test]
fn webhook_sync_flow_empty_entries_error() {
    let settings = AppSettings {
        gdrive_path: "/tmp".to_string(),
        backup_dir_name: "Backup".to_string(),
        machine_name: "TestMac".to_string(),
        webhook_port: 0,
        webhook_token: "token".to_string(),
        show_tray_icon: true,
        show_dock_icon: true,
        autostart: false,
        theme: "auto".to_string(),
        language: "auto".to_string(),
    };

    let result = simulate_webhook_sync(&[], &settings);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("no entries"));
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
        dirs_transferred: 0,
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
