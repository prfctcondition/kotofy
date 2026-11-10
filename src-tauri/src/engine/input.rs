use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use crate::models::vk::get_hardware_scancode;

pub const SYNTHETIC_EXTRA_INFO: usize = 0x5A656E5A;

pub fn send_key_event(vk: u32, down: bool) {
    let (scancode, extended) = get_hardware_scancode(vk);

    let mut flags = 0;
    if scancode != 0 {
        flags |= KEYEVENTF_SCANCODE;
    }
    if !down {
        flags |= KEYEVENTF_KEYUP;
    }
    if extended {
        flags |= KEYEVENTF_EXTENDEDKEY;
    }

    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: if scancode != 0 { 0 } else { vk as u16 },
                wScan: scancode,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: SYNTHETIC_EXTRA_INFO,
            },
        },
    };

    unsafe {
        SendInput(
            1,
            &input,
            std::mem::size_of::<INPUT>() as i32,
        );
    }
}
