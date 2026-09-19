import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { CommandNavbar } from './components/ui/CommandNavbar';
import { IncidentWarRoom } from './components/ui/IncidentWarRoom';
import { ProjectSelector } from './components/ui/ProjectSelector';
import { OfficeScene } from './components/3d/OfficeScene';
import { TaskBoard } from './components/ui/TaskBoard';
import { APMMonitor } from './components/ui/APMMonitor';
import { ServiceAccountsDashboard } from './components/ui/ServiceAccountsDashboard';
import { AgentInspector } from './components/ui/AgentInspector';
import { ApprovalModal } from './components/ui/ApprovalModal';
import { EventLogTicker } from './components/ui/EventLogTicker';
import { CreateProjectModal } from './components/ui/CreateProjectModal';
import { SpecificationStudio } from './components/ui/SpecificationStudio';
import { TaskDetailsModal } from './components/ui/TaskDetailsModal';
import { KubernetesConsoleModal } from './components/ui/KubernetesConsoleModal';
import { useAuthStore } from './store/useAuthStore';
import { LoginPage } from './pages/LoginPage';
import { InviteAcceptPage } from './pages/InviteAcceptPage';
import { PresenceBar } from './components/ui/PresenceBar';
import { TeamManagementDashboard } from './components/ui/TeamManagementDashboard';
import { Loader2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AgentForge ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 text-slate-100 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <h3 className="font-bold text-base font-mono">
                {this.props.fallbackTitle || 'Component Render Error'}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              A runtime render exception was caught. The main application remains active.
            </p>
            <div className="p-3 bg-black/60 rounded-xl border border-slate-800 text-rose-300 font-mono text-xs overflow-x-auto max-h-48 custom-scroll">
              {this.state.error?.message || 'Unknown render exception'}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition"
              >
                Dismiss & Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const initWebSocket = useStore((state) => state.initWebSocket);
  const viewMode = useStore((state) => state.viewMode);
  const theme = useStore((state) => state.theme);

  const { isAuthenticated, isLoading, restoreSession, checkBootstrap } = useAuthStore();
  const [pathname, setPathname] = React.useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);

    // Sanitize any token query param immediately so it is never exposed in the browser address bar
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      import('./lib/api').then(({ setAccessToken }) => {
        setAccessToken(token);
        window.history.replaceState({}, '', window.location.pathname);
      });
    }

    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    restoreSession().then((ok) => {
      if (!ok) {
        checkBootstrap();
      }
    });
  }, [restoreSession, checkBootstrap]);

  useEffect(() => {
    if (isAuthenticated) {
      initWebSocket();
    }
  }, [isAuthenticated, initWebSocket]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  // Route: /invite/:token
  if (pathname.startsWith('/invite/')) {
    const token = pathname.replace('/invite/', '').split('/')[0];
    return <InviteAcceptPage token={token} />;
  }

  // Session checking state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-xs font-mono tracking-wider">INITIALIZING AGENTFORGE...</span>
      </div>
    );
  }

  // Unauthenticated -> Login & Bootstrap Flow
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Command Navbar */}
      <CommandNavbar />

      {/* Online Team Presence Bar */}
      <PresenceBar />

      {/* Incident War Room Alert (Conditional) */}
      <IncidentWarRoom />

      {/* Project Selector & Goal Decomposition Prompt */}
      {viewMode !== 'SERVICE_ACCOUNTS' && viewMode !== 'TEAM_MANAGEMENT' && <ProjectSelector />}

      {/* Main Workspace Area */}
      <main className="flex-1 relative flex overflow-hidden">
        {/* Render View Modes */}
        {viewMode === '3D_OFFICE' && (
          <div className="w-full h-full relative">
            <OfficeScene />
          </div>
        )}

        {viewMode === 'SPLIT_VIEW' && (
          <div className="w-full h-full flex flex-col lg:flex-row">
            {/* Left: 3D Virtual Office */}
            <div className="w-full lg:w-1/2 h-1/2 lg:h-full relative border-r border-slate-200 dark:border-cyber-700/80">
              <OfficeScene />
            </div>
            {/* Right: Task DAG Kanban Board */}
            <div className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-hidden flex flex-col">
              <TaskBoard />
            </div>
          </div>
        )}

        {viewMode === 'KANBAN_DAG' && (
          <div className="w-full h-full flex flex-col">
            <TaskBoard />
          </div>
        )}

        {viewMode === 'APM_INFRA' && (
          <div className="w-full h-full flex flex-col">
            <APMMonitor />
          </div>
        )}

        {viewMode === 'SERVICE_ACCOUNTS' && (
          <div className="w-full h-full flex flex-col">
            <ServiceAccountsDashboard />
          </div>
        )}

        {viewMode === 'TEAM_MANAGEMENT' && (
          <div className="w-full h-full flex flex-col">
            <TeamManagementDashboard />
          </div>
        )}

        {/* Slide-over Agent Inspector Drawer */}
        <AgentInspector />

        {/* Human-in-the-loop Approval Modal */}
        <ApprovalModal />

        {/* Create Project Workspace Modal */}
        <CreateProjectModal />

        {/* Unified Specification Studio 2.0 (Dual-Mode: 1A War Room + 1C Cockpit) */}
        <ErrorBoundary fallbackTitle="Specification Studio Error">
          <SpecificationStudio />
        </ErrorBoundary>

        {/* Detailed Task Execution & Logs Modal */}
        <ErrorBoundary fallbackTitle="Task Details Modal Error">
          <TaskDetailsModal />
        </ErrorBoundary>

        {/* Live Kubernetes Cluster Console & Workloads Modal */}
        <ErrorBoundary fallbackTitle="Kubernetes Console Modal Error">
          <KubernetesConsoleModal />
        </ErrorBoundary>
      </main>

      {/* Real-time Event Stream Log Ticker */}
      <EventLogTicker />
    </div>
  );
};

export default App;
