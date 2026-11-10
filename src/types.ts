export interface KeyEvent {
  vk: number;
  down: boolean;
  delay_ms: number;
  enabled: boolean;
}

export type PlayMode = 'SingleTime' | 'RepeatWhileHeld' | 'ToggleRepeat';

export interface Macro {
  id: string;
  name: string;
  bind_key: number | null;
  play_mode: PlayMode;
  repeat_delay_ms: number;
  is_enabled: boolean;
  events: KeyEvent[];
}

export interface Profile {
  id: string;
  name: string;
  macros: Macro[];
}

export interface AppConfig {
  active_profile_id: string;
  profiles: Profile[];
  global_pause_vk: number | null;
  process_filter: string;
  process_filter_enabled: boolean;
}

export interface EngineStatus {
  is_playing: boolean;
  is_recording: boolean;
  is_paused: boolean;
}
