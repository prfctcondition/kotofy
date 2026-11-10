use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use parking_lot::RwLock;
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Threading::{
    GetCurrentThread, GetCurrentThreadId, SetThreadPriority,
    THREAD_PRIORITY_TIME_CRITICAL,
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL,
    WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
};
use crate::engine::input::SYNTHETIC_EXTRA_INFO;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum HookMode {
    Idle = 0,
    Recording = 1,
    CaptureSingle = 2,
}

#[derive(Debug, Clone)]
pub struct HookKeyEvent {
    pub vk: u32,
    pub down: bool,
    pub delta_ms: f64,
}

pub struct HookSharedState {
    pub bound_keys: [AtomicBool; 256],
    pub is_paused: AtomicBool,
    pub pause_toggle_vk: AtomicU32,
    pub hook_mode: AtomicU32,
    pub key_sender: crossbeam_channel::Sender<HookKeyEvent>,
    pub capture_sender: crossbeam_channel::Sender<u32>,
}

static GLOBAL_STATE: RwLock<Option<Arc<HookSharedState>>> = RwLock::new(None);
static mut HOOK_HANDLE: HHOOK = std::ptr::null_mut();
static mut HOOK_THREAD_ID: u32 = 0;

unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if code < 0 {
        return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param);
    }

    let state = match GLOBAL_STATE.read().as_ref() {
        Some(s) => s.clone(),
        None => return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param),
    };

    let kb = *(l_param as *const KBDLLHOOKSTRUCT);

    // Skip our own synthetic keystrokes injected by SendInput
    if kb.dwExtraInfo == SYNTHETIC_EXTRA_INFO {
        return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param);
    }

    let vk = kb.vkCode;
    let down = w_param as u32 == WM_KEYDOWN || w_param as u32 == WM_SYSKEYDOWN;
    let mode = state.hook_mode.load(Ordering::Relaxed);

    // PRIORITY 1: CaptureSingle (must intercept before pause or bound hotkeys)
    if mode == HookMode::CaptureSingle as u32 {
        if down {
            let _ = state.capture_sender.try_send(vk);
            state.hook_mode.store(HookMode::Idle as u32, Ordering::SeqCst);
            return 1;
        }
        return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param);
    }

    // PRIORITY 2: Recording (stream all down and up events to coordinator)
    if mode == HookMode::Recording as u32 {
        let _ = state.key_sender.try_send(HookKeyEvent {
            vk,
            down,
            delta_ms: 0.0,
        });
        // In recording mode we allow keys to pass through to applications
        return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param);
    }

    // PRIORITY 3: Global pause toggle check (works in any window)
    let pause_vk = state.pause_toggle_vk.load(Ordering::Relaxed);
    if pause_vk != 0 && vk == pause_vk && down {
        let was_paused = state.is_paused.load(Ordering::Relaxed);
        state.is_paused.store(!was_paused, Ordering::SeqCst);
        let _ = state.key_sender.try_send(HookKeyEvent {
            vk,
            down,
            delta_ms: 0.0,
        });
        return 1; // Suppress the pause hotkey itself
    }

    // HookMode::Idle - When paused, do not process bindings
    if state.is_paused.load(Ordering::Relaxed) {
        return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param);
    }

    // Process Filter Pass-through:
    // If target window is not active, allow bound keys to pass through untouched to the active app!
    if !crate::engine::process_filter::is_target_active() {
        return CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param);
    }

    // O(1) atomic check: is this key bound to any active macro?
    if vk < 256 && state.bound_keys[vk as usize].load(Ordering::Relaxed) {
        // If standard modifier keys (Ctrl/Alt/Shift) are held, allow pass-through
        let is_modifier_held = (GetAsyncKeyState(VK_SHIFT as i32) & 0x8000u16 as i16) != 0
            || (GetAsyncKeyState(VK_CONTROL as i32) & 0x8000u16 as i16) != 0
            || (GetAsyncKeyState(VK_MENU as i32) & 0x8000u16 as i16) != 0;

        if !is_modifier_held {
            // Undo Caps Lock toggle — Windows driver toggles it before low-level hook runs
            if vk == 0x14 && down {
                crate::engine::input::send_key_event(0x14, true);
                crate::engine::input::send_key_event(0x14, false);
            }

            let _ = state.key_sender.try_send(HookKeyEvent {
                vk,
                down,
                delta_ms: 0.0,
            });
            // Suppress bound hotkey so it doesn't leak into chat or other inputs
            return 1;
        }
    }

    CallNextHookEx(std::ptr::null_mut(), code, w_param, l_param)
}

pub struct HookEngine {
    state: Arc<HookSharedState>,
    key_receiver: crossbeam_channel::Receiver<HookKeyEvent>,
    capture_receiver: crossbeam_channel::Receiver<u32>,
}

impl HookEngine {
    pub fn new() -> Self {
        const INIT_BOOL: AtomicBool = AtomicBool::new(false);
        let bound_keys = [INIT_BOOL; 256];

        let (key_tx, key_rx) = crossbeam_channel::unbounded();
        let (cap_tx, cap_rx) = crossbeam_channel::bounded(1);

        let state = Arc::new(HookSharedState {
            bound_keys,
            is_paused: AtomicBool::new(false),
            pause_toggle_vk: AtomicU32::new(0),
            hook_mode: AtomicU32::new(HookMode::Idle as u32),
            key_sender: key_tx,
            capture_sender: cap_tx,
        });

        *GLOBAL_STATE.write() = Some(state.clone());

        let (ready_tx, ready_rx) = crossbeam_channel::bounded(1);

        std::thread::spawn(move || unsafe {
            SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
            HOOK_THREAD_ID = GetCurrentThreadId();

            let h_module = GetModuleHandleW(std::ptr::null());
            HOOK_HANDLE = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                h_module,
                0,
            );
            let _err = windows_sys::Win32::Foundation::GetLastError();

            let _ = ready_tx.send(());

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            if !HOOK_HANDLE.is_null() {
                UnhookWindowsHookEx(HOOK_HANDLE);
                HOOK_HANDLE = std::ptr::null_mut();
            }
        });

        let _ = ready_rx.recv();

        Self {
            state,
            key_receiver: key_rx,
            capture_receiver: cap_rx,
        }
    }

    pub fn set_bound_keys(&self, active_keys: &[u32]) {
        for slot in &self.state.bound_keys {
            slot.store(false, Ordering::Relaxed);
        }
        for &vk in active_keys {
            if vk < 256 {
                self.state.bound_keys[vk as usize].store(true, Ordering::SeqCst);
            }
        }
    }

    pub fn set_pause_toggle_key(&self, vk: Option<u32>) {
        self.state
            .pause_toggle_vk
            .store(vk.unwrap_or(0), Ordering::SeqCst);
    }

    pub fn pause_toggle_vk(&self) -> u32 {
        self.state.pause_toggle_vk.load(Ordering::Relaxed)
    }

    pub fn set_paused(&self, paused: bool) {
        self.state.is_paused.store(paused, Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.state.is_paused.load(Ordering::Relaxed)
    }

    pub fn set_mode(&self, mode: HookMode) {
        self.state.hook_mode.store(mode as u32, Ordering::SeqCst);
    }

    pub fn send_hook_event_for_test(&self, evt: HookKeyEvent) {
        let _ = self.state.key_sender.send(evt);
    }

    pub fn try_recv_key(&self) -> Option<HookKeyEvent> {
        self.key_receiver.try_recv().ok()
    }

    pub fn recv_key(&self) -> Result<HookKeyEvent, crossbeam_channel::RecvError> {
        self.key_receiver.recv()
    }

    pub fn capture_single_key(&self, timeout: std::time::Duration) -> Option<u32> {
        // Drain any old captured key
        while self.capture_receiver.try_recv().is_ok() {}

        self.set_mode(HookMode::CaptureSingle);
        let result = self.capture_receiver.recv_timeout(timeout).ok();
        self.set_mode(HookMode::Idle);
        result
    }
}

impl Drop for HookEngine {
    fn drop(&mut self) {
        *GLOBAL_STATE.write() = None;
        unsafe {
            if HOOK_THREAD_ID != 0 {
                PostThreadMessageW(HOOK_THREAD_ID, WM_QUIT, 0, 0);
            }
        }
    }
}
