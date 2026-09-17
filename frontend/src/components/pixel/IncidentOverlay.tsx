import React from 'react';
import { useStore } from '../../store/useStore';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export const IncidentOverlay: React.FC = () => {
  const incidents = useStore((state) => state.incidents);
  const activeIncidentList = Object.values(incidents);
  const hasIncident = activeIncidentList.length > 0;

  if (!hasIncident) return null;

  const currentInc = activeIncidentList[0];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between overflow-hidden">
      {/* 1. Flashing Red Border Vignette */}
      <div className="absolute inset-0 border-4 border-rose-500/80 shadow-[inset_0_0_80px_rgba(244,63,94,0.35)] animate-pulse" />

      {/* 2. Top Emergency Banner */}
      <div className="relative z-30 flex items-center justify-between px-6 py-2 bg-rose-950/90 border-b border-rose-600/80 backdrop-blur-md shadow-lg text-rose-100">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-rose-600 rounded animate-bounce">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white rounded">
                {currentInc.severity}
              </span>
              <span className="text-sm font-bold tracking-tight text-white font-mono">
                {currentInc.title}
              </span>
            </div>
            <p className="text-xs text-rose-200/80 truncate max-w-xl">
              {currentInc.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-rose-300">
          <ShieldAlert className="w-4 h-4 animate-spin text-rose-400" />
          <span>SRE Commander Dispatched to War Room</span>
        </div>
      </div>
    </div>
  );
};
