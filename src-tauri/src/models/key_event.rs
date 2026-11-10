use serde::{Deserialize, Serialize};
use super::vk::vk_to_string;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KeyEvent {
    pub vk: u32,
    pub down: bool,
    pub delay_ms: f64,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

impl KeyEvent {
    pub fn new(vk: u32, down: bool, delay_ms: f64) -> Self {
        Self {
            vk,
            down,
            delay_ms,
            enabled: true,
        }
    }

    pub fn key_display(&self) -> String {
        vk_to_string(self.vk)
    }
}
