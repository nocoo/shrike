use std::net::SocketAddr;

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::sync;
use crate::types::{AppSettings, BackupEntry, SyncStatus};

const STORE_FILE: &str = "shrike_data.json";
const ITEMS_KEY: &str = "items";
const SETTINGS_KEY: &str = "settings";

/// Abstraction over the data layer so handlers can be tested without
/// a real Tauri runtime.
pub trait DataStore: Clone + Send + Sync + 'static {
    fn load_settings(&self) -> Result<AppSettings, String>;
    fn load_items(&self) -> Result<Vec<BackupEntry>, String>;
}

/// Production implementation backed by the Tauri plugin-store.
#[derive(Clone)]
struct TauriStore {
    app: AppHandle,
}

impl DataStore for TauriStore {
    fn load_settings(&self) -> Result<AppSettings, String> {
        let store = self.app.store(STORE_FILE).map_err(|e| e.to_string())?;
        match store.get(SETTINGS_KEY) {
            Some(val) => serde_json::from_value(val).map_err(|e| e.to_string()),
            None => Ok(AppSettings::default()),
        }
    }

    fn load_items(&self) -> Result<Vec<BackupEntry>, String> {
        let store = self.app.store(STORE_FILE).map_err(|e| e.to_string())?;
        match store.get(ITEMS_KEY) {
            Some(val) => serde_json::from_value(val).map_err(|e| e.to_string()),
            None => Ok(Vec::new()),
        }
    }
}

/// Validate the bearer token from the Authorization header.
fn validate_token(headers: &HeaderMap, expected_token: &str) -> Result<(), StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if token != expected_token {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(())
}

/// GET /status — returns current sync status.
async fn status_handler<S: DataStore>(
    State(store): State<S>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let settings = match store.load_settings() {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))),
    };

    if let Err(status) = validate_token(&headers, &settings.webhook_token) {
        return (status, Json(json!({"error": "unauthorized"})));
    }

    let items = store.load_items().unwrap_or_default();
    let destination = match settings.destination_path() {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        }
    };
    (
        StatusCode::OK,
        Json(json!({
            "status": if sync::is_sync_running() { SyncStatus::Running } else { SyncStatus::Idle },
            "entries_count": items.len(),
            "destination": destination,
        })),
    )
}

/// POST /sync — triggers a sync operation.
async fn sync_handler<S: DataStore>(
    State(store): State<S>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let settings = match store.load_settings() {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))),
    };

    if let Err(status) = validate_token(&headers, &settings.webhook_token) {
        return (status, Json(json!({"error": "unauthorized"})));
    }

    let entries = match store.load_items() {
        Ok(items) => items,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))),
    };

    if entries.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "no entries to sync"})),
        );
    }

    match sync::execute_sync(&entries, &settings) {
        Ok(result) => (StatusCode::OK, Json(json!(result))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        ),
    }
}

/// Build the webhook router with the given data store.
///
/// Exposed publicly so integration tests can build a router with a mock store
/// and exercise the handlers via `tower::ServiceExt::oneshot`.
pub fn build_router<S: DataStore>(store: S) -> Router {
    Router::new()
        .route("/status", get(status_handler::<S>))
        .route("/sync", post(sync_handler::<S>))
        .with_state(store)
}

/// Start the webhook server in a background task.
pub fn start_webhook_server(app: AppHandle, port: u16) {
    let store = TauriStore { app };
    let router = build_router(store);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("webhook server failed to bind to {addr}: {e}");
                return;
            }
        };
        println!("webhook server listening on {addr}");
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("webhook server error: {e}");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn validate_token_valid() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Bearer my-token"));
        assert!(validate_token(&headers, "my-token").is_ok());
    }

    #[test]
    fn validate_token_invalid() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Bearer wrong"));
        assert_eq!(
            validate_token(&headers, "correct").unwrap_err(),
            StatusCode::UNAUTHORIZED
        );
    }

    #[test]
    fn validate_token_missing_header() {
        let headers = HeaderMap::new();
        assert_eq!(
            validate_token(&headers, "token").unwrap_err(),
            StatusCode::UNAUTHORIZED
        );
    }

    #[test]
    fn validate_token_wrong_scheme() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Basic my-token"));
        assert_eq!(
            validate_token(&headers, "my-token").unwrap_err(),
            StatusCode::UNAUTHORIZED
        );
    }
}
