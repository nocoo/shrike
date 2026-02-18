pub mod commands;
pub mod error;
pub mod sync;
pub mod types;
pub mod webhook;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_store::StoreExt;

const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray-icon.png");

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            commands::add_entry,
            commands::remove_entry,
            commands::list_entries,
            commands::get_settings,
            commands::update_settings,
            commands::trigger_sync,
            commands::get_autostart,
            commands::set_autostart,
            commands::set_tray_visible,
            commands::scan_coding_configs,
        ])
        .setup(|app| {
            // Load settings
            let store = app.store("shrike_data.json")?;
            let settings = match store.get("settings") {
                Some(val) => {
                    serde_json::from_value::<types::AppSettings>(val).unwrap_or_default()
                }
                None => types::AppSettings::default(),
            };

            // Start webhook server
            webhook::start_webhook_server(app.handle().clone(), settings.webhook_port);

            // Build system tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit Shrike", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Shrike", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let tray_icon = Image::from_bytes(TRAY_ICON_BYTES)?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("Shrike")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Apply tray visibility from settings
            if !settings.show_tray_icon
                && let Some(tray) = app.tray_by_id("main-tray")
            {
                let _ = tray.set_visible(false);
            }

            // Close-to-tray: hide window instead of destroying it
            let window = app.get_webview_window("main").unwrap();
            let w = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = w.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
