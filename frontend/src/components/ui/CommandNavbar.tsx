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
  Key,
  Server,
  LogOut,
  User as UserIcon,
  Shield,
  ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';

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
  const setK8sModalOpen = useStore((state) => state.setK8sModalOpen);
  const clusterStatus = useStore((state) => state.clusterStatus);

  const activeIncidentsCount = Object.keys(incidents).length;
  const pendingApprovalsCount = Object.values(approvals).filter((a) => a.status === 'PENDING').length;

  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const { user, workspace, role, logout } = useAuthStore();
  const perms = usePermissions();

  const views: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: '3D_OFFICE', label: '3D Office', icon: <Box className="w-3.5 h-3.5" /> },
    { id: 'SPLIT_VIEW', label: 'Command Split', icon: <Columns className="w-3.5 h-3.5" /> },
    { id: 'KANBAN_DAG', label: 'Task DAG', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'APM_INFRA', label: 'Infrastructure', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'SERVICE_ACCOUNTS', label: 'API Keys', icon: <Key className="w-3.5 h-3.5" /> },
    { id: 'TEAM_MANAGEMENT', label: 'Team & RBAC', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const tasks = useStore((state) => state.tasks);

  const projectTasks = Object.values(tasks).filter((t) => t.projectId === selectedProjectId);
  const runningInProject = projectTasks.filter((t) => t.status === 'RUNNING' || t.status === 'ASSIGNED').length;

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

      {/* Project Telemetry Metrics */}
      <div className="hidden lg:flex items-center gap-5 font-sans">
        {/* Active Agents */}
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 dark:text-slate-400">Agents:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{metrics.activeAgents}</span>
        </div>

        {/* Tasks Running in Current Project */}
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 className={`w-3.5 h-3.5 ${runningInProject > 0 ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
          <span className="text-slate-500 dark:text-slate-400">Running:</span>
          <span className={`font-semibold ${runningInProject > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
            {runningInProject}
          </span>
        </div>

        {/* Token Counter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Tokens:</span>
          <span className="font-mono text-slate-700 dark:text-slate-200">
            {metrics.totalTokens.toLocaleString()}
          </span>
        </div>

        {/* AI Cost */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Cost:</span>
          <span className="font-mono text-slate-700 dark:text-slate-200">
            ${metrics.estimatedCostUsd.toFixed(3)}
          </span>
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
        {/* Kubernetes Cluster Console Trigger */}
        <button
          onClick={() => setK8sModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm group ${
            clusterStatus?.status === 'ONLINE'
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
          }`}
          title="Open Live Kubernetes Cluster & Workloads Console"
        >
          <Server className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span className="hidden md:inline">
            {clusterStatus?.status === 'ONLINE' ? '⎈ K8s: ONLINE' : '⎈ K8s Cluster'}
          </span>
        </button>

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

        {/* User Profile & Team Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(v => !v)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 transition-all text-xs cursor-pointer shadow-sm"
              title={`${user.name} (${role})`}
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  user.name.slice(0, 2)
                )}
              </div>
              <span className="font-medium hidden md:inline max-w-[100px] truncate">{user.name}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold uppercase ${
                role === 'owner' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                role === 'admin' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                role === 'developer' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                'bg-slate-500/10 text-slate-400 border-slate-500/30'
              }`}>
                {role}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 z-50 text-xs">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    {workspace && (
                      <p className="text-[10px] text-blue-500 font-medium mt-0.5 truncate">{workspace.name}</p>
                    )}
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setViewMode('TEAM_MANAGEMENT');
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span>Team & RBAC Management</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
