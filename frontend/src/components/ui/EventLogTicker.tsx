import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Terminal, ChevronUp, ChevronDown, Radio, Activity } from 'lucide-react';

export const EventLogTicker: React.FC = () => {
  const events = useStore((state) => state.events);
  const [isExpanded, setIsExpanded] = useState(false);

  const latestEvent = events[0] || {
    type: 'system.idle',
    source: 'AgentForge Core',
    message: 'All AI agent services operational and listening on Kafka event bus.',
    timestamp: new Date().toISOString(),
  };

  const getEventBadge = (type: string) => {
    if (type.startsWith('incident')) {
      return <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 text-[9px] font-mono font-bold">INCIDENT</span>;
    }
    if (type.startsWith('agent.task.completed')) {
      return <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[9px] font-mono font-bold">SUCCESS</span>;
    }
    if (type.startsWith('agent.task.started')) {
      return <span className="px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800 text-[9px] font-mono font-bold">ACTIVE</span>;
    }
    if (type.startsWith('approval')) {
      return <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[9px] font-mono font-bold">GATE</span>;
    }
    return <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700 text-[9px] font-mono">EVENT</span>;
  };

  return (
    <div className="bg-slate-100/95 dark:bg-cyber-900/95 border-t border-slate-200 dark:border-cyber-700/80 select-none z-30 transition-all duration-300">
      {/* Collapsed Bar / Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-8 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-200/60 dark:hover:bg-cyber-800/60 transition-colors"
      >
        <div className="flex items-center gap-3 overflow-hidden text-xs">
          <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyber-accent font-mono shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
            <span className="font-bold">LIVE EVENT STREAM:</span>
          </div>

          <div className="flex items-center gap-2 truncate">
            {getEventBadge(latestEvent.type)}
            <span className="text-slate-500 dark:text-slate-400 font-mono shrink-0">[{latestEvent.source}]</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono truncate">{latestEvent.message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0">
          <span className="text-[11px] font-mono">{events.length} events logged</span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Logs Table */}
      {isExpanded && (
        <div className="h-56 overflow-y-auto p-3 bg-white/95 dark:bg-black/90 border-t border-slate-200 dark:border-cyber-800 font-mono text-xs space-y-1.5">
          {events.map((evt, idx) => (
            <div key={evt.id || idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-900/60 p-1 rounded">
              <span className="text-slate-400 dark:text-slate-500 shrink-0 text-[11px]">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              <div className="shrink-0">{getEventBadge(evt.type)}</div>
              <span className="text-cyan-700 dark:text-cyber-accent shrink-0 font-medium">{evt.source}:</span>
              <span className="text-slate-800 dark:text-slate-200">{evt.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
