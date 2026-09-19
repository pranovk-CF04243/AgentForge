import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { Building2, Sparkles, Plus, FileText, FolderPlus, FolderGit2, ChevronDown, Check, Lock } from 'lucide-react';

export const ProjectSelector: React.FC = () => {
  const projects = useStore((state) => state.projects);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const selectProject = useStore((state) => state.selectProject);
  const decomposeGoal = useStore((state) => state.decomposeGoal);
  const setCreateProjectModalOpen = useStore((state) => state.setCreateProjectModalOpen);
  const setSpecStudioOpen = useStore((state) => state.setSpecStudioOpen);

  const perms = usePermissions();
  const projectAccess = useAuthStore((state) => state.projectAccess);
  const allowedProjects = useAuthStore((state) => state.allowedProjects);

  const [prompt, setPrompt] = useState('');
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter projects by user project scope
  const availableProjects = useMemo(() => {
    const all = Object.values(projects);
    // Admins and owners always retain workspace-wide visibility
    if (perms.isAdmin) {
      return all;
    }
    // If user has restricted project access, filter by allowed projects list
    if (projectAccess === 'custom') {
      const allowedSet = new Set(allowedProjects || []);
      return all.filter((p) => allowedSet.has(p.id));
    }
    return all;
  }, [projects, perms.isAdmin, projectAccess, allowedProjects]);

  const currentProject = availableProjects.find((p) => p.id === selectedProjectId) || availableProjects[0] || null;

  // Auto-sync selection if current selected project is not in available projects
  useEffect(() => {
    if (availableProjects.length > 0) {
      const isCurrentValid = availableProjects.some((p) => p.id === selectedProjectId);
      if (!isCurrentValid) {
        selectProject(availableProjects[0].id);
      }
    }
  }, [availableProjects, selectedProjectId, selectProject]);

  const handleDecompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isDecomposing || !currentProject) return;
    setIsDecomposing(true);
    await decomposeGoal(prompt);
    setPrompt('');
    setIsDecomposing(false);
  };

  const samplePrompts = [
    'Build Customer Onboarding API with OAuth2 and Kafka',
    'Deploy Automated Loan Underwriting Service to Staging',
    'Migrate Core Relational Schema to PostgreSQL Partitioning',
  ];

  return (
    <div className="bg-slate-50 dark:bg-[#10131d] border-b border-slate-200 dark:border-slate-800/80 px-4 py-2 flex items-center justify-between gap-3 font-sans transition-colors duration-200 relative z-20">
      {/* Active Project & Building Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xl">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition shadow-2xs cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100"
                  title="Switch Active Project"
                >
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {currentProject?.name || (availableProjects.length === 0 ? 'No Projects Permitted' : 'Select Project')}
                  </span>
                  {currentProject && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 shrink-0">
                      {currentProject.building || 'Building A'}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 bg-white dark:bg-[#141824] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 max-h-80 overflow-y-auto">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800/80 mb-1 sticky top-0 bg-white dark:bg-[#141824] flex items-center justify-between">
                      <span>Active Workspace Initiatives</span>
                      {projectAccess === 'custom' && !perms.isAdmin && (
                        <span className="text-[9px] text-indigo-500 font-sans normal-case font-medium flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Scoped
                        </span>
                      )}
                    </div>
                    {availableProjects.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No projects assigned to your account. Please contact an administrator.
                      </div>
                    ) : (
                      availableProjects.map((p) => {
                        const isSelected = p.id === (selectedProjectId || currentProject?.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              selectProject(p.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs truncate">{p.name}</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {p.building}
                                </span>
                              </div>
                              {p.description && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {p.description}
                                </div>
                              )}
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-400/40 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
                {currentProject?.status || 'ACTIVE'}
              </span>
              {currentProject?.repositoryUrl && (
                <a
                  href={currentProject.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50 shrink-0"
                  title="Dedicated GitHub Repository"
                >
                  <FolderGit2 className="w-3 h-3" />
                  <span className="font-mono">{currentProject.repositoryUrl.replace('https://github.com/', '')}</span>
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 min-w-0">
              <span className="truncate flex-1 min-w-0" title={currentProject?.description}>
                {currentProject?.description}
              </span>
              <span className="shrink-0">•</span>
              <div className="flex gap-1.5 shrink-0 overflow-hidden">
                {currentProject?.techStack?.slice(0, 3).map((tech) => (
                  <span key={tech} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono shrink-0">
                    {tech}
                  </span>
                ))}
                {(currentProject?.techStack?.length || 0) > 3 && (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 font-mono shrink-0">
                    +{(currentProject?.techStack?.length || 0) - 3}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Actions: New Project & BRD Intake */}
      <div className="flex items-center gap-2 shrink-0">
        {perms.canCreateProject && (
          <button
            type="button"
            onClick={() => setCreateProjectModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>New Project</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setSpecStudioOpen(true)}
          className="px-2.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 hover:border-cyan-300 dark:hover:border-cyan-700 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
        >
          <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Specification Studio</span>
        </button>
      </div>

      {/* AI Orchestration & Task Decomposition Bar */}
      <div className="shrink-0 flex-1 max-w-sm lg:max-w-md xl:max-w-lg min-w-[260px]">
        <form onSubmit={handleDecompose} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              disabled={!currentProject || !perms.canCreateTask}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                !currentProject
                  ? 'No project selected or permitted...'
                  : !perms.canCreateTask
                  ? 'Viewer role: task creation disabled'
                  : 'Assign high-level engineering requirement...'
              }
              className="w-full px-3 py-1.5 pl-8 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-sans shadow-xs disabled:opacity-60"
            />
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 absolute left-2.5 top-2.5" />
          </div>
          <button
            type="submit"
            disabled={isDecomposing || !currentProject || !perms.canCreateTask}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            {isDecomposing ? (
              <span>Orchestrating...</span>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Decompose & Assign</span>
              </>
            )}
          </button>
        </form>

        {/* Quick sample goals */}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Suggestions:</span>
          {samplePrompts.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(sample)}
              className="hover:text-blue-600 dark:hover:text-blue-400 text-slate-500 dark:text-slate-400 transition-colors"
            >
              "{sample}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
