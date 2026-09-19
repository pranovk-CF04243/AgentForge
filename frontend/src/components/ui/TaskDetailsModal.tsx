import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  X, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  ShieldAlert, 
  RotateCw, 
  FolderGit2, 
  UserCheck, 
  ArrowRight, 
  Wrench, 
  Sparkles, 
  Terminal, 
  AlertCircle,
  FileCode2,
  GitBranch,
  Copy,
  Check
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export const TaskDetailsModal: React.FC = () => {
  const selectedTaskId = useStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useStore((state) => state.setSelectedTaskId);
  const tasks = useStore((state) => state.tasks);
  const perms = usePermissions();
  const task = selectedTaskId ? tasks[selectedTaskId] : null;
  const assignedAgentId = task?.assignedTo;
  const assignedAgent = useStore((state) => (assignedAgentId ? state.agents[assignedAgentId] : null));
  const projectId = task?.projectId;
  const project = useStore((state) => (projectId ? state.projects[projectId] : null));
  const selectAgent = useStore((state) => state.selectAgent);
  const retryTask = useStore((state) => state.retryTask);

  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // Safe null-resistant array references
  const skills = Array.isArray(task?.skills) ? task.skills : [];
  const tools = Array.isArray(task?.tools) ? task.tools : [];
  const dependencies = Array.isArray(task?.dependencies) ? task.dependencies : [];
  const logs = Array.isArray(task?.logs) ? task.logs : [];

  React.useEffect(() => {
    if (selectedTaskId) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [selectedTaskId]);

  if (!selectedTaskId || !task) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryTask(task.id);
    } catch (err) {
      console.error('Failed to retry task:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyOutput = () => {
    if (!task.output) return;
    navigator.clipboard.writeText(task.output);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const getStatusBadge = () => {
    switch (task.status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-blue-300">
            <PlayCircle className="w-3.5 h-3.5 animate-spin" />
            RUNNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      case 'WAITING_APPROVAL':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/70 text-amber-700 dark:text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5" />
            APPROVAL REQUIRED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5" />
            {task.status}
          </span>
        );
    }
  };

  const getPriorityBadge = () => {
    switch (task.priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 text-xs font-semibold">Critical Priority</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800/60 text-xs font-semibold">High Priority</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 text-xs font-medium">Medium Priority</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 text-xs font-medium">Low Priority</span>;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/85 dark:bg-black/90 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedTaskId(null);
      }}
    >
      <div 
        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#111420] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden relative z-10"
        style={{ isolation: 'isolate' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#151926] flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge()}
              {getPriorityBadge()}
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">ID: {task.id}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {task.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <FolderGit2 className="w-3.5 h-3.5 text-blue-500" />
                Project: <strong className="text-slate-700 dark:text-slate-300">{project?.name || task.projectId}</strong>
              </span>
              {task.branch && (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                  {task.branch}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedTaskId(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-slate-700 dark:text-slate-300 text-sm overscroll-contain">
          {/* Failure Alert Banner */}
          {task.status === 'FAILED' && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Task Execution Error</span>
                </div>
                {perms.canRetryTask && (
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>{isRetrying ? 'Retrying...' : 'Retry Task'}</span>
                  </button>
                )}
              </div>
              {task.errorDetails && (
                <p className="text-xs font-mono text-rose-800 dark:text-rose-200 bg-white/60 dark:bg-black/30 p-2.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40 whitespace-pre-wrap">
                  {task.errorDetails}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Objective & Description
            </h3>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161a26] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed">
              {task.description}
            </div>
          </div>

          {/* Assigned Agent & Roles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161a26] border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Assigned Operative
              </span>
              {assignedAgent ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                      {assignedAgent.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {assignedAgent.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {assignedAgent.role}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      selectAgent(assignedAgent.id);
                      setSelectedTaskId(null);
                    }}
                    className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors cursor-pointer shrink-0"
                  >
                    Inspect in 3D
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Unassigned • Required Role: <strong className="text-slate-700 dark:text-slate-300">{task.requiredRole}</strong>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161a26] border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Execution Progress
              </span>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400">Completion</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{task.progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    task.status === 'COMPLETED' ? 'bg-emerald-500' :
                    task.status === 'FAILED' ? 'bg-rose-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${task.progress}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Tools, Skills & Dependencies */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Required Skills */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161a26] border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Skills Required</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <span key={skill} className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-[10px]">
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">None specified</span>
                )}
              </div>
            </div>

            {/* Authorized Tools */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161a26] border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Authorized Tools</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {tools.length > 0 ? (
                  tools.map((tool) => (
                    <span key={tool} className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 text-[10px]">
                      {tool}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">None specified</span>
                )}
              </div>
            </div>

            {/* Prerequisites */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161a26] border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Dependencies</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dependencies.length > 0 ? (
                  dependencies.map((dep) => (
                    <span key={dep} className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[10px] font-mono">
                      {dep}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No dependencies</span>
                )}
              </div>
            </div>
          </div>

          {/* Deliverable & Output */}
          {task.output && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <FileCode2 className="w-4 h-4 text-cyan-500" />
                  <span>Artifact & Execution Deliverable</span>
                </div>
                <button
                  onClick={handleCopyOutput}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  {copiedOutput ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedOutput ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-900/40 text-slate-200 font-mono text-xs max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner overscroll-contain">
                {task.output}
              </div>
            </div>
          )}

          {/* Execution Stream Logs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span>Execution Logs Stream ({logs.length})</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Live Agent Stream</span>
            </div>
            <div 
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs space-y-1.5 max-h-52 overflow-y-auto shadow-inner overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-2 leading-relaxed">
                    <span className="text-slate-600 select-none">[{i + 1}]</span>
                    <span className="text-slate-200">{log}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic py-2 text-center">No logs generated yet for this task</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#151926] flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Updated: {new Date(task.updatedAt || task.createdAt || Date.now()).toLocaleTimeString()}
          </div>
          <div className="flex items-center gap-2">
            {perms.canRetryTask && (task.status === 'FAILED' || task.status === 'RUNNING') && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Restarting...' : task.status === 'RUNNING' ? 'Restart Task' : 'Retry'}</span>
              </button>
            )}
            <button
              onClick={() => setSelectedTaskId(null)}
              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
