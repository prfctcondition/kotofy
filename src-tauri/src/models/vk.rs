use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

pub fn vk_to_string(vk: u32) -> String {
    if (0x41..=0x5A).contains(&vk) {
        return ((vk as u8) as char).to_string();
    }
    if (0x30..=0x39).contains(&vk) {
        return ((vk as u8) as char).to_string();
    }
    match vk as u16 {
        VK_ESCAPE => "Esc".to_string(),
        VK_TAB => "Tab".to_string(),
        VK_CAPITAL => "Caps".to_string(),
        VK_SHIFT | VK_LSHIFT | VK_RSHIFT => "Shift".to_string(),
        VK_CONTROL | VK_LCONTROL | VK_RCONTROL => "Ctrl".to_string(),
        VK_MENU | VK_LMENU | VK_RMENU => "Alt".to_string(),
        VK_SPACE => "Space".to_string(),
        VK_RETURN => "Enter".to_string(),
        VK_BACK => "Back".to_string(),
        VK_LEFT => "Left".to_string(),
        VK_UP => "Up".to_string(),
        VK_RIGHT => "Right".to_string(),
        VK_DOWN => "Down".to_string(),
        VK_INSERT => "Ins".to_string(),
        VK_DELETE => "Del".to_string(),
        VK_HOME => "Home".to_string(),
        VK_END => "End".to_string(),
        VK_PRIOR => "PgUp".to_string(),
        VK_NEXT => "PgDn".to_string(),
        VK_F1..=VK_F12 => format!("F{}", vk - (VK_F1 as u32) + 1),
        0xBA => ";".to_string(),
        0xBB => "=".to_string(),
        0xBC => ",".to_string(),
        0xBD => "-".to_string(),
        0xBE => ".".to_string(),
        0xBF => "/".to_string(),
        0xC0 => "`".to_string(),
        0xDB => "[".to_string(),
        0xDC => "\\".to_string(),
        0xDD => "]".to_string(),
        0xDE => "'".to_string(),
        _ => format!("0x{:02X}", vk),
    }
}

pub fn is_extended_key(vk: u32) -> bool {
    matches!(
        vk as u16,
        VK_LEFT
            | VK_UP
            | VK_RIGHT
            | VK_DOWN
            | VK_HOME
            | VK_END
            | VK_PRIOR
            | VK_NEXT
            | VK_INSERT
            | VK_DELETE
            | VK_LWIN
            | VK_RWIN
            | VK_APPS
            | VK_DIVIDE
            | VK_NUMLOCK
            | VK_RCONTROL
            | VK_RMENU
    )
}

pub fn get_hardware_scancode(vk: u32) -> (u16, bool) {
    let scancode = unsafe { MapVirtualKeyW(vk, MAPVK_VK_TO_VSC) } as u16;
    let extended = is_extended_key(vk);
    (scancode, extended)
}
