import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppConfig, EngineStatus, KeyEvent } from './types';

let mockConfig: AppConfig = {
  active_profile_id: 'default',
  profiles: [
    {
      id: 'default',
      name: 'Default',
      macros: [
        {
          id: 'm1',
          name: 'eqr',
          bind_key: 20, // Caps Lock
          play_mode: 'SingleTime',
          repeat_delay_ms: 0,
          is_enabled: true,
          events: [
            { vk: 0x45, down: true, delay_ms: 2.0, enabled: true },
            { vk: 0x45, down: false, delay_ms: 2.0, enabled: true },
            { vk: 0x51, down: true, delay_ms: 2.0, enabled: true },
            { vk: 0x51, down: false, delay_ms: 2.0, enabled: true },
            { vk: 0x52, down: true, delay_ms: 2.0, enabled: true },
            { vk: 0x52, down: false, delay_ms: 2.0, enabled: true },
          ],
        },
        {
          id: 'm2',
          name: 'qn',
          bind_key: 0x51, // Q
          play_mode: 'SingleTime',
          repeat_delay_ms: 0,
          is_enabled: true,
          events: [
            { vk: 0x51, down: true, delay_ms: 2.0, enabled: true },
            { vk: 0x51, down: false, delay_ms: 2.0, enabled: true },
          ],
        },
        {
          id: 'm3',
          name: 'em',
          bind_key: 0x45, // E
          play_mode: 'SingleTime',
          repeat_delay_ms: 0,
          is_enabled: true,
          events: [
            { vk: 0x45, down: true, delay_ms: 2.0, enabled: true },
            { vk: 0x45, down: false, delay_ms: 2.0, enabled: true },
          ],
        },
      ],
    },
    {
      id: 'yasuo',
      name: 'yasuo',
      macros: [],
    },
    {
      id: 'yone',
      name: 'yone',
      macros: [],
    },
  ],
  global_pause_vk: 0x7B, // F12
  process_filter: '',
  process_filter_enabled: false,
};

let mockPaused = false;

export const api = {
  async getConfig(): Promise<AppConfig> {
    if (!isTauri()) return mockConfig;
    return await invoke<AppConfig>('get_config');
  },

  async saveConfig(config: AppConfig): Promise<void> {
    if (!isTauri()) {
      mockConfig = config;
      return;
    }
    await invoke('save_config', { newConfig: config });
  },

  async captureKey(): Promise<number | null> {
    if (!isTauri()) return 0x45;
    return await invoke<number | null>('capture_key');
  },

  async testPlayMacro(macroIdx: number): Promise<void> {
    if (!isTauri()) return;
    await invoke('test_play_macro', { macroIdx });
  },

  async stopPlayback(): Promise<void> {
    if (!isTauri()) return;
    await invoke('stop_playback');
  },

  async startRecording(): Promise<void> {
    if (!isTauri()) return;
    await invoke('start_recording');
  },

  async stopRecording(): Promise<KeyEvent[]> {
    if (!isTauri()) return [];
    return await invoke<KeyEvent[]>('stop_recording');
  },

  async togglePause(): Promise<boolean> {
    if (!isTauri()) {
      mockPaused = !mockPaused;
      return mockPaused;
    }
    return await invoke<boolean>('toggle_pause');
  },

  async getIsPaused(): Promise<boolean> {
    if (!isTauri()) return mockPaused;
    return await invoke<boolean>('get_is_paused');
  },

  async setPaused(paused: boolean): Promise<boolean> {
    if (!isTauri()) {
      mockPaused = paused;
      return mockPaused;
    }
    return await invoke<boolean>('set_paused', { paused });
  },

  async importLegacyMacros(): Promise<AppConfig> {
    if (!isTauri()) return mockConfig;
    return await invoke<AppConfig>('import_legacy_macros');
  },

  async importMacroContent(content: string): Promise<AppConfig> {
    if (!isTauri()) return mockConfig;
    return await invoke<AppConfig>('import_macro_content', { content });
  },

  async getKeyName(vk: number | null): Promise<string> {
    if (!vk || vk === 0) return 'None';
    if (!isTauri()) {
      if (vk === 20) return 'Caps';
      if (vk === 32) return 'Space';
      if (vk >= 0x41 && vk <= 0x5a) return String.fromCharCode(vk);
      return `0x${vk.toString(16).toUpperCase()}`;
    }
    return await invoke<string>('get_key_name', { vk });
  },

  async getEngineStatus(): Promise<EngineStatus> {
    if (!isTauri()) {
      return {
        is_playing: false,
        is_recording: false,
        is_paused: mockPaused,
      };
    }
    return await invoke<EngineStatus>('get_engine_status');
  },

  // Native window control commands (bypasses JS webview permission blocks)
  startDragging() {
    if (isTauri()) {
      getCurrentWindow().startDragging().catch(() => {
        invoke('app_start_dragging').catch(console.error);
      });
    }
  },
  minimizeWindow() {
    if (isTauri()) {
      invoke('app_minimize').catch(console.error);
    }
  },
  toggleMaximizeWindow() {
    if (isTauri()) {
      invoke('app_toggle_maximize').catch(console.error);
    }
  },
  closeWindow() {
    if (isTauri()) {
      invoke('app_close').catch(console.error);
    }
  },
  hideWindow() {
    if (isTauri()) {
      invoke('app_hide').catch(console.error);
    }
  },
};
