use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use windows_sys::Win32::Foundation::{CloseHandle, HWND};
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetForegroundWindow, GetWindowThreadProcessId, GA_ROOTOWNER,
};

static TARGET_FILTER: parking_lot::RwLock<String> = parking_lot::RwLock::new(String::new());
static FILTER_ENABLED: AtomicBool = AtomicBool::new(false);
static FILTER_DIRTY: AtomicBool = AtomicBool::new(false);
static IS_TARGET_ACTIVE: AtomicBool = AtomicBool::new(true);

/// Zero-overhead hot path: single atomic load.
/// 0 ns overhead, 0 heap allocations, 0 Win32 syscalls, 0 lock contention.
#[inline(always)]
pub fn is_target_active() -> bool {
    IS_TARGET_ACTIVE.load(Ordering::Relaxed)
}

pub struct ProcessWatcher {
    stop_flag: Arc<AtomicBool>,
}

impl ProcessWatcher {
    pub fn new() -> Self {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop = stop_flag.clone();

        std::thread::Builder::new()
            .name("kotofy-process-watcher".to_string())
            .spawn(move || {
                let mut last_hwnd: HWND = std::ptr::null_mut();
                let mut local_target = String::new();
                let mut local_target_clean = String::new();

                while !stop.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_millis(50));

                    if !FILTER_ENABLED.load(Ordering::Relaxed) {
                        IS_TARGET_ACTIVE.store(true, Ordering::Relaxed);
                        last_hwnd = std::ptr::null_mut();
                        continue;
                    }

                    // Check if filter configuration was changed without allocating repeatedly
                    if FILTER_DIRTY.swap(false, Ordering::AcqRel) {
                        let filter_guard = TARGET_FILTER.read();
                        local_target = filter_guard.to_lowercase();
                        local_target_clean = local_target.trim_end_matches(".exe").to_string();
                        drop(filter_guard);
                        last_hwnd = std::ptr::null_mut(); // Force re-eval on config change
                    }

                    if local_target.is_empty() {
                        IS_TARGET_ACTIVE.store(true, Ordering::Relaxed);
                        continue;
                    }

                    let hwnd = unsafe { GetForegroundWindow() };
                    if hwnd.is_null() {
                        // Transient state (e.g. Alt-Tab or fullscreen transition) — retain previous state
                        continue;
                    }

                    // If foreground window has not changed, do zero work and sleep!
                    if hwnd == last_hwnd {
                        continue;
                    }

                    last_hwnd = hwnd;

                    // Foreground HWND changed: resolve process name once
                    let is_match = unsafe {
                        let mut matched = check_window_process(hwnd, &local_target, &local_target_clean);
                        if !matched {
                            let root_hwnd = GetAncestor(hwnd, GA_ROOTOWNER);
                            if !root_hwnd.is_null() && root_hwnd != hwnd {
                                matched = check_window_process(root_hwnd, &local_target, &local_target_clean);
                            }
                        }
                        matched
                    };

                    IS_TARGET_ACTIVE.store(is_match, Ordering::Release);
                }
            })
            .expect("failed to spawn kotofy-process-watcher thread");

        Self { stop_flag }
    }

    pub fn set_filter(&self, name: &str, enabled: bool) {
        *TARGET_FILTER.write() = name.to_string();
        FILTER_DIRTY.store(true, Ordering::Release);
        FILTER_ENABLED.store(enabled, Ordering::Release);

        if !enabled || name.is_empty() {
            IS_TARGET_ACTIVE.store(true, Ordering::Release);
        } else {
            // Immediate synchronous check for instantaneous feedback upon clicking Save/Apply
            let target_lower = name.to_lowercase();
            let target_clean = target_lower.trim_end_matches(".exe");
            let hwnd = unsafe { GetForegroundWindow() };
            let mut matched = false;
            if !hwnd.is_null() {
                unsafe {
                    matched = check_window_process(hwnd, &target_lower, target_clean);
                    if !matched {
                        let root_hwnd = GetAncestor(hwnd, GA_ROOTOWNER);
                        if !root_hwnd.is_null() && root_hwnd != hwnd {
                            matched = check_window_process(root_hwnd, &target_lower, target_clean);
                        }
                    }
                }
            }
            IS_TARGET_ACTIVE.store(matched, Ordering::Release);
        }
    }

    #[inline(always)]
    pub fn is_active(&self) -> bool {
        is_target_active()
    }
}

impl Drop for ProcessWatcher {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }
}

/// Safely queries the executable path for the given HWND and checks against the target name.
/// Guaranteed CloseHandle on every path with zero handle leaks.
unsafe fn check_window_process(hwnd: HWND, target_lower: &str, target_clean: &str) -> bool {
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, &mut pid);
    if pid == 0 {
        return false;
    }

    let h_process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if h_process.is_null() {
        return false;
    }

    let mut path_buf = [0u16; 1024];
    let mut size = path_buf.len() as u32;
    let success = QueryFullProcessImageNameW(h_process, 0, path_buf.as_mut_ptr(), &mut size);
    CloseHandle(h_process); // Immediately close handle — zero leak guaranteed!

    if success != 0 && size > 0 {
        let path_slice = &path_buf[..size as usize];
        let file_start = path_slice
            .iter()
            .rposition(|&c| c == b'\\' as u16 || c == b'/' as u16)
            .map(|i| i + 1)
            .unwrap_or(0);

        let exe_slice = &path_slice[file_start..];
        let exe_name = String::from_utf16_lossy(exe_slice).to_lowercase();
        let exe_clean = exe_name.trim_end_matches(".exe");

        return exe_name == target_lower
            || exe_clean == target_clean
            || exe_clean.contains(target_clean)
            || exe_name.contains(target_lower);
    }

    false
}
