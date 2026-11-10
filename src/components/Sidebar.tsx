import React, { useState } from 'react';
import { 
  FolderGit2, Plus, Upload, CheckSquare, Square, 
  Zap, Keyboard, Trash2, Settings as SettingsIcon 
} from 'lucide-react';
import { Profile, Macro } from '../types';

interface SidebarProps {
  profiles: Profile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: (name: string) => void;
  onDeleteProfile: (id: string) => void;
  selectedMacroId: string | null;
  onSelectMacro: (id: string) => void;
  onAddMacro: () => void;
  onToggleMacroEnabled: (macroId: string, enabled: boolean) => void;
  onImportLegacy: () => void;
  keyNames: Record<number, string>;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onDeleteProfile,
  selectedMacroId,
  onSelectMacro,
  onAddMacro,
  onToggleMacroEnabled,
  onImportLegacy,
  keyNames,
  onOpenSettings,
}) => {
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const currentProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const macros = currentProfile?.macros || [];

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProfileName.trim()) {
      onAddProfile(newProfileName.trim());
      setNewProfileName('');
      setIsAddingProfile(false);
    }
  };

  return (
    <aside className="w-68 flex flex-col h-full border-r border-black/[0.06] p-3 gap-3 select-none bg-white/30 backdrop-blur-md">
      {/* Profiles Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#142347]">
          <FolderGit2 className="w-4 h-4 text-[#142347]" />
          <span>Profiles</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onImportLegacy}
            className="w-7 h-7 rounded-full flex items-center justify-center liquid-glass-pill hover:liquid-glass-highlight text-[#142347] transition-all"
            title="Import legacy .zmacro files"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsAddingProfile(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center liquid-glass-pill hover:liquid-glass-highlight text-[#142347] transition-all"
            title="Add Profile"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Profiles Pill Chips - wrapped and scrollable so all profiles are visible */}
      <div 
        onWheel={(e) => {
          if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="flex flex-wrap items-center gap-1.5 py-1 max-h-28 overflow-y-auto pr-0.5"
      >
        {profiles.map((prof) => {
          const isActive = prof.id === activeProfileId;
          return (
            <div
              key={prof.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all ${
                isActive
                  ? 'liquid-glass-pill-active font-semibold shadow-xs'
                  : 'liquid-glass-panel-subtle text-[#5A6B87] hover:text-[#142347]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectProfile(prof.id)}
                className="focus:outline-none"
              >
                {prof.name}
              </button>
              {profiles.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProfile(prof.id);
                  }}
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] transition-colors ${
                    isActive
                      ? 'hover:bg-white/20 text-white/70 hover:text-white'
                      : 'hover:bg-red-500 hover:text-white text-[#5A6B87]/60'
                  }`}
                  title={`Delete profile ${prof.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* New Profile Inline Input */}
      {isAddingProfile && (
        <form onSubmit={handleCreateProfile} className="flex items-center gap-1.5 px-1">
          <input
            type="text"
            autoFocus
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profile name..."
            className="flex-1 h-7 text-xs px-2.5 rounded-lg liquid-glass-panel focus:outline-none text-[#142347]"
          />
          <button
            type="submit"
            className="h-7 px-2.5 text-xs font-semibold rounded-lg liquid-glass-pill-active"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setIsAddingProfile(false)}
            className="h-7 px-2 text-xs rounded-lg liquid-glass-pill text-[#5A6B87]"
          >
            ✕
          </button>
        </form>
      )}

      {/* Macros Section Header */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A6B87]">
          Macros ({macros.length})
        </span>
        <button
          onClick={onAddMacro}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold liquid-glass-pill-active transition-all active:scale-95"
        >
          <Plus className="w-3 h-3" />
          <span>New Macro</span>
        </button>
      </div>

      {/* Macros List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {macros.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center px-4 rounded-xl liquid-glass-panel-subtle text-[#5A6B87]">
            <Zap className="w-6 h-6 mb-2 opacity-30 text-[#142347]" />
            <span className="text-xs font-semibold">No macros in profile</span>
            <span className="text-[11px] mt-1 opacity-70">Click + New Macro to add one</span>
          </div>
        ) : (
          macros.map((macro) => {
            const isSelected = macro.id === selectedMacroId;
            const hotkeyLabel = macro.bind_key ? (keyNames[macro.bind_key] || `0x${macro.bind_key.toString(16).toUpperCase()}`) : 'None';

            return (
              <div
                key={macro.id}
                onClick={() => onSelectMacro(macro.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'liquid-glass-highlight shadow-xs border-[#142347]/20 border'
                    : 'liquid-glass-panel-subtle hover:liquid-glass-panel'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMacroEnabled(macro.id, !macro.is_enabled);
                    }}
                    className="text-[#5A6B87] hover:text-[#142347] transition-colors"
                  >
                    {macro.is_enabled ? (
                      <CheckSquare className="w-4 h-4 text-[#142347]" />
                    ) : (
                      <Square className="w-4 h-4 opacity-50" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-[#142347]">
                      {macro.name}
                    </p>
                    <p className="text-[10px] text-[#5A6B87] truncate">
                      {macro.events.length} steps · {macro.play_mode === 'SingleTime' ? 'Single' : 'Repeat'}
                    </p>
                  </div>
                </div>

                {/* Hotkey Badge */}
                <div className="shrink-0 pl-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                    macro.bind_key
                      ? 'bg-[#142347]/8 border-[#142347]/20 text-[#142347]'
                      : 'bg-black/5 border-transparent text-[#5A6B87]'
                  }`}>
                    {hotkeyLabel}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer: Settings trigger */}
      <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between px-1">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#5A6B87] hover:text-[#142347] transition-colors"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>Engine Settings</span>
        </button>
        <span className="text-[10px] font-mono text-[#5A6B87]/60">v0.1.0</span>
      </div>
    </aside>
  );
};
