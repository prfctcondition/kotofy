import React from 'react';
import { 
  ArrowDown, ArrowUp, CheckSquare, Square, Trash2, 
  ChevronUp, ChevronDown, Clock, Zap 
} from 'lucide-react';
import { KeyEvent } from '../types';

interface EventsTableProps {
  events: KeyEvent[];
  onUpdateEvent: (index: number, updated: Partial<KeyEvent>) => void;
  onDeleteEvent: (index: number) => void;
  onMoveEvent: (index: number, direction: 'up' | 'down') => void;
  keyNames: Record<number, string>;
  isRecording?: boolean;
}

export const EventsTable: React.FC<EventsTableProps> = ({
  events,
  onUpdateEvent,
  onDeleteEvent,
  onMoveEvent,
  keyNames,
  isRecording,
}) => {
  if (events.length === 0) {
    if (isRecording) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl liquid-glass-panel border-2 border-dashed border-red-500/40 bg-red-500/[0.03]">
          <div className="w-5 h-5 rounded-full bg-red-500 animate-ping mb-3" />
          <span className="text-sm font-bold text-red-600">Recording in Progress...</span>
          <span className="text-xs mt-1 text-[#142347] font-medium">
            Press any keys on your keyboard now (they will appear here instantly)
          </span>
          <span className="text-[11px] mt-1 text-[#5A6B87]">
            Click "Stop Recording" in the header when finished
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl liquid-glass-panel-subtle text-[#5A6B87]">
        <Zap className="w-8 h-8 mb-2 opacity-30 text-[#142347]" />
        <span className="text-xs font-bold text-[#142347]">No events recorded</span>
        <span className="text-[11px] mt-1 opacity-70">
          Click <b>+ Add Key</b> or <b>● Record</b> to capture keystrokes
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl liquid-glass-panel overflow-hidden shadow-xs flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-xs select-none">
          <thead className="sticky top-0 bg-[#E8EEF5] backdrop-blur-md z-10 shadow-2xs">
            <tr className="border-b border-black/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#5A6B87]">
              <th className="py-2.5 px-4 w-12 text-center">#</th>
              <th className="py-2.5 px-4">Key</th>
              <th className="py-2.5 px-4">Action</th>
              <th className="py-2.5 px-4">Delay (ms)</th>
              <th className="py-2.5 px-4 text-center">Enabled</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/[0.04]">
            {events.map((evt, idx) => {
              const keyLabel = keyNames[evt.vk] || (evt.vk > 0 ? `0x${evt.vk.toString(16).toUpperCase()}` : 'Key');
              const isDown = evt.down;

              return (
                <tr
                  key={idx}
                  className={`group transition-colors ${
                    evt.enabled
                      ? 'hover:bg-[#142347]/[0.03]'
                      : 'opacity-40 hover:opacity-70 bg-black/[0.01]'
                  }`}
                >
                  {/* # Index */}
                  <td className="py-2 px-4 text-center font-mono text-[#5A6B87] font-semibold">
                    {idx + 1}
                  </td>

                  {/* Key Label: Single clean keycap badge */}
                  <td className="py-2 px-4">
                    <div className="inline-flex items-center justify-center min-w-7 h-7 px-2.5 rounded-lg font-mono font-bold text-xs bg-[#142347]/8 border border-[#142347]/20 text-[#142347] shadow-2xs">
                      {keyLabel}
                    </div>
                  </td>

                  {/* Direction Switch */}
                  <td className="py-2 px-4">
                    <button
                      type="button"
                      onClick={() => onUpdateEvent(idx, { down: !isDown })}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                        isDown
                          ? 'bg-[#142347]/10 border-[#142347]/30 text-[#142347]'
                          : 'bg-black/5 border-black/10 text-[#5A6B87]'
                      }`}
                    >
                      {isDown ? (
                        <>
                          <ArrowDown className="w-3 h-3 text-[#142347]" />
                          <span>KeyDown (↓)</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="w-3 h-3 text-[#5A6B87]" />
                          <span>KeyUp (↑)</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Delay Input */}
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center liquid-glass-panel-subtle px-2 py-0.5 rounded-md border border-black/[0.06]">
                        <Clock className="w-3 h-3 text-[#5A6B87]/60 mr-1" />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={evt.delay_ms}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onUpdateEvent(idx, { delay_ms: isNaN(val) ? 0 : Math.max(0, val) });
                          }}
                          className="w-12 font-mono font-bold bg-transparent focus:outline-none text-xs text-[#142347]"
                        />
                        <span className="text-[10px] text-[#5A6B87] font-mono">ms</span>
                      </div>
                    </div>
                  </td>

                  {/* Enabled Toggle */}
                  <td className="py-2 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onUpdateEvent(idx, { enabled: !evt.enabled })}
                      className="text-[#5A6B87] hover:text-[#142347] transition-colors"
                    >
                      {evt.enabled ? (
                        <CheckSquare className="w-4 h-4 text-[#142347]" />
                      ) : (
                        <Square className="w-4 h-4 opacity-50" />
                      )}
                    </button>
                  </td>

                  {/* Actions (Reorder + Delete) */}
                  <td className="py-2 px-4 text-right">
                    <div className="inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        disabled={idx === 0}
                        onClick={() => onMoveEvent(idx, 'up')}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/10 disabled:opacity-20 text-[#142347]"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === events.length - 1}
                        onClick={() => onMoveEvent(idx, 'down')}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/10 disabled:opacity-20 text-[#142347]"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteEvent(idx)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-50 hover:text-red-600 text-[#5A6B87] ml-1"
                        title="Delete Step"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
