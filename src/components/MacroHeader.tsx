import React, { useState, useEffect } from 'react';
import { 
  Play, Square as StopIcon, Circle, Keyboard, Plus, 
  Trash2, Clock, Edit2, Check, Zap 
} from 'lucide-react';
import { Macro, PlayMode } from '../types';

interface MacroHeaderProps {
  macro: Macro | null;
  isPlaying: boolean;
  isRecording: boolean;
  isListeningKey: boolean;
  isAddingKey: boolean;
  onTestPlay: () => void;
  onStopPlay: () => void;
  onToggleRecord: () => void;
  onStartBindKey: () => void;
  onAddKey: () => void;
  onUpdateMacro: (updated: Partial<Macro>) => void;
  onDeleteMacro: () => void;
  onBatchDelayMod: (delayMs: number) => void;
  hotkeyLabel: string;
}

export const MacroHeader: React.FC<MacroHeaderProps> = ({
  macro,
  isPlaying,
  isRecording,
  isListeningKey,
  isAddingKey,
  onTestPlay,
  onStopPlay,
  onToggleRecord,
  onStartBindKey,
  onAddKey,
  onUpdateMacro,
  onDeleteMacro,
  onBatchDelayMod,
  hotkeyLabel,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [batchDelayInput, setBatchDelayInput] = useState('2.0');

  useEffect(() => {
    if (macro) {
      setTempTitle(macro.name);
    }
  }, [macro?.name]);

  if (!macro) {
    return (
      <div className="p-8 rounded-2xl liquid-glass-panel flex flex-col items-center justify-center text-center">
        <Zap className="w-10 h-10 mb-2 text-[#142347] opacity-30" />
        <h3 className="text-sm font-bold text-[#142347]">No macro selected</h3>
        <p className="text-xs text-[#5A6B87] mt-1">Select a macro from the sidebar or click + New Macro</p>
      </div>
    );
  }

  const totalDurationMs = macro.events.reduce((acc, ev) => acc + (ev.enabled ? ev.delay_ms : 0), 0);

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempTitle.trim()) {
      onUpdateMacro({ name: tempTitle.trim() });
      setIsEditingTitle(false);
    }
  };

  const handleApplyBatchDelay = () => {
    const val = parseFloat(batchDelayInput);
    if (!isNaN(val) && val >= 0) {
      onBatchDelayMod(val);
    }
  };

  return (
    <div className="p-5 rounded-2xl liquid-glass-panel flex flex-col gap-4 select-none">
      {/* Top Row: Title, Hotkey Pill, Mode Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Title + Stats */}
        <div className="flex items-center gap-3">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="text-xl font-bold font-display px-2.5 py-0.5 rounded-lg liquid-glass-panel focus:outline-none text-[#142347]"
              />
              <button
                type="submit"
                className="p-1 rounded-lg liquid-glass-pill-active"
              >
                <Check className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <h1 
              onClick={() => setIsEditingTitle(true)}
              className="text-xl md:text-2xl font-bold font-display tracking-tight text-[#142347] hover:opacity-80 cursor-pointer flex items-center gap-2"
              title="Click to rename"
            >
              <span>{macro.name}</span>
              <Edit2 className="w-3.5 h-3.5 text-[#5A6B87]/50 hover:text-[#142347]" />
            </h1>
          )}

          {/* Key bind pill */}
          <button
            onClick={onStartBindKey}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
              isListeningKey
                ? 'bg-amber-500 text-white animate-bounce'
                : 'bg-[#142347]/8 border-[#142347]/20 text-[#142347] hover:bg-[#142347]/15'
            }`}
            title="Click to bind a new hotkey"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{isListeningKey ? 'Press Any Key...' : `Key: ${hotkeyLabel}`}</span>
          </button>

          {/* Quick Stats */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#5A6B87]">
            <span>•</span>
            <span>{macro.events.length} steps</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#5A6B87]/70" />
              {totalDurationMs.toFixed(1)} ms
            </span>
          </div>
        </div>

        {/* Execution Mode Selector */}
        <div className="flex items-center gap-1 p-0.5 rounded-full liquid-glass-panel-subtle">
          {(['SingleTime', 'RepeatWhileHeld', 'ToggleRepeat'] as PlayMode[]).map((mode) => {
            const isActive = macro.play_mode === mode;
            const labels: Record<PlayMode, string> = {
              SingleTime: 'Single time',
              RepeatWhileHeld: 'Repeat on hold',
              ToggleRepeat: 'Toggle repeat',
            };
            return (
              <button
                key={mode}
                onClick={() => onUpdateMacro({ play_mode: mode })}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'liquid-glass-pill-active shadow-xs'
                    : 'text-[#5A6B87] hover:text-[#142347]'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Controls Row */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/[0.06] flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Test Play */}
          {isPlaying ? (
            <button
              onClick={onStopPlay}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all active:scale-95"
            >
              <StopIcon className="w-3.5 h-3.5 fill-current" />
              <span>Stop Playing</span>
            </button>
          ) : (
            <button
              onClick={onTestPlay}
              disabled={macro.events.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs liquid-glass-pill-active hover:opacity-90 shadow-xs transition-all active:scale-95 disabled:opacity-30"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Play</span>
            </button>
          )}

          {/* Record */}
          <button
            type="button"
            onClick={onToggleRecord}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 border ${
              isRecording
                ? 'bg-red-600 border-red-600 text-white animate-pulse shadow-xs'
                : 'liquid-glass-pill hover:liquid-glass-highlight text-[#142347]'
            }`}
          >
            <Circle className={`w-3 h-3 ${isRecording ? 'fill-white' : 'fill-red-500 text-red-500'}`} />
            <span>{isRecording ? `Stop Recording (${macro.events.length})` : 'Record'}</span>
          </button>

          {/* Add Key */}
          <button
            type="button"
            onClick={onAddKey}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            disabled={isAddingKey}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs transition-all active:scale-95 border ${
              isAddingKey
                ? 'bg-amber-500 border-amber-600 text-white animate-pulse shadow-xs'
                : 'liquid-glass-pill hover:liquid-glass-highlight text-[#142347]'
            }`}
          >
            {isAddingKey ? (
              <>
                <Keyboard className="w-3.5 h-3.5 animate-bounce" />
                <span>Press Any Key...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Key</span>
              </>
            )}
          </button>
        </div>

        {/* Batch Delay + Delete */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 liquid-glass-panel-subtle px-2.5 py-1 rounded-full text-xs">
            <span className="text-[#5A6B87] font-medium">Batch delay:</span>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={batchDelayInput}
              onChange={(e) => setBatchDelayInput(e.target.value)}
              className="w-11 text-center font-mono font-bold bg-transparent focus:outline-none text-[#142347]"
            />
            <span className="text-[#5A6B87] text-[10px] font-mono">ms</span>
            <button
              onClick={handleApplyBatchDelay}
              className="ml-1 px-2 py-0.5 rounded-full liquid-glass-pill-active text-[10px] font-bold"
            >
              Apply
            </button>
          </div>

          <button
            onClick={onDeleteMacro}
            className="w-7 h-7 rounded-full flex items-center justify-center liquid-glass-pill hover:bg-red-50 hover:text-red-600 text-[#5A6B87] transition-all"
            title="Delete Macro"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
