pub mod commands;
pub mod error;
pub mod sync;
pub mod types;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::add_entry,
            commands::remove_entry,
            commands::list_entries,
            commands::get_settings,
            commands::update_settings,
            commands::trigger_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
