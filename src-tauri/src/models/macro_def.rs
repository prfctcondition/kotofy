use serde::{Deserialize, Serialize};
use uuid::Uuid;
use super::key_event::KeyEvent;
use super::vk::vk_to_string;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum PlayMode {
    #[default]
    SingleTime = 0,
    RepeatWhileHeld = 1,
    ToggleRepeat = 2,
}

impl PlayMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            PlayMode::SingleTime => "Single time",
            PlayMode::RepeatWhileHeld => "Repeat while held",
            PlayMode::ToggleRepeat => "Toggle repeat",
        }
    }

    pub fn from_index(index: i32) -> Self {
        match index {
            0 => PlayMode::SingleTime,
            1 => PlayMode::RepeatWhileHeld,
            2 => PlayMode::ToggleRepeat,
            _ => PlayMode::SingleTime,
        }
    }

    pub fn to_index(&self) -> i32 {
        *self as i32
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Macro {
    #[serde(default = "generate_id")]
    pub id: String,
    pub name: String,
    pub bind_key: Option<u32>,
    #[serde(default = "default_true")]
    pub is_enabled: bool,
    #[serde(default)]
    pub play_mode: PlayMode,
    #[serde(default)]
    pub repeat_delay_ms: u32,
    #[serde(default)]
    pub events: Vec<KeyEvent>,
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

fn default_true() -> bool {
    true
}

impl Macro {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: generate_id(),
            name: name.into(),
            bind_key: None,
            is_enabled: true,
            play_mode: PlayMode::SingleTime,
            repeat_delay_ms: 0,
            events: Vec::new(),
        }
    }

    pub fn bind_key_display(&self) -> String {
        match self.bind_key {
            Some(vk) => vk_to_string(vk),
            None => "".to_string(),
        }
    }

    pub fn total_duration_ms(&self) -> f64 {
        self.events
            .iter()
            .filter(|e| e.enabled)
            .map(|e| e.delay_ms)
            .sum()
    }
}
