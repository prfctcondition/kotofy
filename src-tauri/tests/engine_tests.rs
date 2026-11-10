use std::sync::atomic::AtomicBool;
use kotofy_lib::engine::HighResTimer;
use kotofy_lib::models::vk::{get_hardware_scancode, vk_to_string};
use kotofy_lib::models::{AppConfig, KeyEvent, Macro, PlayMode, Profile};

#[test]
fn test_scancode_mapping_for_league_keys() {
    let keys = vec![
        (0x51, "Q"),
        (0x57, "W"),
        (0x45, "E"),
        (0x52, "R"),
        (0x44, "D"),
        (0x46, "F"),
        (0x20, "Space"),
        (0x14, "Caps"),
    ];

    for (vk, expected_name) in keys {
        assert_eq!(vk_to_string(vk), expected_name);
        let (scancode, _extended) = get_hardware_scancode(vk);
        assert!(scancode > 0, "Scancode for {} (0x{:X}) must be non-zero", expected_name, vk);
    }
}

#[test]
fn test_high_res_timer_precision_2ms() {
    let timer = HighResTimer::new();
    let abort = AtomicBool::new(false);

    let mut total_error_ms = 0.0;
    let iterations = 20;

    for _ in 0..iterations {
        let start = timer.now_qpc();
        timer.precise_wait(2.0, &abort);
        let elapsed_ticks = timer.now_qpc() - start;
        let elapsed_ms = timer.qpc_to_ms(elapsed_ticks);

        let error = (elapsed_ms - 2.0).abs();
        total_error_ms += error;

        // Verify delay does not suffer from Windows 15.6ms scheduler sleep spikes
        assert!(
            elapsed_ms >= 1.95 && elapsed_ms <= 2.30,
            "Delay drifted too far: {:.3}ms (expected 2.0ms)",
            elapsed_ms
        );
    }

    let avg_error = total_error_ms / (iterations as f64);
    assert!(
        avg_error < 0.15,
        "Average timing error {:.4}ms exceeds 0.15ms threshold",
        avg_error
    );
}

#[test]
fn test_macro_serialization_and_profiles() {
    let mut config = AppConfig::default();
    assert_eq!(config.profiles.len(), 3);
    assert_eq!(config.profiles[0].name, "Default");

    let mut yasuo = Profile::new("yasuo");
    let mut combo = Macro::new("Keyblade");
    combo.bind_key = Some(0x45); // E
    combo.play_mode = PlayMode::SingleTime;
    combo.events.push(KeyEvent::new(0x45, true, 2.0));
    combo.events.push(KeyEvent::new(0x51, true, 2.0));
    combo.events.push(KeyEvent::new(0x20, true, 2.0)); // Flash or Space
    yasuo.macros.push(combo);

    config.profiles.push(yasuo);

    let json = serde_json::to_string(&config).expect("Serialize failed");
    let deserialized: AppConfig = serde_json::from_str(&json).expect("Deserialize failed");

    assert_eq!(deserialized.profiles.len(), 4);
    assert_eq!(deserialized.profiles[3].name, "yasuo");
    assert_eq!(deserialized.profiles[3].macros[0].name, "Keyblade");
    assert_eq!(deserialized.profiles[3].macros[0].events.len(), 3);
}

#[test]
fn test_engine_coordinator_recording() {
    use std::sync::Arc;
    use parking_lot::RwLock;
    use kotofy_lib::engine::{EngineCoordinator, HookKeyEvent};
    use kotofy_lib::models::AppConfig;

    let config = Arc::new(RwLock::new(AppConfig::default()));
    let coord = Arc::new(EngineCoordinator::new(config));

    coord.start_recording();
    assert!(coord.is_recording.load(std::sync::atomic::Ordering::SeqCst));

    // Simulate key events coming in through key sender
    coord.hook.send_hook_event_for_test(HookKeyEvent {
        vk: 0x45,
        down: true,
        delta_ms: 0.0,
    });
    coord.hook.send_hook_event_for_test(HookKeyEvent {
        vk: 0x45,
        down: false,
        delta_ms: 0.0,
    });

    // Worker processes events
    coord.start_worker();
    std::thread::sleep(std::time::Duration::from_millis(50));

    let recorded = coord.stop_recording();
    assert_eq!(recorded.len(), 2);
    assert_eq!(recorded[0].vk, 0x45);
    assert!(recorded[0].down);
    assert_eq!(recorded[1].vk, 0x45);
    assert!(!recorded[1].down);
}
