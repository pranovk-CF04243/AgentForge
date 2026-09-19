import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Task, Priority } from '../../types';
import { 
  Layers, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Sparkles, 
  X, 
  Edit3, 
  Rocket, 
  Send,
  BookOpen,
  Lock
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export const PlanVerificationModal: React.FC = () => {
  const isPlanVerificationModalOpen = useStore((state) => state.isPlanVerificationModalOpen);
  const setPlanVerificationModalOpen = useStore((state) => state.setPlanVerificationModalOpen);
  const draftBlueprint = useStore((state) => state.draftBlueprint);
  const stagedTasks = useStore((state) => state.stagedTasks);
  const updateStagedTask = useStore((state) => state.updateStagedTask);
  const addStagedTask = useStore((state) => state.addStagedTask);
  const removeStagedTask = useStore((state) => state.removeStagedTask);
  const replanTasks = useStore((state) => state.replanTasks);
  const launchPlan = useStore((state) => state.launchPlan);
  const perms = usePermissions();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [replanPrompt, setReplanPrompt] = useState('');
  const [isReplanning, setIsReplanning] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // New Custom Task Form State
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRole, setNewRole] = useState('Senior Developer');
  const [newPriority, setNewPriority] = useState<Priority>('HIGH');

  if (!isPlanVerificationModalOpen) return null;

  const handleReplan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replanPrompt.trim() || isReplanning) return;
    setIsReplanning(true);
    await replanTasks(replanPrompt.trim());
    setReplanPrompt('');
    setIsReplanning(false);
  };

  const handleCreateCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newTask: Task = {
      id: `task-custom-${Date.now()}`,
      projectId: stagedTasks[0]?.projectId || 'proj-1',
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom milestone task',
      priority: newPriority,
      status: 'QUEUED',
      requiredRole: newRole,
      skills: ['Software Engineering'],
      tools: ['read_file', 'write_file', 'run_command'],
      dependencies: [],
      progress: 0,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addStagedTask(newTask);
    setNewTitle('');
    setNewDesc('');
    setShowAddTask(false);
  };

  const handleLaunch = async () => {
    if (isLaunching || stagedTasks.length === 0) return;
    setIsLaunching(true);
    await launchPlan();
    setIsLaunching(false);
    setPlanVerificationModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-[#0f121d] border border-slate-200 dark:border-cyan-600/60 rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh] transition-colors">
        {/* Modal Header */}
        <div className="bg-slate-50 dark:bg-[#141826] border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Engineering Plan & Blueprint Verification</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 font-medium">
                  {stagedTasks.length} Milestones Proposed
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Review, modify, or add tasks before dispatching to the engineering team</p>
            </div>
          </div>
          <button
            onClick={() => setPlanVerificationModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          {/* Executive Summary & Epics Card */}
          {draftBlueprint && draftBlueprint.executive_summary && (
            <div className="bg-slate-50 dark:bg-[#141826] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-medium">
                <BookOpen className="w-4 h-4" />
                <span>Executive Summary & Scope</span>
              </div>
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-xs">
                {draftBlueprint.executive_summary}
              </p>

              {draftBlueprint.epics && draftBlueprint.epics.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {draftBlueprint.epics.map((epic: any, idx: number) => (
                    <div key={idx} className="p-2 rounded-lg bg-white dark:bg-[#0b0e17] border border-slate-200 dark:border-slate-800/80 shadow-2xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 text-[11px] flex items-center justify-between">
                        <span>{epic.title}</span>
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">{epic.id}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5 line-clamp-2">{epic.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Staged Tasks (DAG Sequence) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                Proposed Task Execution DAG
              </span>
              <button
                type="button"
                onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Task</span>
              </button>
            </div>

            {/* Add Custom Task Drawer */}
            {showAddTask && (
              <form onSubmit={handleCreateCustomTask} className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141826] border border-cyan-300 dark:border-cyan-800/60 space-y-3 animate-in fade-in duration-150 shadow-2xs">
                <div className="font-semibold text-cyan-700 dark:text-cyan-300 text-xs">Add New Milestone Task</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task Title (e.g. Implement Redis Cache Layer)"
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                  >
                    <option value="Software Architect">Software Architect</option>
                    <option value="Senior Developer">Senior Developer</option>
                    <option value="Junior Developer (Frontend)">Junior Developer (Frontend)</option>
                    <option value="Lead QA Engineer">Lead QA Engineer</option>
                    <option value="DevOps Engineer">DevOps Engineer</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Task instructions and deliverables..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-cyan-500 resize-none shadow-2xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTask(false)}
                    className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer shadow-xs"
                  >
                    Insert Task
                  </button>
                </div>
              </form>
            )}

            {/* Task Cards List */}
            <div className="space-y-2">
              {stagedTasks.map((task, idx) => {
                const isEditing = editingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#131724] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-medium">
                          {idx + 1}
                        </span>

                        <div className="flex-1 space-y-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateStagedTask(task.id, { title: e.target.value })}
                              className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-[#0a0c13] border border-cyan-600 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                            />
                          ) : (
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{task.title}</span>
                          )}

                          {isEditing ? (
                            <textarea
                              rows={2}
                              value={task.description}
                              onChange={(e) => updateStagedTask(task.id, { description: e.target.value })}
                              className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-[#0a0c13] border border-cyan-600 text-slate-800 dark:text-slate-200 text-[11px] focus:outline-none resize-none"
                            />
                          ) : (
                            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">{task.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(isEditing ? null : task.id)}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            isEditing ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title="Edit Task Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStagedTask(task.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Remove Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata chips */}
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-medium">
                          Role: {task.requiredRole}
                        </span>
                        {(task.dependencies?.length || 0) > 0 && (
                          <span className="text-slate-500">
                            Prerequisites: {(task.dependencies || []).join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        <span>Tools: {(task.tools || []).slice(0, 3).join(', ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Re-Plan Prompt Bar */}
          <div className="bg-slate-50 dark:bg-[#141826] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Request Plan Revisions with Dr. Marcus Cole (Architect)</span>
            </div>
            <form onSubmit={handleReplan} className="flex gap-2">
              <input
                type="text"
                value={replanPrompt}
                onChange={(e) => setReplanPrompt(e.target.value)}
                placeholder="e.g. Add automated performance benchmark with k6 before deployment..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-2xs"
              />
              <button
                type="submit"
                disabled={isReplanning || !replanPrompt.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 font-medium text-xs flex items-center gap-1 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isReplanning ? 'Re-planning...' : 'Revise Plan'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-[#141826] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Human Approval Required to Initiate Active Execution</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlanVerificationModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer text-xs"
            >
              Cancel / Back
            </button>
            {perms.canLaunchPlan ? (
              <button
                onClick={handleLaunch}
                disabled={isLaunching || stagedTasks.length === 0}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-600/20 cursor-pointer text-xs"
              >
                <Rocket className="w-4 h-4" />
                <span>{isLaunching ? 'Mobilizing Agents...' : 'Approve & Launch Pipeline'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-mono">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Launch restricted to Developer, Admin, or Owner</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
