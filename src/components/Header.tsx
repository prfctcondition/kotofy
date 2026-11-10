import React from 'react';
import { Minus, Square, X, Search } from 'lucide-react';
import { api } from '../api';
import logoImg from '../assets/logo.png';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  pauseKeyName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  isPaused,
  onTogglePause,
  pauseKeyName = 'F12',
}) => {
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Left-click on header background or non-interactive elements starts native window dragging
    if (e.button === 0 && !(e.target as HTMLElement).closest('button, input, a')) {
      api.startDragging();
    }
  };

  return (
    <header 
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="h-13 flex items-center justify-between px-4 select-none relative z-50 border-b border-black/[0.06] backdrop-blur-xl bg-white/40 cursor-grab active:cursor-grabbing"
    >
      {/* Left: Brand Capsule with new Koto Kana Logo */}
      <div 
        data-tauri-drag-region 
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="flex items-center gap-3 cursor-grab active:cursor-grabbing"
      >
        <div 
          data-tauri-drag-region
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-pill shadow-xs"
        >
          <div className="w-5 h-5 rounded-md overflow-hidden shadow-xs ring-1 ring-black/5 flex items-center justify-center bg-[#1C3061] flex-shrink-0">
            <img src={logoImg} alt="Kotofy" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm tracking-tight font-display text-[#142347]">
            Kotofy
          </span>
        </div>
      </div>

      {/* Center: Search Capsule */}
      <div 
        data-tauri-drag-region 
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="flex-1 max-w-md mx-6 cursor-grab active:cursor-grabbing"
      >
        <div 
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="relative flex items-center w-full cursor-default"
        >
          <Search className="w-4 h-4 absolute left-3.5 text-[#5A6B87]/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search macros, hotkeys..."
            className="w-full h-8 pl-9 pr-4 text-xs rounded-full liquid-glass-panel-subtle focus:liquid-glass-highlight focus:outline-none placeholder:text-[#5A6B87]/50 text-[#142347] transition-all"
          />
        </div>
      </div>

      {/* Right: Global Pause Status Pill + Window Controls */}
      <div 
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-3"
      >
        {/* Single F12 Pause Status Pill */}
        <button
          type="button"
          onClick={onTogglePause}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
            isPaused
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 shadow-xs'
              : 'liquid-glass-pill-active'
          }`}
          title={`Click or press ${pauseKeyName} anywhere to toggle macro engine`}
        >
          <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-600' : 'bg-emerald-400 animate-pulse'}`} />
          <span>{isPaused ? 'Paused' : 'Active'}</span>
          <span className="text-[10px] opacity-70 font-mono">({pauseKeyName})</span>
        </button>

        {/* Native Window Controls */}
        <div className="flex items-center gap-1 border-l border-black/[0.06] pl-2">
          <button
            type="button"
            onClick={() => api.minimizeWindow()}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/8 text-[#142347] transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => api.toggleMaximizeWindow()}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/8 text-[#142347] transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => api.closeWindow()}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500 hover:text-white text-[#142347] transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
