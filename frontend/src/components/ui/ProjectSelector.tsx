import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Building2, Sparkles, Plus, FileText, FolderPlus } from 'lucide-react';

export const ProjectSelector: React.FC = () => {
  const projects = useStore((state) => state.projects);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const selectProject = useStore((state) => state.selectProject);
  const decomposeGoal = useStore((state) => state.decomposeGoal);
  const setCreateProjectModalOpen = useStore((state) => state.setCreateProjectModalOpen);
  const setBRDModalOpen = useStore((state) => state.setBRDModalOpen);

  const [prompt, setPrompt] = useState('');
  const [isDecomposing, setIsDecomposing] = useState(false);

  const currentProject = projects[selectedProjectId] || Object.values(projects)[0];

  const handleDecompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isDecomposing) return;
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
    <div className="bg-slate-50 dark:bg-[#10131d] border-b border-slate-200 dark:border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 font-sans transition-colors duration-200">
      {/* Active Project & Building Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => selectProject(e.target.value)}
                aria-label="Active Project"
                className="bg-transparent font-semibold text-sm text-slate-800 dark:text-slate-100 font-sans border-none focus:outline-none cursor-pointer"
              >
                {Object.values(projects).map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-[#141824] text-slate-800 dark:text-white">
                    {p.name} ({p.building})
                  </option>
                ))}
              </select>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-400/40 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 font-medium">
                {currentProject?.status || 'ACTIVE'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{currentProject?.description}</span>
              <span>•</span>
              <div className="flex gap-1.5">
                {currentProject?.techStack.map((tech) => (
                  <span key={tech} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Actions: New Project & BRD Intake */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCreateProjectModalOpen(true)}
          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <FolderPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>New Project</span>
        </button>

        <button
          type="button"
          onClick={() => setBRDModalOpen(true)}
          className="px-2.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 hover:border-cyan-300 dark:hover:border-cyan-700 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Intake BRD / PRD</span>
        </button>
      </div>

      {/* AI Orchestration & Task Decomposition Bar */}
      <div className="flex-1 max-w-xl">
        <form onSubmit={handleDecompose} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Assign high-level engineering requirement..."
              className="w-full px-3 py-1.5 pl-8 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-sans shadow-xs"
            />
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 absolute left-2.5 top-2.5" />
          </div>
          <button
            type="submit"
            disabled={isDecomposing}
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
