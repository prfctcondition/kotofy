pub mod engine;
pub mod models;
pub mod storage;

use std::sync::Arc;
use std::time::Duration;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State};

use crate::engine::EngineCoordinator;
use crate::models::{AppConfig, KeyEvent, vk::vk_to_string};
use crate::storage::StorageManager;

pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub storage: StorageManager,
    pub engine: Arc<EngineCoordinator>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStatus {
    pub is_playing: bool,
    pub is_recording: bool,
    pub is_paused: bool,
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> AppConfig {
    state.config.read().clone()
}

#[tauri::command]
fn save_config(new_config: AppConfig, state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut cfg = state.config.write();
        *cfg = new_config;
        state.storage.save(&cfg).map_err(|e| e.to_string())?;
    } // Explicitly drop write lock before calling sync_bindings() to prevent deadlock!
    state.engine.sync_bindings();
    Ok(())
}

#[tauri::command]
async fn capture_key(state: State<'_, AppState>) -> Result<Option<u32>, String> {
    let engine = state.engine.clone();
    let res = tauri::async_runtime::spawn_blocking(move || {
        engine.hook.capture_single_key(Duration::from_secs(10))
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
fn test_play_macro(macro_idx: usize, state: State<'_, AppState>) {
    state.engine.test_play_macro(macro_idx);
}

#[tauri::command]
fn stop_playback(state: State<'_, AppState>) {
    state.engine.stop_playback();
}

#[tauri::command]
fn start_recording(state: State<'_, AppState>) {
    state.engine.start_recording();
}

#[tauri::command]
fn stop_recording(state: State<'_, AppState>) -> Vec<KeyEvent> {
    state.engine.stop_recording()
}

#[tauri::command]
fn toggle_pause(app: tauri::AppHandle, state: State<'_, AppState>) -> bool {
    let is_p = state.engine.hook.is_paused();
    let new_state = !is_p;
    state.engine.hook.set_paused(new_state);
    if new_state {
        state.engine.stop_playback();
    }
    use tauri::Emitter;
    let _ = app.emit("engine-pause-changed", new_state);
    new_state
}

#[tauri::command]
fn get_is_paused(state: State<'_, AppState>) -> bool {
    state.engine.hook.is_paused()
}

#[tauri::command]
fn set_paused(paused: bool, app: tauri::AppHandle, state: State<'_, AppState>) -> bool {
    state.engine.hook.set_paused(paused);
    if paused {
        state.engine.stop_playback();
    }
    use tauri::Emitter;
    let _ = app.emit("engine-pause-changed", paused);
    paused
}

#[tauri::command]
fn import_legacy_macros(state: State<'_, AppState>) -> AppConfig {
    let mut cfg = state.config.write();
    state.storage.import_legacy_macros(&mut cfg);
    let _ = state.storage.save(&cfg);
    let result = cfg.clone();
    drop(cfg);
    state.engine.sync_bindings();
    result
}

#[tauri::command]
fn import_macro_content(content: String, state: State<'_, AppState>) -> Result<AppConfig, String> {
    let mut cfg = state.config.write();
    crate::storage::parse_and_import_json(&content, &mut cfg)?;
    state.storage.save(&cfg).map_err(|e| e.to_string())?;
    let result = cfg.clone();
    drop(cfg);
    state.engine.sync_bindings();
    Ok(result)
}

#[tauri::command]
fn get_key_name(vk: u32) -> String {
    vk_to_string(vk)
}

#[tauri::command]
fn get_engine_status(state: State<'_, AppState>) -> EngineStatus {
    EngineStatus {
        is_playing: state.engine.is_playing(),
        is_recording: state.engine.is_recording.load(std::sync::atomic::Ordering::Relaxed),
        is_paused: state.engine.hook.is_paused(),
    }
}

// Native Window Management commands (100% reliable, direct OS window control)
#[tauri::command]
fn app_minimize(window: tauri::Window) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.hide();
}

#[tauri::command]
fn app_toggle_maximize(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn app_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn app_close(window: tauri::Window) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.hide();
}

#[tauri::command]
fn app_hide(window: tauri::Window) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.hide();
}

pub fn run() {
    let storage = StorageManager::new();
    let config = Arc::new(RwLock::new(storage.load_or_default()));
    let engine = Arc::new(EngineCoordinator::new(config.clone()));
    engine.start_worker();

    let engine_for_setup = engine.clone();

    let app_state = AppState {
        config,
        storage,
        engine,
    };

    tauri::Builder::default()
        .setup(move |app| {
            engine_for_setup.set_app_handle(app.handle().clone());

            // 1. Build tray context menu in English ("Open" and "Exit")
            let open_i = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let exit_i = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &exit_i])?;

            // 2. High-resolution tray icon
            let tray_icon_img = app.default_window_icon().cloned()
                .or_else(|| tauri::image::Image::from_app_icon_resource(128).ok())
                .expect("failed to load high-res app icon");

            // 3. Build system tray with click handlers
            let _tray = TrayIconBuilder::new()
                .icon(tray_icon_img.clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_skip_taskbar(false);
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "exit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click on tray icon restores and focuses the window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_skip_taskbar(false);
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 4. Ensure window runtime icon is explicitly set to the crisp high-res icon
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(tray_icon_img);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // CloseRequested on window frame -> hide to tray and remove from Windows taskbar
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.set_skip_taskbar(true);
                let _ = window.hide();
            }
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            capture_key,
            test_play_macro,
            stop_playback,
            start_recording,
            stop_recording,
            toggle_pause,
            get_is_paused,
            set_paused,
            import_legacy_macros,
            import_macro_content,
            get_key_name,
            get_engine_status,
            app_minimize,
            app_toggle_maximize,
            app_start_dragging,
            app_close,
            app_hide,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
