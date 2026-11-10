pub mod hook;
pub mod input;
pub mod playback;
pub mod process_filter;
pub mod timer;

pub use hook::{HookEngine, HookKeyEvent, HookMode};
pub use input::send_key_event;
pub use playback::PlaybackEngine;
pub use process_filter::ProcessWatcher;
pub use timer::HighResTimer;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::RwLock;
use crate::models::{AppConfig, KeyEvent, PlayMode};

#[derive(Debug, Clone)]
pub struct LiveInspectorEvent {
    pub key_name: String,
    pub down: bool,
    pub delay_ms: f64,
    pub is_synthetic: bool,
}

pub struct EngineCoordinator {
    pub hook: HookEngine,
    pub playback: parking_lot::Mutex<PlaybackEngine>,
    pub process_watcher: ProcessWatcher,
    pub config: Arc<RwLock<AppConfig>>,
    pub is_recording: AtomicBool,
    pub recording_events: Arc<RwLock<Vec<KeyEvent>>>,
    pub recording_start_qpc: std::sync::atomic::AtomicI64,
    pub timer: HighResTimer,
    pub key_was_down: [AtomicBool; 256],
    pub app_handle: parking_lot::RwLock<Option<tauri::AppHandle>>,
}

impl EngineCoordinator {
    pub fn new(config: Arc<RwLock<AppConfig>>) -> Self {
        let hook = HookEngine::new();
        let playback = parking_lot::Mutex::new(PlaybackEngine::new());
        let process_watcher = ProcessWatcher::new();
        let timer = HighResTimer::new();

        const INIT_BOOL: AtomicBool = AtomicBool::new(false);
        let key_was_down = [INIT_BOOL; 256];

        let cfg = config.read();
        hook.set_pause_toggle_key(cfg.global_pause_vk);
        process_watcher.set_filter(&cfg.process_filter, cfg.process_filter_enabled);

        let active_keys = get_active_hotkeys(&cfg);
        hook.set_bound_keys(&active_keys);
        drop(cfg);

        Self {
            hook,
            playback,
            process_watcher,
            config,
            is_recording: AtomicBool::new(false),
            recording_events: Arc::new(RwLock::new(Vec::new())),
            recording_start_qpc: std::sync::atomic::AtomicI64::new(0),
            timer,
            key_was_down,
            app_handle: parking_lot::RwLock::new(None),
        }
    }

    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.write() = Some(handle);
    }

    pub fn start_worker(self: &Arc<Self>) {
        let coord = self.clone();
        std::thread::spawn(move || {
            while let Ok(evt) = coord.hook.recv_key() {
                coord.handle_incoming_key(evt);
            }
        });
    }

    fn handle_incoming_key(&self, evt: HookKeyEvent) {
        // Auto-repeat debounce: ignore repeating WM_KEYDOWN across both recording and playback
        let vk_idx = evt.vk as usize;
        if vk_idx < 256 {
            if evt.down {
                let already_down = self.key_was_down[vk_idx].swap(true, Ordering::SeqCst);
                if already_down {
                    return; // Ignore keyboard auto-repeat!
                }
            } else {
                self.key_was_down[vk_idx].store(false, Ordering::SeqCst);
            }
        }

        // Handle global pause toggle hotkey
        let pause_vk = self.hook.pause_toggle_vk();
        if pause_vk != 0 && evt.vk == pause_vk && evt.down {
            let is_p = self.hook.is_paused();
            if is_p {
                self.playback.lock().stop();
            }
            if let Some(app) = self.app_handle.read().as_ref() {
                use tauri::Emitter;
                let _ = app.emit("engine-pause-changed", is_p);
            }
            return;
        }

        if self.is_recording.load(Ordering::Relaxed) {
            let now = self.timer.now_qpc();
            let last = self.recording_start_qpc.swap(now, Ordering::SeqCst);
            let is_first = self.recording_events.read().is_empty();
            let delta_ms = if is_first {
                2.0
            } else {
                let diff = (self.timer.qpc_to_ms(now - last) * 10.0).round() / 10.0;
                diff.max(0.5)
            };

            let ke = KeyEvent::new(evt.vk, evt.down, delta_ms);
            self.recording_events.write().push(ke.clone());

            // Real-time stream to UI if Tauri app handle is connected
            if let Some(app) = self.app_handle.read().as_ref() {
                use tauri::Emitter;
                let _ = app.emit("macro-record-event", &ke);
            }
            return;
        }

        // Global pause check
        if self.hook.is_paused() {
            return;
        }

        if !self.process_watcher.is_active() {
            return;
        }

        let cfg = self.config.read();
        if let Some(profile) = cfg.profiles.iter().find(|p| p.id == cfg.active_profile_id) {
            if let Some(m) = profile.macros.iter().find(|m| m.bind_key == Some(evt.vk) && m.is_enabled) {
                let events = m.events.clone();
                let mode = m.play_mode;
                let delay = m.repeat_delay_ms;
                drop(cfg);

                match mode {
                    PlayMode::SingleTime => {
                        if evt.down {
                            self.playback.lock().play(events, mode, delay);
                        }
                    }
                    PlayMode::RepeatWhileHeld => {
                        if evt.down {
                            self.playback.lock().play(events, mode, delay);
                        } else {
                            self.playback.lock().stop();
                        }
                    }
                    PlayMode::ToggleRepeat => {
                        if evt.down {
                            let mut pb = self.playback.lock();
                            if pb.is_playing() {
                                pb.stop();
                            } else {
                                pb.play(events, mode, delay);
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn sync_bindings(&self) {
        let cfg = self.config.read();
        let active_keys = get_active_hotkeys(&cfg);
        self.hook.set_bound_keys(&active_keys);
        self.hook.set_pause_toggle_key(cfg.global_pause_vk);
        self.process_watcher
            .set_filter(&cfg.process_filter, cfg.process_filter_enabled);
    }

    pub fn start_recording(&self) {
        self.recording_events.write().clear();
        self.recording_start_qpc
            .store(self.timer.now_qpc(), Ordering::SeqCst);
        self.is_recording.store(true, Ordering::SeqCst);
        self.hook.set_mode(HookMode::Recording);
    }

    pub fn stop_recording(&self) -> Vec<KeyEvent> {
        self.is_recording.store(false, Ordering::SeqCst);
        self.hook.set_mode(HookMode::Idle);
        self.recording_events.read().clone()
    }

    pub fn test_play_macro(&self, macro_idx: usize) {
        let cfg = self.config.read();
        if let Some(profile) = cfg.profiles.iter().find(|p| p.id == cfg.active_profile_id) {
            if let Some(m) = profile.macros.get(macro_idx) {
                let events = m.events.clone();
                let mode = m.play_mode;
                let delay = m.repeat_delay_ms;
                drop(cfg);
                self.playback.lock().play(events, mode, delay);
            }
        }
    }

    pub fn stop_playback(&self) {
        self.playback.lock().stop();
    }

    pub fn is_playing(&self) -> bool {
        self.playback.lock().is_playing()
    }
}

fn get_active_hotkeys(cfg: &AppConfig) -> Vec<u32> {
    let mut keys = Vec::new();
    if let Some(profile) = cfg.profiles.iter().find(|p| p.id == cfg.active_profile_id) {
        for m in &profile.macros {
            if m.is_enabled {
                if let Some(vk) = m.bind_key {
                    keys.push(vk);
                }
            }
        }
    }
    keys
}
