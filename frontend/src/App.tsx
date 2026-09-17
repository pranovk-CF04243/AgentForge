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
import { BRDIntakeModal } from './components/ui/BRDIntakeModal';
import { PlanVerificationModal } from './components/ui/PlanVerificationModal';

export const App: React.FC = () => {
  const initWebSocket = useStore((state) => state.initWebSocket);
  const viewMode = useStore((state) => state.viewMode);
  const theme = useStore((state) => state.theme);

  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Command Navbar */}
      <CommandNavbar />

      {/* Incident War Room Alert (Conditional) */}
      <IncidentWarRoom />

      {/* Project Selector & Goal Decomposition Prompt */}
      {viewMode !== 'SERVICE_ACCOUNTS' && <ProjectSelector />}

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

        {/* Slide-over Agent Inspector Drawer */}
        <AgentInspector />

        {/* Human-in-the-loop Approval Modal */}
        <ApprovalModal />

        {/* Create Project Workspace Modal */}
        <CreateProjectModal />

        {/* BRD & Detailed Requirements Intake Modal */}
        <BRDIntakeModal />

        {/* Blueprint Plan Verification & Re-planning Modal */}
        <PlanVerificationModal />
      </main>

      {/* Real-time Event Stream Log Ticker */}
      <EventLogTicker />
    </div>
  );
};

export default App;
