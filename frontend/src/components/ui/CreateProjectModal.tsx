import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Building2, X, Plus, Check, FolderGit2, ShieldAlert } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export const CreateProjectModal: React.FC = () => {
  const isCreateProjectModalOpen = useStore((state) => state.isCreateProjectModalOpen);
  const setCreateProjectModalOpen = useStore((state) => state.setCreateProjectModalOpen);
  const createProject = useStore((state) => state.createProject);
  const perms = usePermissions();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [building, setBuilding] = useState('Building B');
  const [repoUrl, setRepoUrl] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [selectedTech, setSelectedTech] = useState<string[]>(['Go', 'PostgreSQL', 'React']);
  const [customTech, setCustomTech] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCreateProjectModalOpen) return null;

  const standardTechs = ['Go', 'Python', 'React', 'TypeScript', 'PostgreSQL', 'Kafka', 'Redis', 'Docker', 'Kubernetes', 'TailwindCSS'];

  const toggleTech = (tech: string) => {
    setSelectedTech((prev) => 
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const addCustomTech = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTech.trim() || selectedTech.includes(customTech.trim())) return;
    setSelectedTech([...selectedTech, customTech.trim()]);
    setCustomTech('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    await createProject({
      name: name.trim(),
      description: description.trim() || 'Autonomous engineering workspace initiative',
      building,
      techStack: selectedTech,
      repositoryUrl: repoUrl.trim() || undefined,
      targetBranch: targetBranch.trim() || 'main',
    });

    setIsSubmitting(false);
    setCreateProjectModalOpen(false);
    setName('');
    setDescription('');
    setRepoUrl('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#111420] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans transition-colors">
        {/* Modal Header */}
        <div className="bg-slate-50 dark:bg-[#171b2b] border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Create New Engineering Project</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Register initiative, assign virtual building, and set repository</p>
            </div>
          </div>
          <button
            onClick={() => setCreateProjectModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          {/* Project Name */}
          <div className="space-y-1">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Project Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core Banking API, Cloud Security Mesh"
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs shadow-2xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Objective & Scope</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of business goals and engineering objectives..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs resize-none shadow-2xs"
            />
          </div>

          {/* Building & Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-medium">Virtual Office Building</label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs shadow-2xs"
              >
                <option value="Building A">Building A (Core Platform)</option>
                <option value="Building B">Building B (FinTech & Services)</option>
                <option value="Building C">Building C (AI & Analytics)</option>
                <option value="Innovation Lab">Innovation Lab (R&D)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-medium">Default Git Branch</label>
              <input
                type="text"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Target Git Repository */}
          <div className="space-y-1">
            <label className="text-slate-700 dark:text-slate-300 font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Target Git Repository</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">Auto-provisions if left empty</span>
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Leave empty to auto-create dedicated GitHub repo (e.g. pranovk-CF04243/project-name)"
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
            />
          </div>

          {/* Tech Stack Selection */}
          <div className="space-y-2">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Project Tech Stack</label>
            <div className="flex flex-wrap gap-1.5">
              {standardTechs.map((tech) => {
                const isSelected = selectedTech.includes(tech);
                return (
                  <button
                    type="button"
                    key={tech}
                    onClick={() => toggleTech(tech)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{tech}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateProjectModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {perms.canCreateProject ? (
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Creating...' : 'Initialize Project'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 text-xs font-mono">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Requires Admin or Owner</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
