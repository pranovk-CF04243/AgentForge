import React from 'react';
import { useStore, ViewMode } from '../../store/useStore';
import { 
  Box,
  Layers, 
  Activity, 
  Columns, 
  AlertTriangle, 
  Users, 
  CheckCircle2,
  Bell,
  Cpu,
  Sun,
  Moon,
  Key
} from 'lucide-react';

export const CommandNavbar: React.FC = () => {
  const isConnected = useStore((state) => state.isConnected);
  const metrics = useStore((state) => state.metrics);
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const incidents = useStore((state) => state.incidents);
  const approvals = useStore((state) => state.approvals);
  const triggerIncident = useStore((state) => state.triggerIncident);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  const activeIncidentsCount = Object.keys(incidents).length;
  const pendingApprovalsCount = Object.values(approvals).filter((a) => a.status === 'PENDING').length;

  const views: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: '3D_OFFICE', label: '3D Office', icon: <Box className="w-3.5 h-3.5" /> },
    { id: 'SPLIT_VIEW', label: 'Command Split', icon: <Columns className="w-3.5 h-3.5" /> },
    { id: 'KANBAN_DAG', label: 'Task DAG', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'APM_INFRA', label: 'Infrastructure', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'SERVICE_ACCOUNTS', label: 'API Keys', icon: <Key className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-13 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0f121a]/95 backdrop-blur-md px-4 py-2 flex items-center justify-between select-none z-30 transition-colors duration-200">
      {/* Brand & Connection State */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white font-sans">AgentForge</span>
              <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                Enterprise
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400">
            {isConnected ? 'Engine Online' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Global Telemetry Metrics */}
      <div className="hidden lg:flex items-center gap-5 font-sans">
        {/* Active Agents */}
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 dark:text-slate-400">Agents:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{metrics.activeAgents}</span>
        </div>

        {/* Tasks Running */}
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-slate-500 dark:text-slate-400">Running:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{metrics.runningTasks}</span>
        </div>

        {/* Token Counter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Tokens:</span>
          <span className="font-mono text-slate-700 dark:text-slate-200">{(metrics.totalTokens).toLocaleString()}</span>
        </div>

        {/* AI Cost */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Cost:</span>
          <span className="font-mono text-slate-700 dark:text-slate-200">${metrics.estimatedCostUsd.toFixed(3)}</span>
        </div>

        {/* Approvals Alert */}
        {pendingApprovalsCount > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-950/40 px-2.5 py-1 rounded border border-amber-400/40 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <Bell className="w-3.5 h-3.5" />
            <span>{pendingApprovalsCount} Approval Needed</span>
          </div>
        )}

        {/* Incidents Indicator */}
        {activeIncidentsCount > 0 ? (
          <div className="flex items-center gap-1.5 bg-rose-500/10 dark:bg-rose-950/60 px-2.5 py-1 rounded border border-rose-400/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{activeIncidentsCount} Incident Active</span>
          </div>
        ) : (
          <button
            onClick={() => triggerIncident()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/80 transition-colors"
            title="Simulate an incident to test automated SRE assignment"
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>Simulate Incident</span>
          </button>
        )}
      </div>

      {/* Right Controls: View Mode Switcher & Theme Toggle */}
      <div className="flex items-center gap-2">
        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors font-sans ${
                viewMode === v.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
              }`}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center shadow-sm group cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 group-hover:-rotate-12 transition-transform" />
          )}
        </button>
      </div>
    </header>
  );
};
