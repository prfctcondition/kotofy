use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use windows_sys::Win32::System::Threading::{
    GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_TIME_CRITICAL,
};
use crate::engine::input::send_key_event;
use crate::engine::timer::HighResTimer;
use crate::models::{KeyEvent, PlayMode};

pub struct PlaybackEngine {
    current_abort: Option<Arc<AtomicBool>>,
    worker_handle: Option<JoinHandle<()>>,
    is_playing: Arc<AtomicBool>,
    active_down_keys: Arc<parking_lot::Mutex<[bool; 256]>>,
}

impl PlaybackEngine {
    pub fn new() -> Self {
        Self {
            current_abort: None,
            worker_handle: None,
            is_playing: Arc::new(AtomicBool::new(false)),
            active_down_keys: Arc::new(parking_lot::Mutex::new([false; 256])),
        }
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Relaxed)
    }

    pub fn stop(&mut self) {
        if let Some(abort) = self.current_abort.take() {
            abort.store(true, Ordering::SeqCst);
        }
        self.is_playing.store(false, Ordering::SeqCst);
        // Worker exits quickly via atomic abort check
        if let Some(handle) = self.worker_handle.take() {
            let _ = handle.join();
        }
        // Zero stuck keys: release any key left in down state
        release_all_keys(&self.active_down_keys);
    }

    pub fn play(&mut self, events: Vec<KeyEvent>, mode: PlayMode, repeat_delay_ms: u32) {
        self.stop();

        let active_events: Vec<KeyEvent> = events.into_iter().filter(|e| e.enabled).collect();
        if active_events.is_empty() {
            return;
        }

        let abort = Arc::new(AtomicBool::new(false));
        self.current_abort = Some(abort.clone());
        let is_playing = self.is_playing.clone();
        is_playing.store(true, Ordering::SeqCst);
        let active_keys = self.active_down_keys.clone();

        let handle = std::thread::spawn(move || {
            unsafe {
                SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
            }
            let timer = HighResTimer::new();

            match mode {
                PlayMode::SingleTime => {
                    execute_sequence(&active_events, &timer, &abort, &active_keys);
                }
                PlayMode::RepeatWhileHeld | PlayMode::ToggleRepeat => {
                    while !abort.load(Ordering::Relaxed) {
                        execute_sequence(&active_events, &timer, &abort, &active_keys);
                        if abort.load(Ordering::Relaxed) {
                            break;
                        }
                        if repeat_delay_ms > 0 {
                            timer.precise_wait(repeat_delay_ms as f64, &abort);
                        }
                    }
                }
            }

            release_all_keys(&active_keys);
            is_playing.store(false, Ordering::SeqCst);
        });

        self.worker_handle = Some(handle);
    }
}

#[inline(always)]
fn execute_sequence(
    events: &[KeyEvent],
    timer: &HighResTimer,
    abort: &AtomicBool,
    active_keys: &Arc<parking_lot::Mutex<[bool; 256]>>,
) {
    for event in events {
        if abort.load(Ordering::Relaxed) {
            return;
        }
        timer.precise_wait(event.delay_ms, abort);
        if abort.load(Ordering::Relaxed) {
            return;
        }
        let vk = event.vk as usize;
        if vk < 256 {
            active_keys.lock()[vk] = event.down;
        }
        send_key_event(event.vk, event.down);
    }
}

fn release_all_keys(active_keys: &Arc<parking_lot::Mutex<[bool; 256]>>) {
    let mut keys = active_keys.lock();
    for vk in 0..256 {
        if keys[vk] {
            send_key_event(vk as u32, false);
            keys[vk] = false;
        }
    }
}

impl Drop for PlaybackEngine {
    fn drop(&mut self) {
        self.stop();
    }
}
