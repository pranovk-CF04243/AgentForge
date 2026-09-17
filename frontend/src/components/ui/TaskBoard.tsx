import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { TaskStatus } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  ShieldAlert, 
  Layers, 
  ArrowRight,
  UserCheck,
  RotateCw
} from 'lucide-react';

export const TaskBoard: React.FC = () => {
  const tasks = useStore((state) => state.tasks);
  const agents = useStore((state) => state.agents);
  const selectAgent = useStore((state) => state.selectAgent);
  const retryTask = useStore((state) => state.retryTask);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  const handleRetryTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRetryingTaskId(taskId);
    try {
      await retryTask(taskId);
    } catch (err) {
      console.error('Failed to retry task:', err);
    } finally {
      setRetryingTaskId(null);
    }
  };

  const taskList = Object.values(tasks);

  const columns: { title: string; statusFilter: TaskStatus[]; icon: React.ReactNode; color: string }[] = [
    {
      title: 'Backlog & Waiting',
      statusFilter: ['PENDING', 'QUEUED', 'WAITING'],
      icon: <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />,
      color: 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#12151f]/60',
    },
    {
      title: 'In Progress',
      statusFilter: ['RUNNING', 'ASSIGNED'],
      icon: <PlayCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
      color: 'border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/10',
    },
    {
      title: 'Approval Gate & Blocked',
      statusFilter: ['WAITING_APPROVAL', 'BLOCKED', 'FAILED'],
      icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
      color: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10',
    },
    {
      title: 'Completed',
      statusFilter: ['COMPLETED'],
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
      color: 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10',
    },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 text-[10px] font-sans font-semibold">Critical</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800/60 text-[10px] font-sans font-semibold">High</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 text-[10px] font-sans">Medium</span>;
      default:
        return <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 text-[10px] font-sans">Low</span>;
    }
  };

  return (
    <div className="flex-1 p-4 overflow-x-auto bg-slate-100 dark:bg-[#0c0e14] select-none font-sans transition-colors duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-500" />
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wide uppercase">
            Task Orchestration Pipeline (DAG)
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({taskList.length} total tasks)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 min-w-[1000px]">
        {columns.map((col) => {
          const matchingTasks = taskList.filter((t) => col.statusFilter.includes(t.status));

          return (
            <div
              key={col.title}
              className={`rounded-xl border ${col.color} p-3 flex flex-col h-[calc(100vh-14rem)] shadow-2xs`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800/80 mb-2.5">
                <div className="flex items-center gap-1.5">
                  {col.icon}
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{col.title}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans text-xs font-medium">
                  {matchingTasks.length}
                </span>
              </div>

              {/* Task Cards */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {matchingTasks.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic font-sans">
                    No active tasks
                  </div>
                ) : (
                  matchingTasks.map((task) => {
                    const assignedAgent = task.assignedTo ? agents[task.assignedTo] : null;

                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl bg-white dark:bg-[#161a26] hover:bg-slate-50 dark:hover:bg-[#1c2233] border border-slate-200 dark:border-slate-800/80 shadow-2xs transition-all space-y-2 group"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-xs text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                            {task.title}
                          </span>
                          {getPriorityBadge(task.priority)}
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>

                        {/* Progress Bar */}
                        {(task.status === 'RUNNING' || task.status === 'COMPLETED') && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                              <span>Execution</span>
                              <span className="font-mono">{task.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-1 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Dependencies */}
                        {task.dependencies.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            <ArrowRight className="w-3 h-3" />
                            <span>Requires: {task.dependencies.join(', ')}</span>
                          </div>
                        )}

                        {/* Failed Alert & Retry Action */}
                        {task.status === 'FAILED' && (
                          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1.5">
                            {task.errorDetails && (
                              <p className="text-[10px] text-rose-700 dark:text-rose-300 font-mono line-clamp-2">
                                {task.errorDetails}
                              </p>
                            )}
                            <button
                              onClick={(e) => handleRetryTask(task.id, e)}
                              disabled={retryingTaskId === task.id}
                              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              <RotateCw className={`w-3 h-3 ${retryingTaskId === task.id ? 'animate-spin' : ''}`} />
                              <span>{retryingTaskId === task.id ? 'Retrying...' : 'Retry Task'}</span>
                            </button>
                          </div>
                        )}

                        {/* Assigned Employee */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                          {assignedAgent ? (
                            <button
                              onClick={() => selectAgent(assignedAgent.id)}
                              className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-[11px] font-medium cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{assignedAgent.name}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Role: {task.requiredRole}
                            </span>
                          )}

                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {task.tools.length} Tools
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
