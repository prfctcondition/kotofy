use serde::{Deserialize, Serialize};
use uuid::Uuid;
use super::macro_def::Macro;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Profile {
    #[serde(default = "generate_id")]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub macros: Vec<Macro>,
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

impl Profile {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: generate_id(),
            name: name.into(),
            macros: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    pub active_profile_id: String,
    #[serde(default)]
    pub profiles: Vec<Profile>,
    pub global_pause_vk: Option<u32>,
    #[serde(default)]
    pub process_filter: String,
    #[serde(default)]
    pub process_filter_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut default_profile = Profile::new("Default");
        let yasuo_profile = Profile::new("yasuo");
        let yone_profile = Profile::new("yone");

        // Example combo macros
        let mut eqr = Macro::new("eqr");
        eqr.bind_key = Some(0x14); // CapsLock
        eqr.events = vec![
            super::key_event::KeyEvent::new(0x45, true, 2.0),  // E down
            super::key_event::KeyEvent::new(0x45, false, 2.0), // E up
            super::key_event::KeyEvent::new(0x51, true, 2.0),  // Q down
            super::key_event::KeyEvent::new(0x51, false, 2.0), // Q up
            super::key_event::KeyEvent::new(0x52, true, 2.0),  // R down
            super::key_event::KeyEvent::new(0x52, false, 2.0), // R up
        ];
        default_profile.macros.push(eqr);

        let mut qn = Macro::new("qn");
        qn.bind_key = Some(0x51); // Q
        default_profile.macros.push(qn);

        let mut em = Macro::new("em");
        em.bind_key = Some(0x45); // E
        default_profile.macros.push(em);

        let active_id = default_profile.id.clone();

        Self {
            active_profile_id: active_id,
            profiles: vec![default_profile, yasuo_profile, yone_profile],
            global_pause_vk: Some(0x7B), // F12 default
            process_filter: "".to_string(), // Universal / all windows by default
            process_filter_enabled: false,
        }
    }
}
