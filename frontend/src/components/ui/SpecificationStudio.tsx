import React, { useState, useRef, useEffect } from 'react';
import { useStore, StudioLayout, StudioTab, StudioMessage, Epic } from '../../store/useStore';
import { Task, Priority } from '../../types';
import {
  FileText,
  UploadCloud,
  Sparkles,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  Building2,
  GitBranch,
  Cpu,
  ShieldCheck,
  Zap,
  Terminal,
  RotateCcw,
  Send,
  Edit3,
  Rocket,
  BookOpen,
  Code2,
  Server,
  Columns,
  Grid,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Paperclip,
  KeyRound,
  ShieldAlert,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';

export const SpecificationStudio: React.FC = () => {
  const isSpecStudioOpen = useStore((state) => state.isSpecStudioOpen || state.isBRDModalOpen);
  const setSpecStudioOpen = useStore((state) => state.setSpecStudioOpen);
  const specStudioLayout = useStore((state) => state.specStudioLayout);
  const setSpecStudioLayout = useStore((state) => state.setSpecStudioLayout);
  const activeStudioTab = useStore((state) => state.activeStudioTab);
  const setActiveStudioTab = useStore((state) => state.setActiveStudioTab);
  const rawStudioMessages = useStore((state) => state.studioMessages);
  const studioMessages = Array.isArray(rawStudioMessages) ? rawStudioMessages : [];
  const sendStudioMessage = useStore((state) => state.sendStudioMessage);

  const rawProjects = useStore((state) => state.projects);
  const projects = (rawProjects && typeof rawProjects === 'object') ? rawProjects : {};
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const selectProject = useStore((state) => state.selectProject);
  const rawStagedTasks = useStore((state) => state.stagedTasks);
  const stagedTasks = Array.isArray(rawStagedTasks) ? rawStagedTasks : [];
  const draftBlueprint = useStore((state) => state.draftBlueprint);
  const addStagedTask = useStore((state) => state.addStagedTask);
  const updateStagedTask = useStore((state) => state.updateStagedTask);
  const removeStagedTask = useStore((state) => state.removeStagedTask);
  const launchPlan = useStore((state) => state.launchPlan);
  const analyzeBRD = useStore((state) => state.analyzeBRD);
  const addStudioMessage = useStore((state) => state.addStudioMessage);

  const rawProjectEpics = useStore((state) => state.projectEpics) || {};
  const epics = Array.isArray(rawProjectEpics[selectedProjectId]) ? rawProjectEpics[selectedProjectId] : [];
  const updateProjectEpics = useStore((state) => state.updateProjectEpics);

  // Feature 1A & 1C: Credentials state & actions
  const rawCredentials = useStore((state) => state.credentials) || {};
  const projectCredentials = Array.isArray(rawCredentials[selectedProjectId]) ? rawCredentials[selectedProjectId] : [];
  const updateCredentialStatus = useStore((state) => state.updateCredentialStatus);
  const validateCredentialsForDeploy = useStore((state) => state.validateCredentialsForDeploy);
  const fetchProjectCredentials = useStore((state) => state.fetchProjectCredentials);

  // Feature 1B: Conversational Onboarding state & actions
  const brdPhase = useStore((state) => state.brdPhase);
  const rawBrdQuestions = useStore((state) => state.brdQuestions);
  const brdQuestions = Array.isArray(rawBrdQuestions) ? rawBrdQuestions : [];
  const brdAnswers = useStore((state) => state.brdAnswers) || {};
  const brdSummary = useStore((state) => state.brdSummary);
  const isAnalyzingBRD = useStore((state) => state.isAnalyzingBRD);
  const setBrdPhase = useStore((state) => state.setBrdPhase);
  const setBrdAnswer = useStore((state) => state.setBrdAnswer);
  const submitBrdAnswers = useStore((state) => state.submitBrdAnswers);
  const approveBrdSummary = useStore((state) => state.approveBrdSummary);
  const resetBrdState = useStore((state) => state.resetBrdState);

  const [credValidation, setCredValidation] = useState<{ blocked: boolean; warnings: string[]; blockers: string[] } | null>(null);
  const [isValidatingCreds, setIsValidatingCreds] = useState(false);

  // Selected Epic Details & Revision Modal state
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [isEditingEpic, setIsEditingEpic] = useState(false);
  const [editEpicTitle, setEditEpicTitle] = useState('');
  const [editEpicDesc, setEditEpicDesc] = useState('');
  const [editEpicAC, setEditEpicAC] = useState<string[]>([]);
  const [newCriteriaInput, setNewCriteriaInput] = useState('');
  const [epicDirectiveInput, setEpicDirectiveInput] = useState('');
  const [isSavingEpic, setIsSavingEpic] = useState(false);

  // Chat & Input state
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize chat textarea to fit multiline prompts gracefully
  useEffect(() => {
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
      const scrollHeight = chatTextareaRef.current.scrollHeight;
      chatTextareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 36), 180)}px`;
    }
  }, [chatInput]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // PRD Upload / Edit state
  const [prdTab, setPrdTab] = useState<'EPICS' | 'SPEC_INPUT' | 'CLARIFICATION' | 'SUMMARY'>('EPICS');
  const [specTitle, setSpecTitle] = useState('');
  const [specContent, setSpecContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (brdPhase === 'clarification' && brdQuestions.length > 0) {
      setPrdTab('CLARIFICATION');
    } else if (brdPhase === 'generate' && brdSummary) {
      setPrdTab('SUMMARY');
    } else if (brdPhase === 'complete' && epics.length > 0) {
      setPrdTab('EPICS');
    }
  }, [brdPhase, brdQuestions.length, brdSummary, epics.length]);

  // Task Editing Modal state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRole, setNewRole] = useState('Senior Developer');
  const [newPriority, setNewPriority] = useState<Priority>('HIGH');

  // Launching state
  const [isMobilizing, setIsMobilizing] = useState(false);

  // Project Selector Dropdown state
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  const activeProject = projects[selectedProjectId] || Object.values(projects)[0];

  // Sync specification title with active project name
  useEffect(() => {
    if (activeProject?.name) {
      setSpecTitle(`${activeProject.name} Architecture & Specification`);
    }
  }, [activeProject?.name]);

  // Close project dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Esc to close dropdown or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSpecStudioOpen) {
        if (selectedEpicId) {
          if (isEditingEpic) {
            setIsEditingEpic(false);
          } else {
            setSelectedEpicId(null);
          }
        } else if (isProjectDropdownOpen) {
          setIsProjectDropdownOpen(false);
        } else {
          setSpecStudioOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSpecStudioOpen, isProjectDropdownOpen, selectedEpicId, isEditingEpic, setSpecStudioOpen]);

  // Scroll to bottom on new chat messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [studioMessages]);

  // Sync project credentials when studio is open
  useEffect(() => {
    if (selectedProjectId && isSpecStudioOpen) {
      fetchProjectCredentials(selectedProjectId);
    }
  }, [selectedProjectId, isSpecStudioOpen, fetchProjectCredentials]);

  if (!isSpecStudioOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isSending) return;
    const text = chatInput.trim();
    setChatInput('');
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
    }
    setIsSending(true);
    try {
      setSpecContent(text);
      // If the project currently has 0 epics mapped and this is a substantial requirement/specification prompt,
      // route to analyzeBRD so Epics, Staged Tasks, and Executive debate are fully synthesized!
      if (epics.length === 0 && (text.length > 80 || text.includes('\n'))) {
        let extractedTitle = text
          .split('\n')[0]
          .replace(/^(build|create|develop|deploy)\s+(a|an)?\s*/i, '')
          .replace(/with the following requirements:?/i, '')
          .trim();
        if (!extractedTitle || extractedTitle.length > 40) {
          extractedTitle = `${activeProject?.name || 'System'} Requirements`;
        }
        setSpecTitle(extractedTitle);

        // Optimistically show user prompt as conversation starter immediately
        const optUserMsg: StudioMessage = {
          id: `msg-user-${Date.now()}`,
          projectId: selectedProjectId,
          sender: 'user',
          senderName: 'Engineering Director',
          role: 'Human Director',
          avatar: 'HD',
          content: text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        addStudioMessage(optUserMsg);

        await analyzeBRD({
          projectId: selectedProjectId,
          title: extractedTitle,
          content: text,
        });
      } else {
        await sendStudioMessage(text);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleChipClick = async (chipText: string) => {
    if (isSending) return;
    if (chipText.includes('Upload')) {
      fileInputRef.current?.click();
      return;
    }
    setIsSending(true);
    try {
      await sendStudioMessage(`Please incorporate architectural requirement: "${chipText.replace(/^\+\s*/, '')}"`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    setSpecTitle(fileName);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = (event.target?.result as string) || '';
      setSpecContent(text);
      setPrdTab('SPEC_INPUT');
      
      // If in War Room mode, switch active tab to PRD to let user inspect
      if (specStudioLayout === 'WAR_ROOM') {
        setActiveStudioTab('PRD');
      }

    // Automatically trigger analysis with Orion Spark and Dr. Marcus Cole
    setIsAnalyzing(true);
    try {
      await analyzeBRD({
        projectId: selectedProjectId,
        title: fileName,
        content: text,
        phase: 'discovery',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  reader.readAsText(file);
};

const handleAnalyzeSpec = async () => {
  if (!specContent.trim() || isAnalyzing) return;
  setIsAnalyzing(true);
  try {
    await analyzeBRD({
      projectId: selectedProjectId,
      title: specTitle,
      content: specContent,
      phase: 'discovery',
    });
  } finally {
    setIsAnalyzing(false);
  }
};

  const handleCreateCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newTask: Task = {
      id: `task-custom-${Date.now()}`,
      projectId: selectedProjectId || 'proj-1',
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom engineering deliverable',
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

  const handleMobilize = async () => {
    if (isMobilizing || stagedTasks.length === 0) return;
    setIsMobilizing(true);
    try {
      await launchPlan();
      setSpecStudioOpen(false);
    } finally {
      setIsMobilizing(false);
    }
  };

  const selectedEpic = epics.find((e) => e.id === selectedEpicId) || null;

  const handleOpenEpicModal = (epic: Epic) => {
    setSelectedEpicId(epic.id);
    setIsEditingEpic(false);
    setEditEpicTitle(epic.title);
    setEditEpicDesc(epic.description);
    setEditEpicAC(epic.acceptance_criteria ? [...epic.acceptance_criteria] : []);
    setNewCriteriaInput('');
    setEpicDirectiveInput('');
  };

  const handleStartEditEpic = () => {
    if (!selectedEpic) return;
    setEditEpicTitle(selectedEpic.title);
    setEditEpicDesc(selectedEpic.description);
    setEditEpicAC(selectedEpic.acceptance_criteria ? [...selectedEpic.acceptance_criteria] : []);
    setNewCriteriaInput('');
    setIsEditingEpic(true);
  };

  const handleAddCriteria = () => {
    if (!newCriteriaInput.trim()) return;
    setEditEpicAC([...editEpicAC, newCriteriaInput.trim()]);
    setNewCriteriaInput('');
  };

  const handleRemoveCriteria = (index: number) => {
    setEditEpicAC(editEpicAC.filter((_, i) => i !== index));
  };

  const handleUpdateCriteriaItem = (index: number, val: string) => {
    const updated = [...editEpicAC];
    updated[index] = val;
    setEditEpicAC(updated);
  };

  const handleSaveEpicChanges = async () => {
    if (!selectedEpic || !editEpicTitle.trim()) return;
    setIsSavingEpic(true);
    try {
      const criteria = [...editEpicAC];
      if (newCriteriaInput.trim()) {
        criteria.push(newCriteriaInput.trim());
        setNewCriteriaInput('');
      }
      const updatedList = epics.map((ep) => {
        if (ep.id === selectedEpic.id) {
          return {
            ...ep,
            title: editEpicTitle.trim(),
            description: editEpicDesc.trim(),
            acceptance_criteria: criteria,
            updatedAt: new Date().toISOString(),
          };
        }
        return ep;
      });

      await updateProjectEpics(selectedProjectId, updatedList);
      setIsEditingEpic(false);
    } catch (err) {
      console.error('Failed to save epic changes:', err);
    } finally {
      setIsSavingEpic(false);
    }
  };

  const handleRefineEpicWithAI = () => {
    if (!selectedEpic || !epicDirectiveInput.trim()) return;
    const prompt = `Directive for ${selectedEpic.id} (${selectedEpic.title}): ${epicDirectiveInput.trim()}`;
    setChatInput(prompt);
    setSelectedEpicId(null);
    setEpicDirectiveInput('');
    if (chatTextareaRef.current) {
      chatTextareaRef.current.focus();
    }
  };

  // Render PRD Navigator Content (shared across Cockpit left pane and War Room canvas tab)
  const renderPRDNavigator = (isFullCanvas = false) => (
    <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-[#111528] rounded-2xl overflow-hidden ${isFullCanvas ? '' : 'border border-slate-200 dark:border-slate-800 shadow-xl'}`}>
      
      {/* Navigator Subheader */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#161b34] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wide">
            Requirements & Epics
          </span>
        </div>
        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700/60 text-[10px] font-mono">
          <button
            onClick={() => setPrdTab('EPICS')}
            className={`px-2.5 py-0.5 rounded cursor-pointer transition ${prdTab === 'EPICS' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Parsed Epics {epics.length > 0 ? `(${epics.length})` : ''}
          </button>
          {brdQuestions.length > 0 && (
            <button
              onClick={() => setPrdTab('CLARIFICATION')}
              className={`px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1 ${prdTab === 'CLARIFICATION' ? 'bg-amber-600 text-white font-bold' : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'}`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Clarify ({brdQuestions.length})</span>
            </button>
          )}
          {brdSummary && (
            <button
              onClick={() => setPrdTab('SUMMARY')}
              className={`px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1 ${prdTab === 'SUMMARY' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'}`}
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Summary</span>
            </button>
          )}
          <button
            onClick={() => setPrdTab('SPEC_INPUT')}
            className={`px-2.5 py-0.5 rounded cursor-pointer transition ${prdTab === 'SPEC_INPUT' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Spec / Raw Editor
          </button>
        </div>
      </div>

      {/* Navigator Content */}
      <div className="flex-1 min-h-0 p-3.5 overflow-y-auto space-y-3 text-xs custom-scroll">
        {prdTab === 'CLARIFICATION' && brdQuestions.length > 0 ? (
          <div className="space-y-3.5">
            {/* Orion Spark Header Card */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                  OS
                </div>
                <div>
                  <div className="font-bold text-xs text-amber-900 dark:text-amber-200">Orion Spark (Lead Business Analyst)</div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400">Architectural Clarification & 12-Factor Confirmation</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                I analyzed your specification. Please confirm the technical stack, database, authentication, and external integration decisions below before Dr. Marcus Cole and I formulate the engineering epics.
              </p>
            </div>

            {/* Question Cards */}
            <div className="space-y-3">
              {brdQuestions.map((q, idx) => {
                const currentAnswer = brdAnswers[q.id] || '';
                return (
                  <div
                    key={q.id || idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold">
                        {q.category}
                      </span>
                      {currentAnswer && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" />
                          Answered
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {q.question}
                    </div>

                    {q.impact && (
                      <div className="text-[10px] text-slate-500 italic">
                        Impact: {q.impact}
                      </div>
                    )}

                    {/* Option Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {q.options?.map((opt, optIdx) => {
                        const isSelected = currentAnswer === opt;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setBrdAnswer(q.id, opt)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                                : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Write-In Input */}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => setBrdAnswer(q.id, e.target.value)}
                        placeholder="Or specify custom requirement / 'Proceed with stub'..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0c0e14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-[11px] focus:outline-none focus:border-blue-500 font-sans shadow-2xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    brdQuestions.forEach((q) => {
                      if (!brdAnswers[q.id]) {
                        setBrdAnswer(q.id, q.defaultOption || q.options[0] || 'Proceed with stub assumption');
                      }
                    });
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Select All Defaults / Stubs
                </button>
                <span className="text-[10px] text-slate-400 font-mono">
                  {Object.keys(brdAnswers).length} of {brdQuestions.length} Answered
                </span>
              </div>

              <button
                type="button"
                disabled={isAnalyzingBRD}
                onClick={() => submitBrdAnswers(selectedProjectId, specTitle, specContent)}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isAnalyzingBRD ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Responses with Orion Spark...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Submit Clarification Responses →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : prdTab === 'SUMMARY' && brdSummary ? (
          <div className="space-y-3.5">
            {/* Requirements Summary Header */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200">Requirements Baseline Formulated</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400">All ambiguities addressed • Ready for Epic formulation</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                {brdSummary.executive_summary}
              </p>
            </div>

            {/* Chosen Tech Stack */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                Confirmed Engineering Stack
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {brdSummary.chosen_tech_stack?.map((tech, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-mono font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* Confirmed Decisions */}
            {brdSummary.confirmed_decisions && brdSummary.confirmed_decisions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Confirmed Architectural Decisions
                </span>
                <div className="space-y-1 text-xs">
                  {brdSummary.confirmed_decisions.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0 font-semibold">[{d.category}]:</span>
                      <span className="text-slate-800 dark:text-slate-200">{d.decision}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stub Assumptions */}
            {brdSummary.stub_assumptions && brdSummary.stub_assumptions.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-[#1a1815] border border-amber-200 dark:border-amber-900/50 space-y-2">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Stub & Mock Assumptions (Dev Mode)
                </span>
                <div className="space-y-1 text-xs">
                  {brdSummary.stub_assumptions.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      <span className="font-mono text-amber-600 dark:text-amber-400 shrink-0 font-semibold">[{s.category}]:</span>
                      <span className="text-slate-800 dark:text-slate-200">{s.assumption}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Button */}
            <div className="pt-1">
              <button
                type="button"
                disabled={isAnalyzingBRD}
                onClick={() => approveBrdSummary(selectedProjectId, specTitle, specContent)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isAnalyzingBRD ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Compiling Epics & Execution DAG...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>Approve Baseline & Generate Engineering Epics →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : prdTab === 'EPICS' ? (
          epics.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">No Epics Mapped Yet</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xs">
                  Switch to the <strong>Spec / Raw Editor</strong> tab to paste requirements or upload a BRD. Orion Spark will analyze goals and map functional epics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrdTab('SPEC_INPUT')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition cursor-pointer shadow-2xs"
              >
                Open Raw Editor →
              </button>
            </div>
          ) : (
            epics.map((epic, idx) => (
              <div
                key={epic.id || idx}
                onClick={() => handleOpenEpicModal(epic)}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-indigo-500/40 hover:border-indigo-500 transition-all cursor-pointer shadow-2xs hover:shadow-md active:scale-[0.99] group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5">
                    <span>{epic.id || `EPIC-0${idx + 1}`}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-medium">
                      {epic.status || 'Mapped'}
                    </span>
                    <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {epic.title}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {epic.description}
                </p>
                {Array.isArray(epic.acceptance_criteria) && epic.acceptance_criteria.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                    {epic.acceptance_criteria.map((ac, acIdx) => (
                      <div key={acIdx} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{ac}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Visual click affordance */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-indigo-500 font-mono transition-colors">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>{Array.isArray(epic.acceptance_criteria) ? epic.acceptance_criteria.length : 0} criteria</span>
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <span>Inspect & Edit</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            ))
          )
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Specification Title</label>
              <input
                type="text"
                value={specTitle}
                onChange={(e) => setSpecTitle(e.target.value)}
                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans shadow-2xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Requirements & Acceptance Criteria</label>
              <textarea
                rows={isFullCanvas ? 14 : 9}
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                placeholder="Paste business requirements, feature narrative, or user acceptance criteria here..."
                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed shadow-2xs"
              />
            </div>
            <button
              onClick={handleAnalyzeSpec}
              disabled={isAnalyzing || !specContent.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAnalyzing ? 'Analyzing with Orion Spark...' : 'Analyze & Clarify Architecture'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Drag & Drop Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#14182e]">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-mono font-medium transition border border-slate-300 dark:border-slate-700/80 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Upload BRD / Spec Document (.md, .pdf, .txt)</span>
        </button>
      </div>

    </div>
  );

  // Render Epic Details & Revision Modal
  const renderEpicModal = () => {
    if (!selectedEpic) return null;

    const linkedTasks = (stagedTasks || []).filter((t) => t.epicId === selectedEpic.id);

    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100000] flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-150">
        <div className="w-full max-w-2xl bg-white dark:bg-[#101426] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
          
          {/* Modal Header */}
          <div className="px-5 py-4 bg-slate-50 dark:bg-[#151932] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {selectedEpic.id}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                    {isEditingEpic ? 'Edit Epic Specification' : selectedEpic.title}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-medium">
                    {selectedEpic.status || 'Mapped'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Project: {activeProject?.name || selectedProjectId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditingEpic ? (
                <button
                  onClick={handleStartEditEpic}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-98"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Epic</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsEditingEpic(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedEpicId(null);
                  setIsEditingEpic(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-5 overflow-y-auto space-y-4 custom-scroll text-xs flex-1">
            {!isEditingEpic ? (
              <>
                {/* Scope & Description */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Functional Scope & Description
                  </label>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed font-sans text-xs">
                    {selectedEpic.description}
                  </div>
                </div>

                {/* Complete Acceptance Criteria */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Complete Acceptance Criteria ({selectedEpic.acceptance_criteria?.length || 0} Points)
                    </label>
                    <button
                      onClick={handleStartEditEpic}
                      className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add more criteria</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedEpic.acceptance_criteria && selectedEpic.acceptance_criteria.length > 0 ? (
                      selectedEpic.acceptance_criteria.map((ac, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                        >
                          <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                          <span className="leading-relaxed flex-1">{ac}</span>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">#{idx + 1}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 text-center text-xs">
                        No criteria defined. Click "Edit Epic" to add acceptance criteria.
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Engineering Tasks in DAG */}
                {linkedTasks.length > 0 && (
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                      Linked Engineering Tasks in DAG ({linkedTasks.length})
                    </label>
                    <div className="space-y-1.5">
                      {linkedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[10px] text-indigo-600 dark:text-indigo-400">
                              {task.id}
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">
                            {task.requiredRole}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Directive / Refine with AI Section */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Prompt Orion & Marcus to Refine this Epic</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Agent Directive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={epicDirectiveInput}
                      onChange={(e) => setEpicDirectiveInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRefineEpicWithAI();
                      }}
                      placeholder={`e.g., Enhance ${selectedEpic.id} with multi-factor auth and audit logs...`}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans"
                    />
                    <button
                      onClick={handleRefineEpicWithAI}
                      disabled={!epicDirectiveInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-medium transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* EDIT MODE */
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Epic Title
                  </label>
                  <input
                    type="text"
                    value={editEpicTitle}
                    onChange={(e) => setEditEpicTitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Description & Scope
                  </label>
                  <textarea
                    rows={3}
                    value={editEpicDesc}
                    onChange={(e) => setEditEpicDesc(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                    Acceptance Criteria Checklist
                  </label>
                  <div className="space-y-2">
                    {editEpicAC.map((criteria, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                        <input
                          type="text"
                          value={criteria}
                          onChange={(e) => handleUpdateCriteriaItem(idx, e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCriteria(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer shrink-0"
                          title="Remove criteria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add new criteria item input */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-mono text-[10px] text-indigo-500 w-5 shrink-0">+</span>
                      <input
                        type="text"
                        value={newCriteriaInput}
                        onChange={(e) => setNewCriteriaInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCriteria();
                          }
                        }}
                        placeholder="Add new acceptance criteria point (press Enter)..."
                        className="flex-1 bg-white dark:bg-slate-900 border border-dashed border-indigo-400/60 dark:border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddCriteria}
                        disabled={!newCriteriaInput.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-medium disabled:opacity-40 cursor-pointer shrink-0 transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#151932] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400">
              {isEditingEpic ? 'Edits will sync immediately with backend database' : `${selectedEpic.acceptance_criteria?.length || 0} Acceptance Criteria points`}
            </span>
            <div className="flex items-center gap-2">
              {isEditingEpic ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingEpic(false)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEpicChanges}
                    disabled={isSavingEpic || !editEpicTitle.trim()}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold font-mono text-xs transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isSavingEpic ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedEpicId(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs transition cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-[1550px] h-[92vh] bg-white dark:bg-[#0c0f1d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans text-slate-800 dark:text-slate-100 transition-colors">
        
        {/* Hidden File Input (Always accessible in both War Room & Cockpit) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".md,.txt,.json,.yaml,.yml,.pdf"
          className="hidden"
        />

        {/* ======================================================== */}
        {/* TOP COMMAND BAR                                           */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* TOP COMMAND HEADER (ROW 1: Identity, Layout Toggle & Close) */}
        {/* ======================================================== */}
        <div className="bg-white dark:bg-[#0c0f1d] border-b border-slate-200 dark:border-slate-800/80 px-5 py-2.5 flex items-center justify-between gap-4 transition-colors">
          {/* Left: Studio Brand & Active Status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-cyan-500/25">
              AF
            </div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
                Specification Studio 2.0
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Orion & Marcus Active
              </span>
            </div>
          </div>

          {/* Right: Dual-Layout Toggle Controls + Close Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-0.5 shadow-inner text-xs font-mono">
              <button
                type="button"
                onClick={() => setSpecStudioLayout('WAR_ROOM')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  specStudioLayout === 'WAR_ROOM'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="2-Pane Executive War Room: Agent Roundtable + Blueprint Canvas"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Executive War Room (2-Pane)</span>
              </button>

              <button
                type="button"
                onClick={() => setSpecStudioLayout('COCKPIT')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  specStudioLayout === 'COCKPIT'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="3-Pane Mission Cockpit: PRD Navigator + Agent Roundtable + Live DAG"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Mission Cockpit (3-Pane)</span>
              </button>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Close Button - Prominently positioned at the far top-right */}
            <button
              type="button"
              onClick={() => setSpecStudioOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
              title="Close Specification Studio (Esc)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SUB-COMMAND BAR (ROW 2: Target Project & Actions)        */}
        {/* ======================================================== */}
        <div className="bg-slate-50 dark:bg-[#111628] border-b border-slate-200 dark:border-slate-800 px-5 py-2 flex flex-wrap items-center justify-between gap-3 transition-colors">
          {/* Left: Project Selector Dropdown + Tech Stack + Upload BRD */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Target Project:</span>
            
            {/* Custom Designed Project Selector Dropdown */}
            <div className="relative" ref={projectDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-cyan-500/70 dark:hover:border-cyan-500/70 transition shadow-2xs cursor-pointer group text-xs text-left"
                title="Click to switch active project"
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform" />
                <span className="font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                  {activeProject?.name || 'Select Project'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {activeProject?.building || 'Building A'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProjectDropdownOpen ? 'rotate-180 text-cyan-500' : ''}`} />
              </button>

              {/* Floating Dropdown Popover */}
              {isProjectDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-white dark:bg-[#111628] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800/80 mb-1">
                    Select Target Project
                  </div>
                  {Object.values(projects).map((p) => {
                    const isSelected = p.id === (selectedProjectId || activeProject?.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          selectProject(p.id);
                          setIsProjectDropdownOpen(false);
                        }}
                        className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800/60 text-cyan-900 dark:text-cyan-200'
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
                        {isSelected && <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <span className="text-slate-400">•</span>
            
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">Stack:</span>
              <div className="flex items-center gap-1">
                {(activeProject?.techStack || ['Go', 'PostgreSQL', 'Redis', 'Kubernetes']).map((tech) => (
                  <span key={tech} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-cyan-300 font-medium">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Direct Upload BRD Trigger on Left */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 text-xs font-mono font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Upload BRD or Spec Document (.md, .pdf, .txt, .json)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Upload BRD</span>
            </button>
          </div>

          {/* Right: Approve & Mobilize Button MOVED TO THE RIGHT SIDE */}
          <div>
            <button
              type="button"
              onClick={handleMobilize}
              disabled={isMobilizing || stagedTasks.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono transition shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
            >
              <Rocket className="w-4 h-4" />
              <span>{isMobilizing ? 'Mobilizing...' : `Approve & Mobilize (${stagedTasks.length} Tasks)`}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MAIN WORKSPACE AREA                                       */}
        {/* ======================================================== */}
        <div className="flex-1 grid grid-cols-12 gap-3.5 p-3.5 overflow-hidden bg-slate-100/70 dark:bg-[#090b14] transition-colors">
          
          {/* ======================================================== */}
          {/* PANE 1: PRD & REQUIREMENTS NAVIGATOR (Visible in Cockpit) */}
          {/* ======================================================== */}
          {specStudioLayout === 'COCKPIT' && (
            <div className="col-span-3 h-full min-h-0 overflow-hidden">
              {renderPRDNavigator(false)}
            </div>
          )}

          {/* ======================================================== */}
          {/* PANE 2: AGENT ROUNDTABLE CHAT (Adapts width dynamically) */}
          {/* ======================================================== */}
          <div
            className={`${
              specStudioLayout === 'COCKPIT' ? 'col-span-5' : 'col-span-5'
            } flex flex-col h-full bg-white dark:bg-[#12162a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl transition-colors`}
          >
            {/* Chat Header */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#171c35] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-white dark:border-[#171c35] flex items-center justify-center text-[10px] font-bold text-white shadow" title="Orion Spark (Lead BA)">
                    OS
                  </div>
                  <div className="w-7 h-7 rounded-full bg-cyan-600 border-2 border-white dark:border-[#171c35] flex items-center justify-center text-[10px] font-bold text-white shadow" title="Dr. Marcus Cole (Principal Architect)">
                    MC
                  </div>
                  <div className="w-7 h-7 rounded-full bg-amber-600 border-2 border-white dark:border-[#171c35] flex items-center justify-center text-[10px] font-bold text-white shadow" title="Caleb Cruz (DevOps Engineer)">
                    CC
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Executive Roundtable</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Orion (BA), Dr. Marcus (Architect), Caleb (DevOps)</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-900 text-cyan-800 dark:text-cyan-300 font-mono border border-cyan-300 dark:border-cyan-800/40">
                Directives Sync Active
              </span>
            </div>

            {/* Chat Transcript */}
            <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto custom-scroll text-xs">
              {studioMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-950/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">Executive Roundtable Active</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                      Orion Spark (Lead BA) and Dr. Marcus Cole (Principal Architect) are ready for <strong>{activeProject?.name}</strong>. Provide an engineering directive below or upload a BRD to formulate epics.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5 pt-2 max-w-md">
                    <button
                      type="button"
                      onClick={() => handleChipClick(`Design architectural blueprint and service boundaries for ${activeProject?.name}`)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      + Formulate Architectural Blueprint
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChipClick(`Generate OpenAPI schema contracts and REST endpoints for ${activeProject?.name}`)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      + Define OpenAPI Contracts
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChipClick(`Configure Kubernetes deployment topology and CI/CD pipelines for ${activeProject?.name}`)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      + Generate K8s Topology & CI/CD
                    </button>
                  </div>
                </div>
              ) : (
                studioMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 items-start ${msg.sender === 'user' ? 'justify-end' : ''}`}
                  >
                    {msg.sender !== 'user' && (
                      <div
                        className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow mt-0.5 ${
                          msg.sender === 'orion'
                            ? 'bg-indigo-600'
                            : msg.sender === 'marcus'
                            ? 'bg-cyan-600'
                            : 'bg-amber-600'
                        }`}
                      >
                        {msg.avatar}
                      </div>
                    )}

                    <div
                      className={`${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none px-3.5 py-2.5 max-w-[85%] shadow'
                          : 'bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-3.5 max-w-[90%] space-y-1.5 text-slate-800 dark:text-slate-200 shadow-2xs'
                      }`}
                    >
                      {msg.sender !== 'user' && (
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          <span className={`font-bold ${msg.sender === 'orion' ? 'text-indigo-600 dark:text-indigo-300' : 'text-cyan-600 dark:text-cyan-300'}`}>
                            {msg.senderName} ({msg.role})
                          </span>
                          <span>{msg.timestamp}</span>
                        </div>
                      )}

                      <div
                        className={`leading-relaxed text-xs whitespace-pre-wrap break-words font-sans ${
                          msg.sender === 'user' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Interactive Recommendation Chips */}
                      {msg.chips && msg.chips.length > 0 && (
                        <div className="pt-1.5 flex flex-wrap gap-1.5">
                          {msg.chips.map((chip, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleChipClick(chip)}
                              className="px-2.5 py-1 bg-white dark:bg-slate-800/90 hover:bg-cyan-50 dark:hover:bg-cyan-950 border border-slate-300 dark:border-slate-700 hover:border-cyan-400 rounded-lg text-[11px] text-cyan-800 dark:text-cyan-200 font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <span>{chip}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.systemNote && (
                        <div className="mt-1.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-2 text-[11px] text-cyan-800 dark:text-cyan-300 font-mono flex items-center gap-1.5">
                          <span>{msg.systemNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar with Direct File Attachment & Auto-Expanding Multiline Textarea */}
            <div className="p-3 bg-slate-50 dark:bg-[#151a30] border-t border-slate-200 dark:border-slate-800">
              <form onSubmit={handleSendMessage} className="bg-white dark:bg-[#0e1222] border border-slate-300 dark:border-slate-700/80 rounded-2xl p-2.5 shadow-2xs focus-within:border-cyan-500/80 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all flex flex-col">
                {/* Top Section: Attachment Button + Auto-Expanding Textarea */}
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer mt-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    title="Attach and parse BRD specification document (.md, .pdf, .txt)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <textarea
                    ref={chatTextareaRef}
                    rows={1}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Discuss requirements with Marcus, Orion, or Caleb, or paste a specification prompt..."
                    className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none leading-relaxed min-h-[36px] max-h-[180px] overflow-y-auto custom-scroll py-1"
                  />
                </div>

                {/* Bottom Action / Context Bar */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/60 px-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {chatInput.includes('\n') ? (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-medium">
                        {chatInput.split('\n').length} lines • {chatInput.length} chars
                      </span>
                    ) : (
                      <span>Shift + ↵ for newline • ↵ to send</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {chatInput.trim().length > 80 && epics.length === 0 && (
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono hidden sm:inline">
                        ✨ Synthesizes Epics & DAG
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSending || !chatInput.trim()}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                    >
                      {isSending ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

          </div>

          {/* ======================================================== */}
          {/* PANE 3: BLUEPRINT CANVAS (Adapts width dynamically)       */}
          {/* ======================================================== */}
          <div
            className={`${
              specStudioLayout === 'COCKPIT' ? 'col-span-4' : 'col-span-7'
            } flex flex-col h-full bg-white dark:bg-[#101426] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl transition-colors`}
          >
            {/* Canvas Header */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#151930] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              
              {/* If War Room: Render Tabs; If Cockpit: Render Title */}
              {specStudioLayout === 'WAR_ROOM' ? (
                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700/60 text-xs font-mono">
                  <button
                    onClick={() => setActiveStudioTab('DAG')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      activeStudioTab === 'DAG'
                        ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Visual DAG ({stagedTasks.length} Stages)
                  </button>
                  <button
                    onClick={() => setActiveStudioTab('PRD')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                      activeStudioTab === 'PRD'
                        ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 text-indigo-500" />
                    <span>PRD & Requirements</span>
                  </button>
                  <button
                    onClick={() => setActiveStudioTab('OPENAPI')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      activeStudioTab === 'OPENAPI'
                        ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    OpenAPI Spec Preview
                  </button>
                  <button
                    onClick={() => setActiveStudioTab('K8S')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      activeStudioTab === 'K8S'
                        ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    K8s Topology
                  </button>
                  <button
                    onClick={() => setActiveStudioTab('CREDENTIALS')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                      activeStudioTab === 'CREDENTIALS'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <KeyRound className="w-3 h-3 text-amber-500" />
                    <span>Credentials ({projectCredentials.length})</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wide">
                    Live Execution DAG ({stagedTasks.length} Stages)
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveStudioTab(activeStudioTab === 'CREDENTIALS' ? 'DAG' : 'CREDENTIALS')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono border flex items-center gap-1 cursor-pointer transition shadow-2xs ${
                    activeStudioTab === 'CREDENTIALS'
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title="Toggle Credentials & Integrations Manifest"
                >
                  <KeyRound className="w-3 h-3 text-amber-500" />
                  <span>Credentials ({projectCredentials.length})</span>
                </button>

                <button
                  onClick={() => setShowAddTask(true)}
                  className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-mono border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  <span>Add Task</span>
                </button>
              </div>

            </div>

            {/* Canvas Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scroll">
              
              {/* TAB: PRD & REQUIREMENTS IN WAR ROOM */}
              {specStudioLayout === 'WAR_ROOM' && activeStudioTab === 'PRD' && (
                <div className="h-full min-h-0 overflow-hidden">
                  {renderPRDNavigator(true)}
                </div>
              )}

              {/* TAB: VISUAL DAG (Default for both modes) */}
              {(activeStudioTab === 'DAG' || (specStudioLayout === 'COCKPIT' && activeStudioTab !== 'CREDENTIALS')) && (
                <div className="space-y-2.5">
                  {stagedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 my-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-950/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">No Execution Stages Planned Yet</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                          {epics.length > 0
                            ? `You have ${epics.length} functional Epics mapped. Let Dr. Marcus Cole synthesize and sequence the dependency stages into the Task DAG.`
                            : 'Upload a BRD or enter requirements in the Roundtable to generate engineering tasks.'}
                        </p>
                      </div>
                      {epics.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleChipClick(`Synthesize full execution DAG stages for project ${activeProject?.name} covering all ${epics.length} mapped functional epics.`)}
                          disabled={isSending}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-2 cursor-pointer active:scale-98"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isSending ? 'Synthesizing DAG...' : 'Synthesize Execution DAG with Dr. Marcus'}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    stagedTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="p-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/70 hover:border-cyan-400 dark:hover:border-cyan-500/50 rounded-xl flex items-start justify-between shadow-2xs transition"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{task.title}</span>
                              <span className="px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-mono text-[9px] font-bold border border-cyan-300/60 dark:border-cyan-700/40">
                                {task.requiredRole}
                              </span>
                              {task.requiresApproval && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono text-[9px] font-bold border border-amber-300/60 dark:border-amber-700/40">
                                  Human Gate
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{task.description}</p>
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                              {(task.dependencies?.length || 0) > 0 && (
                                <span className="text-indigo-600 dark:text-indigo-400">Depends on: {task.dependencies.join(', ')}</span>
                              )}
                              <span>•</span>
                              <span className="text-slate-600 dark:text-slate-300">Tools: {(task.tools || ['run_command']).slice(0, 3).join(', ')}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => removeStagedTask(task.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Remove Stage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}

                  {/* Inline Add Task Form */}
                  {showAddTask && (
                    <form onSubmit={handleCreateCustomTask} className="p-3 bg-white dark:bg-slate-950 border border-cyan-500/60 rounded-xl space-y-2.5 shadow-sm">
                      <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300 font-mono">Define Custom Milestone</div>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Task Title (e.g., Audit Logging Middleware)"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                      <textarea
                        rows={2}
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Deliverable description and engineering criteria..."
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs text-slate-900 dark:text-white focus:outline-none font-sans"
                      />
                      <div className="flex items-center justify-between">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <option value="Software Architect">Software Architect</option>
                          <option value="Senior Developer">Senior Developer</option>
                          <option value="Lead QA Engineer">Lead QA Engineer</option>
                          <option value="DevOps Engineer">DevOps Engineer</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddTask(false)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded cursor-pointer"
                          >
                            Add Stage
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB: OPENAPI CONTRACT PREVIEW (War Room mode) */}
              {specStudioLayout === 'WAR_ROOM' && activeStudioTab === 'OPENAPI' && (
                <div className="bg-slate-900 dark:bg-[#090c16] p-4 rounded-xl font-mono text-xs text-slate-300 border border-slate-300 dark:border-slate-800 leading-relaxed overflow-x-auto shadow-inner">
                  <pre className="text-cyan-300">openapi: 3.0.3
info:
  title: {activeProject?.name || 'Service API'}
  version: 1.0.0
  description: {activeProject?.description || 'Autonomous Microservice API Specification'}
paths:
  /api/v1/healthz:
    get:
      summary: Liveness and readiness probe endpoint
      responses:
        '200':
          description: Service healthy
  /api/v1/{activeProject?.name ? activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'entities'}:
    get:
      summary: Query {activeProject?.name || 'entities'} collection
      responses:
        '200':
          description: OK
    post:
      summary: Create new {activeProject?.name || 'entity'}
      responses:
        '201':
          description: Created</pre>
                </div>
              )}

              {/* TAB: K8S TOPOLOGY PREVIEW (War Room mode) */}
              {specStudioLayout === 'WAR_ROOM' && activeStudioTab === 'K8S' && (
                <div className="bg-slate-900 dark:bg-[#090c16] p-4 rounded-xl font-mono text-xs text-slate-300 border border-slate-300 dark:border-slate-800 leading-relaxed overflow-x-auto shadow-inner">
                  <pre className="text-amber-300">k8s/
├── base/
│   ├── deployment.yaml   (App: {activeProject?.name ? activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'app'}, Probes: /api/v1/healthz)
│   ├── service.yaml      (ClusterIP: 8080 : 8080)
│   ├── configmap.yaml    (PORT: 8080, ENVIRONMENT: base)
│   └── kustomization.yaml
└── overlays/
    ├── dev/              (Direct Push Namespace: agentforge-dev)
    │   ├── kustomization.yaml
    │   └── replica_count.yaml (Replicas: 1)
    └── prod/             (GitOps Pull Strategy via ArgoCD)
        ├── kustomization.yaml
        ├── sealedsecret.yaml  (Encrypted Credentials)
        └── hpa.yaml           (HorizontalPodAutoscaler: min 2, max 10, targetCPU: 75%)</pre>
                </div>
              )}

              {/* TAB: CREDENTIALS & INTEGRATIONS MANIFEST */}
              {activeStudioTab === 'CREDENTIALS' && (
                <div className="space-y-4">
                  {/* Credentials Header & Validation Trigger */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-500" />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                          Credential & Secret Manifest
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                          {projectCredentials.length} Parameters
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        AgentForge never persists production secret values. Track parameters, define safe mocks for dev, and enforce pre-deploy validation gates.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isValidatingCreds || projectCredentials.length === 0}
                        onClick={async () => {
                          setIsValidatingCreds(true);
                          try {
                            const res = await validateCredentialsForDeploy(selectedProjectId, 'dev');
                            setCredValidation(res);
                          } catch (err) {
                            console.error('Validation error:', err);
                          } finally {
                            setIsValidatingCreds(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{isValidatingCreds ? 'Validating...' : 'Validate for Deploy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                      <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 uppercase font-bold flex items-center justify-between">
                        <span>Confirmed / Injected</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                        {projectCredentials.filter(c => c.status === 'confirmed').length}
                      </div>
                    </div>

                    <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/40 rounded-xl">
                      <div className="text-[10px] font-mono text-sky-700 dark:text-sky-400 uppercase font-bold flex items-center justify-between">
                        <span>Mocked / Stubbed</span>
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xl font-black font-mono text-sky-700 dark:text-sky-300 mt-1">
                        {projectCredentials.filter(c => c.status === 'stub').length}
                      </div>
                    </div>

                    <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl">
                      <div className="text-[10px] font-mono text-rose-700 dark:text-rose-400 uppercase font-bold flex items-center justify-between">
                        <span>Pending / Missing</span>
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xl font-black font-mono text-rose-700 dark:text-rose-300 mt-1">
                        {projectCredentials.filter(c => c.status === 'pending').length}
                      </div>
                    </div>
                  </div>

                  {/* Validation Feedback Banner */}
                  {credValidation && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs font-mono space-y-2 ${
                        credValidation.blocked
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                          : credValidation.warnings.length > 0
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold">
                          {credValidation.blocked ? (
                            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          ) : credValidation.warnings.length > 0 ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>
                            {credValidation.blocked
                              ? 'DEPLOYMENT BLOCKED FOR PROD (Pending Credentials)'
                              : credValidation.warnings.length > 0
                              ? 'DEV READY WITH STUB WARNINGS'
                              : 'DEPLOYMENT GATE CLEARED'}
                          </span>
                        </div>
                        <button
                          onClick={() => setCredValidation(null)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>

                      {credValidation.blockers.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Production Blockers:</div>
                          {credValidation.blockers.map((b, i) => (
                            <div key={i} className="text-[11px] flex items-center gap-1.5 pl-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {credValidation.warnings.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Dev Deployment Advisories:</div>
                          {credValidation.warnings.map((w, i) => (
                            <div key={i} className="text-[11px] flex items-center gap-1.5 pl-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Credentials List */}
                  {projectCredentials.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 my-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">No Credential Parameters Detected</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                          When Orion Spark and Dr. Marcus Cole analyze requirements and API contracts, required DB credentials, OAuth secrets, and third-party API keys will appear here automatically.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {projectCredentials.map((cred) => (
                        <div
                          key={cred.id}
                          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-2.5 transition hover:border-slate-300 dark:hover:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                  {cred.name}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {cred.type}
                                </span>
                                {cred.integration && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                    {cred.integration}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                {cred.description || 'No description provided.'}
                              </p>
                            </div>

                            {/* Status Selector Pills */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateCredentialStatus(selectedProjectId, cred.id, 'pending')}
                                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                  cred.status === 'pending'
                                    ? 'bg-rose-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                Pending
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCredentialStatus(selectedProjectId, cred.id, 'stub')}
                                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                  cred.status === 'stub'
                                    ? 'bg-sky-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                Stub / Mock
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCredentialStatus(selectedProjectId, cred.id, 'confirmed')}
                                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                  cred.status === 'confirmed'
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                Confirmed
                              </button>
                            </div>
                          </div>

                          {/* Example Stub / Value & Notes */}
                          {cred.exampleValue && (
                            <div className="flex items-center gap-2 text-[11px] font-mono bg-slate-50 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="text-slate-400 shrink-0">Mock / Stub:</span>
                              <span className="text-amber-600 dark:text-amber-400 truncate">{cred.exampleValue}</span>
                            </div>
                          )}
                          {cred.isRequired && (
                            <div className="text-[10px] font-mono text-rose-500 dark:text-rose-400 pl-1">
                              * Required for production deployment
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* Epic Details & Revision Modal */}
      {renderEpicModal()}
    </div>
  );
};
