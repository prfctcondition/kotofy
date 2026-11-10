use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::Media::timeBeginPeriod;
use windows_sys::Win32::System::Performance::{QueryPerformanceCounter, QueryPerformanceFrequency};

pub struct HighResTimer {
    freq: i64,
}

impl HighResTimer {
    pub fn new() -> Self {
        unsafe {
            timeBeginPeriod(1);
        }
        let mut freq = 0i64;
        unsafe {
            QueryPerformanceFrequency(&mut freq);
        }
        Self { freq }
    }

    #[inline(always)]
    pub fn now_qpc(&self) -> i64 {
        let mut now = 0i64;
        unsafe {
            QueryPerformanceCounter(&mut now);
        }
        now
    }

    #[inline(always)]
    pub fn qpc_to_ms(&self, delta_ticks: i64) -> f64 {
        (delta_ticks as f64 * 1000.0) / (self.freq as f64)
    }

    #[inline(always)]
    pub fn ms_to_ticks(&self, ms: f64) -> i64 {
        ((ms / 1000.0) * (self.freq as f64)) as i64
    }

    pub fn spin_wait(&self, ms: f64, abort: &AtomicBool) {
        if ms <= 0.0 || abort.load(Ordering::Relaxed) {
            return;
        }
        let target_ticks = self.now_qpc() + self.ms_to_ticks(ms);
        while self.now_qpc() < target_ticks {
            if abort.load(Ordering::Relaxed) {
                return;
            }
            std::hint::spin_loop();
        }
    }

    pub fn precise_wait(&self, ms: f64, abort: &AtomicBool) {
        if ms <= 0.0 || abort.load(Ordering::Relaxed) {
            return;
        }
        // For sub-2ms intervals, spin-wait provides sub-0.05ms jitter without OS scheduling stalls
        if ms <= 2.0 {
            self.spin_wait(ms, abort);
            return;
        }

        // For longer intervals, sleep with 1ms granularity until 1.2ms before target, then spin-wait
        let start = self.now_qpc();
        let total_ticks = self.ms_to_ticks(ms);
        let target = start + total_ticks;
        let spin_lead_ticks = self.ms_to_ticks(1.2);

        loop {
            if abort.load(Ordering::Relaxed) {
                return;
            }
            let now = self.now_qpc();
            let remaining_ticks = target - now;
            if remaining_ticks <= spin_lead_ticks {
                break;
            }
            let remaining_ms = self.qpc_to_ms(remaining_ticks);
            if remaining_ms > 2.5 {
                std::thread::sleep(std::time::Duration::from_millis(1));
            } else {
                std::thread::yield_now();
            }
        }

        // Finish the final ~1.2ms with spin-wait for absolute precision
        while self.now_qpc() < target {
            if abort.load(Ordering::Relaxed) {
                return;
            }
            std::hint::spin_loop();
        }
    }
}

impl Drop for HighResTimer {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Media::timeEndPeriod(1);
        }
    }
}
