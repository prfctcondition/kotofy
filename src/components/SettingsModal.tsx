import React, { useState, useEffect } from 'react';
import { X, Cpu, Upload, Monitor, Keyboard, Shield } from 'lucide-react';
import { AppConfig } from '../types';
import { api } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onUpdateConfig: (updated: Partial<AppConfig>) => void;
  onImportFile: () => void;
  onAutoScanAppData: () => void;
  keyNames: Record<number, string>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onImportFile,
  onAutoScanAppData,
  keyNames,
}) => {
  const [filterInput, setFilterInput] = useState(config.process_filter || '');
  const [filterEnabled, setFilterEnabled] = useState(config.process_filter_enabled);
  const [pauseVk, setPauseVk] = useState<number | null>(config.global_pause_vk || 0x7B);
  const [isCapturingPauseKey, setIsCapturingPauseKey] = useState(false);
  const [localKeyNames, setLocalKeyNames] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  // Sync inputs with incoming config whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setFilterInput(config.process_filter || '');
      setFilterEnabled(config.process_filter_enabled ?? false);
      setPauseVk(config.global_pause_vk ?? 0x7B);
    }
  }, [isOpen, config.process_filter, config.process_filter_enabled, config.global_pause_vk]);

  // Dual-mode capture: DOM listener when focused + OS hook in background
  useEffect(() => {
    if (!isCapturingPauseKey) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const vk = e.keyCode || e.which;
      if (vk && vk > 0) {
        setPauseVk(vk);
        setIsCapturingPauseKey(false);
        const name = await api.getKeyName(vk);
        setLocalKeyNames((prev) => ({ ...prev, [vk]: name }));
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isCapturingPauseKey]);

  if (!isOpen) return null;

  const currentPauseKeyName = pauseVk
    ? localKeyNames[pauseVk] || keyNames[pauseVk] || (pauseVk === 0x7B ? 'F12' : `0x${pauseVk.toString(16).toUpperCase()}`)
    : 'None';

  const handleCapturePauseKey = async () => {
    if (isCapturingPauseKey) return;
    setIsCapturingPauseKey(true);
    try {
      const captured = await api.captureKey();
      if (captured && captured > 0) {
        setPauseVk(captured);
        const name = await api.getKeyName(captured);
        setLocalKeyNames((prev) => ({ ...prev, [captured]: name }));
      }
    } finally {
      setIsCapturingPauseKey(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      process_filter: filterInput.trim(),
      process_filter_enabled: filterEnabled,
      global_pause_vk: pauseVk,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-lg rounded-2xl liquid-glass-panel shadow-2xl p-6 relative flex flex-col gap-5 border border-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#142347]" />
            <h2 className="text-base font-bold font-display text-[#142347]">Engine Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center liquid-glass-pill hover:bg-black/5 text-[#142347]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Global Pause Hotkey Configuration */}
          <div className="space-y-1.5 p-3 rounded-xl liquid-glass-panel-subtle">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#142347] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Global Pause Hotkey</span>
              </label>
              <button
                type="button"
                onClick={handleCapturePauseKey}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                  isCapturingPauseKey
                    ? 'bg-amber-500 text-white animate-bounce'
                    : 'bg-[#142347]/10 border-[#142347]/20 text-[#142347] hover:bg-[#142347]/20'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>{isCapturingPauseKey ? 'Press Any Key...' : `Key: ${currentPauseKeyName}`}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#5A6B87]">
              Press this key anywhere in Windows to toggle all macros between Active and Paused. Default is F12.
            </p>
          </div>

          {/* Process Filter */}
          <div className="space-y-2 p-3 rounded-xl liquid-glass-panel-subtle">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#142347] flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                <span>Process Filter (Optional)</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#5A6B87] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterEnabled}
                  onChange={(e) => setFilterEnabled(e.target.checked)}
                  className="rounded text-[#142347]"
                />
                <span>Enable Filter</span>
              </label>
            </div>
            <p className="text-[11px] text-[#5A6B87]">
              Leave empty or disabled to allow macros in all windows globally.
            </p>
            <input
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder="e.g. game.exe (or leave empty)"
              className="w-full h-8 px-3 text-xs rounded-lg liquid-glass-panel focus:outline-none font-mono text-[#142347]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onImportFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold liquid-glass-pill hover:liquid-glass-highlight text-[#142347]"
                title="Select .zmacro or .zprofile files from your computer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import from File...</span>
              </button>

              <button
                type="button"
                onClick={onAutoScanAppData}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium liquid-glass-panel-subtle hover:liquid-glass-panel text-[#5A6B87]"
                title="Scan %LOCALAPPDATA%\ZenZakura for existing profiles"
              >
                <span>Auto-Scan AppData</span>
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-bold liquid-glass-pill-active"
            >
              {saved ? 'Saved ✓' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
