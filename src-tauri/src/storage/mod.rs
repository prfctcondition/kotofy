use std::fs;
use std::path::PathBuf;
use crate::models::{AppConfig, Macro, Profile, KeyEvent, PlayMode};

pub struct StorageManager {
    base_dir: PathBuf,
    config_path: PathBuf,
    legacy_macros_dir: PathBuf,
    legacy_profiles_dir: PathBuf,
}

impl StorageManager {
    pub fn new() -> Self {
        let base_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ZenZakura");
        
        let _ = fs::create_dir_all(&base_dir);
        let config_path = base_dir.join("kotofy_config.json");
        let legacy_macros_dir = base_dir.join("Macros");
        let legacy_profiles_dir = base_dir.join("profiles");

        Self {
            base_dir,
            config_path,
            legacy_macros_dir,
            legacy_profiles_dir,
        }
    }

    pub fn load_or_default(&self) -> AppConfig {
        if self.config_path.exists() {
            if let Ok(content) = fs::read_to_string(&self.config_path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }

        let mut config = AppConfig::default();
        self.import_legacy_macros(&mut config);
        let _ = self.save(&config);
        config
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), std::io::Error> {
        let json = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, json)
    }

    pub fn import_legacy_macros(&self, config: &mut AppConfig) {
        // 1. Scan legacy profiles directory (%LOCALAPPDATA%\ZenZakura\profiles\*.zprofile)
        if self.legacy_profiles_dir.exists() {
            if let Ok(entries) = fs::read_dir(&self.legacy_profiles_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("zprofile") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let _ = parse_and_import_json(&content, config);
                        }
                    }
                }
            }
        }

        // 2. Scan legacy macros directory (%LOCALAPPDATA%\ZenZakura\Macros\*.zmacro)
        if self.legacy_macros_dir.exists() {
            if let Ok(entries) = fs::read_dir(&self.legacy_macros_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("zmacro") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let _ = parse_and_import_json(&content, config);
                        }
                    }
                }
            }
        }
    }
}

pub fn parse_and_import_json(content: &str, config: &mut AppConfig) -> Result<String, String> {
    let val: serde_json::Value = serde_json::from_str(content).map_err(|e| e.to_string())?;

    // Case 1: .zprofile format (contains "Macros" array)
    if let Some(macros_arr) = val.get("Macros").or_else(|| val.get("macros")).and_then(|m| m.as_array()) {
        let profile_name = val["Name"]
            .as_str()
            .or_else(|| val["name"].as_str())
            .unwrap_or("Imported Profile")
            .trim();

        let mut macros = Vec::new();
        for m_val in macros_arr {
            let m_name = m_val["Name"]
                .as_str()
                .or_else(|| m_val["name"].as_str())
                .unwrap_or("Macro")
                .to_string();
            let mut m = Macro::new(m_name);
            if let Some(vk) = m_val["BindKey"].as_u64().or_else(|| m_val["bind_key"].as_u64()) {
                if vk > 0 {
                    m.bind_key = Some(vk as u32);
                }
            }
            if let Some(pm) = m_val["PlayMode"].as_i64().or_else(|| m_val["play_mode"].as_i64()) {
                m.play_mode = PlayMode::from_index(pm as i32);
            }
            if let Some(en) = m_val["IsHotkeyEnabled"].as_bool().or_else(|| m_val["is_enabled"].as_bool()) {
                m.is_enabled = en;
            }
            if let Some(events_arr) = m_val["Events"].as_array().or_else(|| m_val["events"].as_array()) {
                for ev in events_arr {
                    let vk = ev["Vk"].as_u64().or_else(|| ev["vk"].as_u64()).unwrap_or(0) as u32;
                    let down = ev["Down"].as_bool().or_else(|| ev["down"].as_bool()).unwrap_or(true);
                    let delay_ms = ev["DelayMs"].as_f64().or_else(|| ev["delay_ms"].as_f64()).unwrap_or(2.0);
                    m.events.push(KeyEvent::new(vk, down, delay_ms));
                }
            }
            macros.push(m);
        }

        // Check if profile with this name already exists
        if let Some(existing) = config.profiles.iter_mut().find(|p| p.name.eq_ignore_ascii_case(profile_name)) {
            existing.macros = macros;
            config.active_profile_id = existing.id.clone();
        } else {
            let mut new_prof = Profile::new(profile_name);
            let new_id = new_prof.id.clone();
            new_prof.macros = macros;
            config.profiles.push(new_prof);
            config.active_profile_id = new_id;
        }

        if let Some(settings) = val.get("Settings").or_else(|| val.get("settings")) {
            if let Some(pause_vk) = settings["PauseToggleKey"].as_u64().or_else(|| settings["global_pause_vk"].as_u64()) {
                if pause_vk > 0 {
                    if pause_vk == 117 {
                        config.global_pause_vk = Some(0x7B); // Map ZenZakura legacy F6 to standard F12
                    } else {
                        config.global_pause_vk = Some(pause_vk as u32);
                    }
                }
            }
            if let Some(filter) = settings["ProcessFilter"].as_str().or_else(|| settings["process_filter"].as_str()) {
                config.process_filter = filter.to_string();
            }
            if let Some(en) = settings["ProcessFilterEnabled"].as_bool().or_else(|| settings["process_filter_enabled"].as_bool()) {
                config.process_filter_enabled = en;
            }
        }

        return Ok(format!("Imported profile '{}' with {} macros", profile_name, macros_arr.len()));
    }

    // Case 2: .zmacro format (single macro, contains "Events" array)
    if val.get("Events").is_some() || val.get("events").is_some() {
        let name = val["Name"].as_str().or_else(|| val["name"].as_str()).unwrap_or("Imported Macro").to_string();
        let mut m = Macro::new(name.clone());
        if let Some(vk) = val["BindKey"].as_u64().or_else(|| val["bind_key"].as_u64()) {
            if vk > 0 {
                m.bind_key = Some(vk as u32);
            }
        }
        if let Some(pm) = val["PlayMode"].as_i64().or_else(|| val["play_mode"].as_i64()) {
            m.play_mode = PlayMode::from_index(pm as i32);
        }
        if let Some(events_arr) = val["Events"].as_array().or_else(|| val["events"].as_array()) {
            for ev in events_arr {
                let vk = ev["Vk"].as_u64().or_else(|| ev["vk"].as_u64()).unwrap_or(0) as u32;
                let down = ev["Down"].as_bool().or_else(|| ev["down"].as_bool()).unwrap_or(true);
                let delay_ms = ev["DelayMs"].as_f64().or_else(|| ev["delay_ms"].as_f64()).unwrap_or(2.0);
                m.events.push(KeyEvent::new(vk, down, delay_ms));
            }
        }

        // Add to active profile
        if let Some(active_prof) = config.profiles.iter_mut().find(|p| p.id == config.active_profile_id) {
            active_prof.macros.push(m);
        } else if let Some(first_prof) = config.profiles.first_mut() {
            first_prof.macros.push(m);
        }

        return Ok(format!("Imported macro '{}'", name));
    }

    Err("Unrecognized macro format: missing 'Events' or 'Macros' array".to_string())
}
