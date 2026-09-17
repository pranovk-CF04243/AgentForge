import React from 'react';
import { useStore } from '../../store/useStore';
import { AlertOctagon, CheckCircle, ShieldAlert, Cpu, Wrench } from 'lucide-react';

export const IncidentWarRoom: React.FC = () => {
  const incidents = useStore((state) => state.incidents);
  const resolveIncident = useStore((state) => state.resolveIncident);
  const agents = useStore((state) => state.agents);
  const selectAgent = useStore((state) => state.selectAgent);

  const activeIncidents = Object.values(incidents);
  if (activeIncidents.length === 0) return null;

  const currentInc = activeIncidents[0];
  const assignedSre = currentInc.assignedSre ? agents[currentInc.assignedSre] : null;

  return (
    <div className="bg-rose-700 dark:bg-rose-950/90 border-b border-rose-600 dark:border-rose-600/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white backdrop-blur-md z-20 animate-in slide-in-from-top duration-300 shadow-md">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-rose-800 dark:bg-rose-900 border border-rose-400 dark:border-rose-500 text-rose-100 dark:text-rose-200 animate-pulse">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-900/80 dark:bg-rose-800 text-white font-mono text-[10px] font-bold">
              {currentInc.severity}
            </span>
            <span className="font-bold text-sm font-mono tracking-wide">{currentInc.title}</span>
          </div>
          <p className="text-xs text-rose-100 dark:text-rose-200 mt-0.5 font-sans max-w-2xl">
            {currentInc.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {assignedSre && (
          <button
            onClick={() => selectAgent(assignedSre.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-800/80 dark:bg-rose-900/60 border border-rose-500/60 dark:border-rose-700/60 text-xs font-mono hover:bg-rose-800 dark:hover:bg-rose-900 transition-colors text-white"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-300 dark:text-cyber-accent" />
            <span>Assigned SRE: <strong className="text-white">{assignedSre.name}</strong></span>
          </button>
        )}

        <button
          onClick={() => resolveIncident(currentInc.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono transition-colors shadow-lg"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Execute Automated Remediation</span>
        </button>
      </div>
    </div>
  );
};
