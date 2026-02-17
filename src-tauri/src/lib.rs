pub mod commands;
pub mod error;
pub mod sync;
pub mod types;
pub mod webhook;

use tauri_plugin_store::StoreExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::add_entry,
            commands::remove_entry,
            commands::list_entries,
            commands::get_settings,
            commands::update_settings,
            commands::trigger_sync,
        ])
        .setup(|app| {
            // Load settings to get webhook port
            let store = app.store("shrike_data.json")?;
            let port = match store.get("settings") {
                Some(val) => {
                    let settings: types::AppSettings =
                        serde_json::from_value(val).unwrap_or_default();
                    settings.webhook_port
                }
                None => 18888,
            };

            webhook::start_webhook_server(app.handle().clone(), port);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
