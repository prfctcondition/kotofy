import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MacroHeader } from './components/MacroHeader';
import { EventsTable } from './components/EventsTable';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api';
import { AppConfig, Macro, KeyEvent } from './types';

export function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [isListeningKey, setIsListeningKey] = useState(false);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [keyNames, setKeyNames] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial load
  useEffect(() => {
    api.getConfig().then(async (cfg) => {
      // If user has existing ZenZakura profiles in LocalAppData, auto-import them
      const hasRealMacros = cfg.profiles.some((p) => p.macros.length > 0 && p.name !== 'Default');
      if (!hasRealMacros) {
        try {
          const autoImported = await api.importLegacyMacros();
          if (autoImported.profiles.some((p) => p.macros.length > 0)) {
            cfg = autoImported;
          }
        } catch {
          // ignore
        }
      }
      setConfig(cfg);
      const activeProf = cfg.profiles.find((p) => p.id === cfg.active_profile_id) || cfg.profiles[0];
      if (activeProf && activeProf.macros.length > 0) {
        setSelectedMacroId(activeProf.macros[0].id);
      }
    });

    api.getIsPaused().then((p) => setIsPaused(p));
  }, []);

  // Listen for real-time pause change events from global hotkey or backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<boolean>('engine-pause-changed', (event) => {
      setIsPaused(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Poll only pause status infrequently (once per second) to sync F12 toggles from other windows
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const p = await api.getIsPaused();
        setIsPaused(p);
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch human key names
  const resolveKeyName = useCallback(async (vk: number | null) => {
    if (!vk || vk === 0) return 'None';
    if (keyNames[vk]) return keyNames[vk];
    const name = await api.getKeyName(vk);
    setKeyNames((prev) => ({ ...prev, [vk]: name }));
    return name;
  }, [keyNames]);

  // Preload key names when config changes
  useEffect(() => {
    if (!config) return;
    if (config.global_pause_vk) resolveKeyName(config.global_pause_vk);
    config.profiles.forEach((p) => {
      p.macros.forEach((m) => {
        if (m.bind_key) resolveKeyName(m.bind_key);
        m.events.forEach((ev) => resolveKeyName(ev.vk));
      });
    });
  }, [config]);

  const currentProfile = config ? (config.profiles.find((p) => p.id === config.active_profile_id) || config.profiles[0]) : null;
  const allMacros = currentProfile?.macros || [];

  const filteredMacros = searchQuery.trim()
    ? allMacros.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.bind_key && (keyNames[m.bind_key] || '').toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allMacros;

  const currentMacro = allMacros.find((m) => m.id === selectedMacroId) || filteredMacros[0] || null;
  const currentMacroIndex = currentMacro ? allMacros.findIndex((m) => m.id === currentMacro.id) : -1;

  // Save config helper (Deadlock free!)
  const saveAndSync = (newConfig: AppConfig) => {
    setConfig(newConfig);
    api.saveConfig(newConfig).catch(console.error);
  };

  // Profiles operations
  const handleSelectProfile = (id: string) => {
    if (!config) return;
    const newCfg: AppConfig = { ...config, active_profile_id: id };
    saveAndSync(newCfg);
    const prof = config.profiles.find((p) => p.id === id);
    if (prof && prof.macros.length > 0) {
      setSelectedMacroId(prof.macros[0].id);
    } else {
      setSelectedMacroId(null);
    }
  };

  const handleAddProfile = (name: string) => {
    if (!config) return;
    const newProf = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      macros: [],
    };
    const newCfg: AppConfig = {
      ...config,
      profiles: [...config.profiles, newProf],
      active_profile_id: newProf.id,
    };
    saveAndSync(newCfg);
    setSelectedMacroId(null);
  };

  const handleDeleteProfile = (id: string) => {
    if (!config || config.profiles.length <= 1) return;
    const remaining = config.profiles.filter((p) => p.id !== id);
    const newActiveId = remaining[0].id;
    const newCfg: AppConfig = {
      ...config,
      profiles: remaining,
      active_profile_id: newActiveId,
    };
    saveAndSync(newCfg);
    setSelectedMacroId(remaining[0].macros[0]?.id || null);
  };

  // Macro operations
  const handleAddMacro = () => {
    if (!config || !currentProfile) return;
    const newMacro: Macro = {
      id: 'm_' + Date.now(),
      name: `macro_${allMacros.length + 1}`,
      bind_key: null,
      play_mode: 'SingleTime',
      repeat_delay_ms: 0,
      is_enabled: true,
      events: [
        { vk: 0x45, down: true, delay_ms: 2.0, enabled: true },
        { vk: 0x45, down: false, delay_ms: 2.0, enabled: true },
      ],
    };

    const updatedProfiles = config.profiles.map((p) => {
      if (p.id === currentProfile.id) {
        return { ...p, macros: [...p.macros, newMacro] };
      }
      return p;
    });

    saveAndSync({ ...config, profiles: updatedProfiles });
    setSelectedMacroId(newMacro.id);
  };

  const handleUpdateMacro = (updated: Partial<Macro>) => {
    if (!config || !currentMacro || !currentProfile) return;
    const updatedProfiles = config.profiles.map((p) => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          macros: p.macros.map((m) => (m.id === currentMacro.id ? { ...m, ...updated } : m)),
        };
      }
      return p;
    });
    saveAndSync({ ...config, profiles: updatedProfiles });
  };

  const handleDeleteMacro = () => {
    if (!config || !currentMacro || !currentProfile) return;
    const updatedProfiles = config.profiles.map((p) => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          macros: p.macros.filter((m) => m.id !== currentMacro.id),
        };
      }
      return p;
    });
    const remaining = currentProfile.macros.filter((m) => m.id !== currentMacro.id);
    saveAndSync({ ...config, profiles: updatedProfiles });
    setSelectedMacroId(remaining.length > 0 ? remaining[0].id : null);
  };

  const handleToggleMacroEnabled = (macroId: string, enabled: boolean) => {
    if (!config || !currentProfile) return;
    const updatedProfiles = config.profiles.map((p) => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          macros: p.macros.map((m) => (m.id === macroId ? { ...m, is_enabled: enabled } : m)),
        };
      }
      return p;
    });
    saveAndSync({ ...config, profiles: updatedProfiles });
  };

  // Events within macro
  const handleUpdateEvent = (idx: number, updated: Partial<KeyEvent>) => {
    if (!currentMacro) return;
    const newEvents = currentMacro.events.map((ev, i) => (i === idx ? { ...ev, ...updated } : ev));
    handleUpdateMacro({ events: newEvents });
  };

  const handleDeleteEvent = (idx: number) => {
    if (!currentMacro) return;
    const newEvents = currentMacro.events.filter((_, i) => i !== idx);
    handleUpdateMacro({ events: newEvents });
  };

  const handleMoveEvent = (idx: number, direction: 'up' | 'down') => {
    if (!currentMacro) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentMacro.events.length) return;
    const newEvents = [...currentMacro.events];
    const temp = newEvents[idx];
    newEvents[idx] = newEvents[targetIdx];
    newEvents[targetIdx] = temp;
    handleUpdateMacro({ events: newEvents });
  };

  // Current macro reference to eliminate stale closures in all async and live handlers
  const currentMacroRef = useRef<Macro | null>(null);
  currentMacroRef.current = currentMacro;

  const selectedMacroIdRef = useRef(selectedMacroId);
  useEffect(() => {
    selectedMacroIdRef.current = selectedMacroId;
  }, [selectedMacroId]);

  // Fast deduplication map to allow dual-mode (DOM + Hook) without duplicate events
  const recordedHistoryRef = useRef<Map<string, number>>(new Map());

  const appendLiveRecordEvent = useCallback((newEvt: KeyEvent) => {
    resolveKeyName(newEvt.vk);
    const targetMacroId = currentMacroRef.current?.id || selectedMacroIdRef.current;
    if (!targetMacroId) return;

    // Deduplication check: ignore identical (vk, down) state within 80ms
    const dedupeKey = `${newEvt.vk}_${newEvt.down ? 1 : 0}`;
    const now = performance.now();
    const lastTime = recordedHistoryRef.current.get(dedupeKey);
    if (lastTime && (now - lastTime) < 80) {
      return;
    }
    recordedHistoryRef.current.set(dedupeKey, now);

    setConfig((prev) => {
      if (!prev) return prev;
      const updatedProfiles = prev.profiles.map((p) => {
        if (p.id === prev.active_profile_id) {
          const updatedMacros = p.macros.map((m) => {
            if (m.id === targetMacroId) {
              return { ...m, events: [...m.events, newEvt] };
            }
            return m;
          });
          return { ...p, macros: updatedMacros };
        }
        return p;
      });
      return { ...prev, profiles: updatedProfiles };
    });
  }, [resolveKeyName]);

  // Dual-mode recording: DOM for in-window keystrokes + global OS hook for games/desktop
  useEffect(() => {
    if (!isRecording) return;

    let lastTime = performance.now();
    let isFirst = true;

    const onKeyDown = (e: KeyboardEvent) => {
      const vk = e.keyCode || e.which;
      if (!vk || e.repeat) return; // Discard auto-repeat events

      e.preventDefault();
      e.stopPropagation();

      const now = performance.now();
      const delay = isFirst ? 2.0 : Math.max(0.5, Math.round((now - lastTime) * 10) / 10);
      isFirst = false;
      lastTime = now;

      appendLiveRecordEvent({
        vk,
        down: true,
        delay_ms: delay,
        enabled: true,
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const vk = e.keyCode || e.which;
      if (!vk) return;

      e.preventDefault();
      e.stopPropagation();

      const now = performance.now();
      const delay = Math.max(0.5, Math.round((now - lastTime) * 10) / 10);
      lastTime = now;

      appendLiveRecordEvent({
        vk,
        down: false,
        delay_ms: delay,
        enabled: true,
      });
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });

    let unlistenFn: (() => void) | undefined;
    listen<KeyEvent>('macro-record-event', (event) => {
      appendLiveRecordEvent(event.payload);
    })
      .then((un) => {
        unlistenFn = un;
      })
      .catch((err) => {
        console.warn('Tauri event listen not active:', err);
      });

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      if (unlistenFn) unlistenFn();
    };
  }, [isRecording, appendLiveRecordEvent]);

  // + Add Key with deduplication guard
  const isAddingKeyHandledRef = useRef(false);
  const handleAddKey = async () => {
    if (!currentMacro || isAddingKey) return;
    setIsAddingKey(true);
    isAddingKeyHandledRef.current = false;
    try {
      const capturedVk = await api.captureKey();
      if (!isAddingKeyHandledRef.current && capturedVk && capturedVk > 0 && currentMacroRef.current) {
        isAddingKeyHandledRef.current = true;
        const newEvents: KeyEvent[] = [
          ...currentMacroRef.current.events,
          { vk: capturedVk, down: true, delay_ms: 2.0, enabled: true },
          { vk: capturedVk, down: false, delay_ms: 2.0, enabled: true },
        ];
        handleUpdateMacro({ events: newEvents });
        resolveKeyName(capturedVk);
      }
    } finally {
      setIsAddingKey(false);
    }
  };

  useEffect(() => {
    if (!isAddingKey) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const vk = e.keyCode || e.which;
      if (!isAddingKeyHandledRef.current && vk && vk > 0 && currentMacroRef.current) {
        isAddingKeyHandledRef.current = true;
        const newEvents: KeyEvent[] = [
          ...currentMacroRef.current.events,
          { vk, down: true, delay_ms: 2.0, enabled: true },
          { vk, down: false, delay_ms: 2.0, enabled: true },
        ];
        handleUpdateMacro({ events: newEvents });
        resolveKeyName(vk);
        setIsAddingKey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isAddingKey]);

  const handleBatchDelayMod = (delayMs: number) => {
    if (!currentMacro) return;
    const newEvents = currentMacro.events.map((ev) => ({ ...ev, delay_ms: delayMs }));
    handleUpdateMacro({ events: newEvents });
  };

  // Hotkey binding capture with deduplication guard
  const isListeningKeyHandledRef = useRef(false);
  const handleStartBindKey = async () => {
    if (isListeningKey) return;
    setIsListeningKey(true);
    isListeningKeyHandledRef.current = false;
    try {
      const capturedVk = await api.captureKey();
      if (!isListeningKeyHandledRef.current && capturedVk && capturedVk > 0 && currentMacroRef.current) {
        isListeningKeyHandledRef.current = true;
        handleUpdateMacro({ bind_key: capturedVk });
        resolveKeyName(capturedVk);
      }
    } finally {
      setIsListeningKey(false);
    }
  };

  useEffect(() => {
    if (!isListeningKey) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const vk = e.keyCode || e.which;
      if (!isListeningKeyHandledRef.current && vk && vk > 0 && currentMacroRef.current) {
        isListeningKeyHandledRef.current = true;
        handleUpdateMacro({ bind_key: vk });
        resolveKeyName(vk);
        setIsListeningKey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isListeningKey]);

  // Recording toggle with immediate clearing & live saving
  const handleToggleRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      const rec = await api.stopRecording();
      const targetMacro = currentMacroRef.current;
      if (targetMacro) {
        // Save the events accumulated live (or from the OS hook if DOM had none)
        const finalEvents = targetMacro.events.length > 0 ? targetMacro.events : rec;
        handleUpdateMacro({ events: finalEvents });
      }
    } else {
      // Blur any active element so Space/Enter never triggers button clicks
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      recordedHistoryRef.current.clear();
      if (currentMacroRef.current) {
        // Clear macro events immediately so new keystrokes stream cleanly
        handleUpdateMacro({ events: [] });
      }
      await api.startRecording();
      setIsRecording(true);
    }
  };

  // Test play
  const handleTestPlay = () => {
    if (currentMacroIndex >= 0) {
      setIsPlaying(true);
      api.testPlayMacro(currentMacroIndex);
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

  const handleStopPlay = () => {
    api.stopPlayback();
    setIsPlaying(false);
  };

  // Toggle Pause (F12)
  const handleTogglePause = async () => {
    const nextPaused = await api.togglePause();
    setIsPaused(nextPaused);
  };

  // Legacy import via Windows Open File Dialog
  const handleImportLegacy = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let latestConfig = config;
    for (let i = 0; i < files.length; i++) {
      try {
        const content = await files[i].text();
        latestConfig = await api.importMacroContent(content);
      } catch (err) {
        console.error('Error importing file:', files[i].name, err);
      }
    }

    if (latestConfig) {
      setConfig(latestConfig);
      const prof = latestConfig.profiles.find((p) => p.id === latestConfig.active_profile_id) || latestConfig.profiles[0];
      if (prof && prof.macros.length > 0) {
        setSelectedMacroId(prof.macros[0].id);
      }
    }

    e.target.value = '';
  };

  const handleAutoScanAppData = async () => {
    const imported = await api.importLegacyMacros();
    setConfig(imported);
    const prof = imported.profiles.find((p) => p.id === imported.active_profile_id) || imported.profiles[0];
    if (prof && prof.macros.length > 0) {
      setSelectedMacroId(prof.macros[0].id);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#E6EDF5] text-[#142347]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#142347] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider font-bold">Loading Kotofy...</span>
        </div>
      </div>
    );
  }

  const currentMacroHotkeyLabel = currentMacro?.bind_key
    ? keyNames[currentMacro.bind_key] || `0x${currentMacro.bind_key.toString(16).toUpperCase()}`
    : 'None';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden relative font-sans bg-[#E6EDF5] text-[#142347]">
      {/* Top Drag Bar & Navigation */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        pauseKeyName={config?.global_pause_vk ? (keyNames[config.global_pause_vk] || (config.global_pause_vk === 123 ? 'F12' : `0x${config.global_pause_vk.toString(16).toUpperCase()}`)) : 'F12'}
      />

      {/* Main 2-Column Content Area */}
      <div className="flex-1 flex min-h-0 relative z-10">
        {/* Left Sidebar: Profiles & Macros list */}
        <Sidebar
          profiles={config.profiles}
          activeProfileId={config.active_profile_id}
          onSelectProfile={handleSelectProfile}
          onAddProfile={handleAddProfile}
          onDeleteProfile={handleDeleteProfile}
          selectedMacroId={selectedMacroId}
          onSelectMacro={setSelectedMacroId}
          onAddMacro={handleAddMacro}
          onToggleMacroEnabled={handleToggleMacroEnabled}
          onImportLegacy={handleImportLegacy}
          keyNames={keyNames}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Central Main Area: Macro Header + Events Table */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 p-4 gap-4 overflow-hidden">
          <div className="shrink-0">
            <MacroHeader
              macro={currentMacro}
              isPlaying={isPlaying}
              isRecording={isRecording}
              isListeningKey={isListeningKey}
              isAddingKey={isAddingKey}
              onTestPlay={handleTestPlay}
              onStopPlay={handleStopPlay}
              onToggleRecord={handleToggleRecord}
              onStartBindKey={handleStartBindKey}
              onAddKey={handleAddKey}
              onUpdateMacro={handleUpdateMacro}
              onDeleteMacro={handleDeleteMacro}
              onBatchDelayMod={handleBatchDelayMod}
              hotkeyLabel={currentMacroHotkeyLabel}
            />
          </div>

          {currentMacro && (
            <div className="flex-1 min-h-0 flex flex-col">
              <EventsTable
                events={currentMacro.events}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onMoveEvent={handleMoveEvent}
                keyNames={keyNames}
                isRecording={isRecording}
              />
            </div>
          )}
        </main>
      </div>

      {/* Hidden File Picker for .zmacro and .zprofile files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zmacro,.zprofile,.json"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Settings Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={(upd) => saveAndSync({ ...config, ...upd })}
        onImportFile={handleImportLegacy}
        onAutoScanAppData={handleAutoScanAppData}
        keyNames={keyNames}
      />
    </div>
  );
}

export default App;
