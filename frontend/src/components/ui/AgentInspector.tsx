import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { CostProjection } from '../../types';
import { 
  X, 
  Cpu, 
  Terminal, 
  Wrench, 
  Sparkles, 
  Send, 
  DollarSign, 
  Database,
  Activity,
  FolderGit2,
  ExternalLink,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Settings,
  Lock,
  Save,
  TrendingUp,
  TrendingDown,
  Eye,
  Info,
  Check
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

const ALL_AVAILABLE_TOOLS = [
  'read_file',
  'write_file',
  'run_command',
  'search_code',
  'web_search',
  'git_ops',
  'k8s_exec',
  'db_query',
  'api_tester'
];

const AGENT_SPECIFIC_DEFAULT_TASKS: Record<string, string[]> = {
  // Leadership Pod
  'agent-pm': [
    'Plan sprint velocity & milestone roadmap',
    'Audit blocker risks & dependency graph',
    'Draft executive project status report'
  ],
  'agent-arch': [
    'Design microservices topology & OpenAPI contract',
    'Draft PostgreSQL schema & migration strategy',
    'Evaluate system scalability & throughput budget'
  ],
  'agent-doc': [
    'Sync Jira tickets & update sprint backlog',
    'Generate technical documentation & README',
    'Compile release changelog & version notes'
  ],
  'agent-research': [
    'Decompose BRD into functional epics',
    'Define Gherkin acceptance criteria',
    'Map user stories to service account permissions'
  ],

  // Engineering Pod
  'agent-backend': [
    'Implement REST endpoints & JWT middleware',
    'Integrate Redis token bucket rate limiting',
    'Write database repository & Kafka event publisher'
  ],
  'agent-frontend': [
    'Build responsive React dashboard view',
    'Implement interactive form with validation',
    'Connect UI state to backend WebSocket stream'
  ],
  'agent-mobile': [
    'Implement cross-service integration hooks',
    'Build mock service fixtures & API seed scripts',
    'Containerize full-stack utility worker'
  ],

  // QA Pod
  'agent-qa': [
    'Execute end-to-end integration test suite',
    'Verify RBAC boundary conditions & permissions',
    'Run chaos stress test under load'
  ],
  'agent-reviewer': [
    'Audit code quality & linter compliance',
    'Run SAST security vulnerability scan',
    'Verify unit test code coverage metrics'
  ],

  // DevOps & Infrastructure Pod
  'agent-devops': [
    'Verify Kubernetes manifests & Helm charts',
    'Audit Docker Compose service health',
    'Configure GitHub Actions CI/CD pipeline'
  ],
  'agent-sre': [
    'Investigate cluster latency & pod crash loops',
    'Analyze Prometheus telemetry & APM error spikes',
    'Execute automated incident remediation script'
  ],

  // Support & Operations Pod
  'agent-sec': [
    'Investigate Tier-3 customer escalation ticket',
    'Inspect security access audit logs & anomalies',
    'Perform forensics on reported authentication failure'
  ],
  'agent-db': [
    'Verify bug reproduction steps & edge cases',
    'Inspect error logs for customer ticket',
    'Update internal troubleshooting knowledge base'
  ],

  // Project Analytics Pod
  'agent-data': [
    'Generate sprint burndown & velocity analysis',
    'Audit token usage & LLM cost expenditure',
    'Produce team delivery bottleneck breakdown'
  ]
};

const getSpecificDefaultTasks = (agentId: string, agentRole: string): string[] => {
  if (AGENT_SPECIFIC_DEFAULT_TASKS[agentId]) {
    return AGENT_SPECIFIC_DEFAULT_TASKS[agentId];
  }
  const r = (agentRole || '').toLowerCase();
  if (r.includes('sec') || r.includes('support')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-sec'];
  }
  if (r.includes('sre') || r.includes('incident')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-sre'];
  }
  if (r.includes('devops') || r.includes('infra')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-devops'];
  }
  if (r.includes('qa') || r.includes('test')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-qa'];
  }
  if (r.includes('data') || r.includes('analytics')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-data'];
  }
  if (r.includes('arch')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-arch'];
  }
  if (r.includes('pm') || r.includes('doc')) {
    return AGENT_SPECIFIC_DEFAULT_TASKS['agent-doc'];
  }
  return AGENT_SPECIFIC_DEFAULT_TASKS['agent-backend'];
};

export const AgentInspector: React.FC = () => {
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const selectAgent = useStore((state) => state.selectAgent);
  const agents = useStore((state) => state.agents);
  const tasks = useStore((state) => state.tasks);
  const projects = useStore((state) => state.projects);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const setSelectedTaskId = useStore((state) => state.setSelectedTaskId);
  const sendAgentInstruction = useStore((state) => state.sendAgentInstruction);
  const assignTaskToAgent = useStore((state) => state.assignTaskToAgent);
  const perms = usePermissions();

  const modelCatalogue = useStore((state) => state.modelCatalogue);
  const fetchModelCatalogue = useStore((state) => state.fetchModelCatalogue);
  const fetchCostProjection = useStore((state) => state.fetchCostProjection);
  const updateAgentConfig = useStore((state) => state.updateAgentConfig);

  const [inputInstruction, setInputInstruction] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Configure Mode State
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editCustomPrompt, setEditCustomPrompt] = useState('');
  const [editTools, setEditTools] = useState<string[]>([]);
  const [costProjection, setCostProjection] = useState<CostProjection | null>(null);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const agent = selectedAgentId ? agents[selectedAgentId] : null;

  // Initialize edit form when agent or configure mode toggles
  useEffect(() => {
    if (agent) {
      setEditName(agent.name);
      setEditModel(agent.model);
      setEditCustomPrompt(agent.customPrompt || '');
      setEditTools(agent.tools || []);
      setCostProjection(null);
    }
  }, [agent?.id, isConfiguring]);

  // Load model catalogue if empty
  useEffect(() => {
    if (isConfiguring && modelCatalogue.length === 0) {
      fetchModelCatalogue();
    }
  }, [isConfiguring, modelCatalogue.length, fetchModelCatalogue]);

  // Trigger live cost projection delta calculation when model changes
  useEffect(() => {
    if (isConfiguring && agent && editModel && editModel !== agent.model) {
      setIsLoadingProjection(true);
      fetchCostProjection(agent.id, editModel)
        .then((proj) => setCostProjection(proj))
        .catch(() => setCostProjection(null))
        .finally(() => setIsLoadingProjection(false));
    } else {
      setCostProjection(null);
    }
  }, [editModel, isConfiguring, agent?.id, agent?.model, fetchCostProjection]);

  if (!selectedAgentId || !agent) {
    return null;
  }

  const activeProject = projects[selectedProjectId];

  // Find active task specifically within the selected project
  const activeTaskInProject = Object.values(tasks).find(
    (t) => t.assignedTo === agent.id && (t.status === 'RUNNING' || t.status === 'ASSIGNED') && t.projectId === selectedProjectId
  );

  // Check if active on a different project
  const activeTaskInOtherProject = !activeTaskInProject ? Object.values(tasks).find(
    (t) => t.assignedTo === agent.id && (t.status === 'RUNNING' || t.status === 'ASSIGNED') && t.projectId !== selectedProjectId
  ) : undefined;

  const otherProject = activeTaskInOtherProject ? projects[activeTaskInOtherProject.projectId] : null;
  const otherProjectName = otherProject?.name || activeTaskInOtherProject?.projectId || 'Another Project';

  const activeTask = activeTaskInProject;
  const isWorkingOnSelectedProject = !!activeTaskInProject;
  const isWorkingOnOtherProject = !!activeTaskInOtherProject;

  // Filter all tasks belonging to this agent (or role) in the active project
  const assignedProjectTasks = Object.values(tasks).filter(
    (t) => (t.assignedTo === agent.id || t.requiredRole === agent.role) && t.projectId === selectedProjectId
  );

  // Filter unassigned or queued tasks in the active project ready for assignment
  const assignableTasks = Object.values(tasks).filter(
    (t) => (!t.assignedTo || t.status === 'QUEUED') && t.projectId === selectedProjectId
  );

  const quickTasks = getSpecificDefaultTasks(agent.id, agent.role);

  const handleSend = async (instructionToSend?: string) => {
    const text = (instructionToSend || inputInstruction).trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      await sendAgentInstruction(agent.id, text, selectedProjectId);
      setInputInstruction('');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!agent) return;
    setIsSavingConfig(true);
    setSaveFeedback(null);
    try {
      const res = await updateAgentConfig(agent.id, {
        name: editName.trim() || agent.name,
        model: editModel || agent.model,
        customPrompt: editCustomPrompt,
        tools: editTools
      });
      if (res) {
        setSaveFeedback('Configuration updated successfully!');
        setTimeout(() => {
          setIsConfiguring(false);
          setSaveFeedback(null);
        }, 800);
      }
    } catch (err: any) {
      setSaveFeedback(`Failed to update: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const toggleTool = (tool: string) => {
    if (editTools.includes(tool)) {
      setEditTools(editTools.filter((t) => t !== tool));
    } else {
      setEditTools([...editTools, tool]);
    }
  };

  return (
    <>
      <aside className="absolute inset-y-0 right-0 w-[460px] max-w-[95vw] bg-white dark:bg-[#11141e] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-150 font-sans overflow-hidden">
        {/* ── 1. DRAWER HEADER ── */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151926] shrink-0 space-y-2.5">
          {/* Top Line: Name + Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {agent.name}
              </h3>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isWorkingOnSelectedProject
                    ? 'bg-emerald-500 animate-pulse'
                    : isWorkingOnOtherProject
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
                title={`Status: ${
                  isWorkingOnSelectedProject
                    ? 'Working (Active Project)'
                    : isWorkingOnOtherProject
                    ? `Occupied in ${otherProjectName}`
                    : 'Standby / Idle'
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {perms.canChangeAgentModel && (
                <button
                  onClick={() => setIsConfiguring(!isConfiguring)}
                  className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs ${
                    isConfiguring
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700'
                  }`}
                  title="Configure Agent Runtime, Model & Custom Instructions"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{isConfiguring ? 'Viewing' : 'Configure'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  selectAgent(null);
                  setIsConfiguring(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subtitle Line: Role, Department, and Model Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 font-medium text-[11px] whitespace-nowrap">
              {agent.role}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">•</span>
            <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium whitespace-nowrap">
              {agent.department}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-mono text-[11px] font-medium whitespace-nowrap">
              <Cpu className="w-3 h-3 text-purple-500 shrink-0" />
              <span>{agent.model}</span>
            </span>
            {agent.customPrompt && (
              <>
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">•</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-medium whitespace-nowrap">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-500 shrink-0" />
                  <span>Custom Prompt</span>
                </span>
              </>
            )}
          </div>

          {/* Project Context Badge */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-slate-800 text-[11px] shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <FolderGit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Project Context:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeProject?.name || 'Workspace'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shrink-0 font-medium">
              {activeProject?.building || 'Main Office'}
            </span>
          </div>
        </div>

        {/* ── 2. BODY: CONFIGURATION MODE vs INSPECTION MODE ── */}
        {isConfiguring ? (
          /* ============================================================ */
          /* CONFIGURE AGENT MODE                                         */
          /* ============================================================ */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs overscroll-contain">
            <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="text-blue-900 dark:text-blue-200">Runtime Agent Tuning:</strong> Modify agent display name, LLM inference model with live cost impact, tool authorizations, and custom prompt directives.
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Agent Display Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0c0e14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans shadow-2xs"
                placeholder="Agent Name"
              />
            </div>

            {/* Role & Department (Fixed/Immutable Guardrail) */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#151926] border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-500" />
                  Role & Department (Immutable)
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                  Orchestration Guard
                </span>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="font-semibold">{agent.role}</span>
                <span>•</span>
                <span className="text-slate-500">{agent.department}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Department and role assignments are pinned to core Directed Acyclic Graph (DAG) routing pipelines to prevent workflow deadlocks.
              </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Inference Model
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Multi-Model Routing</span>
              </div>

              <div className="space-y-1.5">
                {(modelCatalogue.length > 0 ? modelCatalogue : [
                  { id: 'gemini-3.6-flash', provider: 'google', displayName: 'Gemini 3.6 Flash', speedRating: 5, qualityRating: 4, inputPricePer1M: 0.10, outputPricePer1M: 0.40 },
                  { id: 'gemini-3.5-flash-lite', provider: 'google', displayName: 'Gemini 3.5 Flash Lite', speedRating: 5, qualityRating: 3, inputPricePer1M: 0.075, outputPricePer1M: 0.30 },
                  { id: 'gemini-2.5-pro', provider: 'google', displayName: 'Gemini 2.5 Pro', speedRating: 2, qualityRating: 5, inputPricePer1M: 1.25, outputPricePer1M: 5.00 },
                  { id: 'claude-3-5-sonnet', provider: 'anthropic', displayName: 'Claude 3.5 Sonnet', speedRating: 3, qualityRating: 5, inputPricePer1M: 3.00, outputPricePer1M: 15.00 },
                  { id: 'claude-3-5-haiku', provider: 'anthropic', displayName: 'Claude 3.5 Haiku', speedRating: 4, qualityRating: 3, inputPricePer1M: 0.80, outputPricePer1M: 4.00 }
                ]).map((m: any) => {
                  const isSelected = editModel === m.id;
                  const isCurrent = agent.model === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setEditModel(m.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-sm' 
                          : 'bg-slate-50 dark:bg-[#151926] hover:bg-slate-100 dark:hover:bg-[#1a2030] border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="agent-model"
                            checked={isSelected}
                            onChange={() => setEditModel(m.id)}
                            className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                            {m.displayName}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                              Current
                            </span>
                          )}
                        </div>

                        <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                          m.provider === 'google'
                            ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {m.provider === 'google' ? 'Google' : 'Anthropic'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-3">
                          <span>Speed: {'⚡'.repeat(m.speedRating || 4)}</span>
                          <span>Quality: {'★'.repeat(m.qualityRating || 4)}</span>
                        </div>
                        <div className="font-mono text-slate-600 dark:text-slate-300">
                          ${m.inputPricePer1M?.toFixed(2)}/1M in • ${m.outputPricePer1M?.toFixed(2)}/1M out
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live 30-Day Cost Projection Delta Widget */}
            {editModel && editModel !== agent.model && (
              <div className="p-3 rounded-xl bg-slate-900 border border-purple-500/40 text-slate-100 space-y-2 shadow-md">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold flex items-center gap-1.5 text-purple-300">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    30-Day Estimated Cost Projection
                  </span>
                  {isLoadingProjection && (
                    <span className="text-[10px] text-purple-300 animate-pulse">Calculating delta...</span>
                  )}
                </div>

                {costProjection ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                        <div className="text-[10px] text-slate-400">Current Run Rate ({costProjection.currentModel})</div>
                        <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                          ${costProjection.currentCost30.toFixed(2)} / mo
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-800/80 border border-purple-700/60">
                        <div className="text-[10px] text-purple-300">Proposed Run Rate ({costProjection.newModel})</div>
                        <div className="text-sm font-mono font-bold text-purple-200 mt-0.5">
                          ${costProjection.newCost30.toFixed(2)} / mo
                        </div>
                      </div>
                    </div>

                    <div className={`p-2 rounded-lg flex items-center justify-between text-xs font-semibold ${
                      costProjection.costDelta > 0 
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60' 
                        : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        {costProjection.costDelta > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span>Net Cost Variance:</span>
                      </span>
                      <span className="font-mono text-sm">
                        {costProjection.costDelta > 0 ? '+' : ''}${costProjection.costDelta.toFixed(2)} / mo
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 italic leading-tight">
                      Calculated using agent token usage velocity ({costProjection.totalTokens.toLocaleString()} tokens observed).
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    Switching model from <span className="text-slate-200 font-mono">{agent.model}</span> to <span className="text-purple-300 font-mono">{editModel}</span>.
                  </div>
                )}
              </div>
            )}

            {/* Custom Instruction Addendum Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Custom Instruction Addendum
                </label>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Operator Directives</span>
              </div>
              <textarea
                value={editCustomPrompt}
                onChange={(e) => setEditCustomPrompt(e.target.value)}
                rows={4}
                className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0c0e14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-sans shadow-2xs leading-relaxed placeholder-slate-400"
                placeholder="e.g. Always write comprehensive TypeScript unit tests with Vitest; enforce camelCase schema names; reject hardcoded credentials in PRs..."
              />
              <p className="text-[10px] text-slate-500 leading-normal">
                These directives are appended to the agent's system prompt at runtime without altering baseline enterprise guardrails.
              </p>
            </div>

            {/* Tool Authorizations */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Authorized Runtime Tools
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_AVAILABLE_TOOLS.map((tool) => {
                  const isEnabled = editTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 border ${
                        isEnabled
                          ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{isEnabled ? '✓' : '+'}</span>
                      <span>{tool}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {saveFeedback && (
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{saveFeedback}</span>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* STANDARD INSPECTION & PROCESS BODY                           */
          /* ============================================================ */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-700 dark:text-slate-300 overscroll-contain">
            {/* Active Process / Status Card */}
            <div className="bg-slate-50 dark:bg-[#171b29] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  Agent Process & Status
                </span>
                {isWorkingOnSelectedProject ? (
                  <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    agent.state === 'THINKING' ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 animate-pulse' :
                    'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      agent.state === 'THINKING' ? 'bg-purple-500 animate-bounce' : 'bg-emerald-500 animate-ping'
                    }`} />
                    {agent.state === 'THINKING' ? 'THINKING' : 'WORKING'}
                  </span>
                ) : isWorkingOnOtherProject ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    BUSY IN {otherProjectName.toUpperCase()}
                  </span>
                ) : (
                  <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    agent.state === 'COMPLETED' ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700' :
                    agent.state === 'WAITING_APPROVAL' ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700' :
                    agent.state === 'FAILED' ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700' :
                    'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${agent.state === 'IDLE' ? 'bg-slate-400' : 'bg-blue-500'}`} />
                    {agent.state === 'IDLE' || agent.state === 'WORKING' ? 'STANDBY / IDLE' : agent.state}
                  </span>
                )}
              </div>

              <div className="text-slate-800 dark:text-slate-200 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Current Action: </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {isWorkingOnSelectedProject
                    ? (agent.activeAction || activeTask?.title || 'Executing project task')
                    : isWorkingOnOtherProject
                    ? `Occupied on "${otherProjectName}": ${activeTaskInOtherProject?.title}`
                    : 'Standing by at workstation'}
                </span>
              </div>

              {/* Active Task with link to modal */}
              {activeTask ? (
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 dark:text-blue-400 font-medium text-[11px]">Assigned Task:</span>
                    <button
                      onClick={() => setSelectedTaskId(activeTask.id)}
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer"
                    >
                      <span>View Details & Logs</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">{activeTask.title}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Progress</span>
                      <span>{activeTask.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300" 
                        style={{ width: `${activeTask.progress}%` }} 
                      />
                    </div>
                  </div>
                </div>
              ) : activeTaskInOtherProject ? (
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Active in Project: {otherProjectName}</span>
                    </span>
                    <button
                      onClick={() => setSelectedTaskId(activeTaskInOtherProject.id)}
                      className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium cursor-pointer"
                    >
                      <span>View Details & Logs</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">{activeTaskInOtherProject.title}</div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Agent is currently occupied with a task in &quot;{otherProjectName}&quot;. Switch projects in the navigation bar to inspect its workspace and full telemetry.
                  </p>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 italic">
                  No active task currently running in {activeProject?.name || 'this project'}. Use the task prompt below to assign work.
                </div>
              )}
            </div>

            {/* Telemetry Metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 dark:bg-[#171b29] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                  <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Token Usage</span>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono tracking-tight">
                  {agent.totalTokens.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-[#171b29] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Attributed Cost</span>
                </div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono tracking-tight">
                  ${agent.estimatedCost.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Active Operator Custom Prompt Addendum (Feature 3) */}
            {agent.customPrompt && (
              <div className="p-3 rounded-xl bg-cyan-50/60 dark:bg-[#0e1f2b] border border-cyan-200 dark:border-cyan-900/60 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Custom Instruction Addendum
                  </span>
                  <button
                    onClick={() => setIsConfiguring(true)}
                    className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-medium"
                  >
                    Edit
                  </button>
                </div>
                <div className="text-[11px] text-cyan-900 dark:text-cyan-200 bg-white/80 dark:bg-[#08131b] p-2.5 rounded-lg border border-cyan-100 dark:border-cyan-950 font-sans whitespace-pre-wrap leading-relaxed">
                  {agent.customPrompt}
                </div>
              </div>
            )}

            {/* Baseline Enterprise Directives Viewer */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#171b29] border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                  <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Enterprise Role Playbook</span>
                </div>
                <button
                  onClick={() => setShowBaselineModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer font-medium transition"
                >
                  <Eye className="w-3 h-3" />
                  <span>View Full Directives</span>
                </button>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 font-mono leading-snug line-clamp-3 overflow-hidden">
                {agent.systemPrompt}
              </div>
            </div>

            {/* Assigned Project Tasks */}
            {assignedProjectTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Project Tasks ({assignedProjectTasks.length})</span>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {assignedProjectTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-[#171b29] hover:bg-blue-50/60 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-[11px] truncate">
                          {t.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-medium ${
                            t.status === 'RUNNING' ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300' :
                            t.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' :
                            t.status === 'FAILED' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300' :
                            'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {t.status}
                          </span>
                          <span>•</span>
                          <span>{t.progress}% done</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Tools */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Authorized Tools</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-medium shadow-2xs"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Core Competencies */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Skills & Competencies</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agent.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-lg bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-[11px] font-medium shadow-2xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Deliverable / Live Output */}
            {activeTask && activeTask.output && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Deliverable & Live Output</span>
                  </div>
                  <button
                    onClick={() => setSelectedTaskId(activeTask.id)}
                    className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 text-[10px] cursor-pointer"
                  >
                    Expand View
                  </button>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-cyan-900/50 text-slate-200 font-mono text-[10px] space-y-1 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {activeTask.output}
                </div>
              </div>
            )}

            {/* Terminal Execution Stream */}
            {activeTask && activeTask.logs.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Terminal className="w-3 h-3 text-emerald-500" />
                    <span>Live Execution Stream ({activeTask.logs.length})</span>
                  </div>
                  <button
                    onClick={() => setSelectedTaskId(activeTask.id)}
                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-[10px] cursor-pointer"
                  >
                    Full Stream
                  </button>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-[10px] space-y-1 max-h-32 overflow-y-auto">
                  {activeTask.logs.map((log, i) => (
                    <div key={i} className="leading-tight">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. PINNED FOOTER: SAVE BUTTONS vs COMMAND BAR ── */}
        {isConfiguring ? (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151926] shrink-0 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsConfiguring(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSavingConfig}
              onClick={handleSaveConfig}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSavingConfig ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151926] shrink-0 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Assign Task to {agent.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">1-Click Dispatch</span>
            </div>

            {/* Project Backlog / Epic Tasks */}
            {assignableTasks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Project Backlog Tasks ({assignableTasks.length})</span>
                  <span className="text-blue-500 dark:text-blue-400 font-medium">Ready</span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                  {assignableTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="p-1.5 rounded-md bg-white dark:bg-[#0c0e14] border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between gap-1.5 text-[10px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</div>
                        <div className="text-[9px] text-slate-400 font-mono">{t.requiredRole || 'Engineer'}</div>
                      </div>
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={async () => {
                          setIsSending(true);
                          try {
                            await assignTaskToAgent(t.id, agent.id);
                          } finally {
                            setIsSending(false);
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[9px] shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Assign & Run →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Instruction Controls (RBAC Gated) */}
            {perms.canInstructAgent(agent) ? (
              <>
                {/* Quick Task Chips */}
                <div className="flex flex-col gap-1.5">
                  {quickTasks.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleSend(action)}
                      className="text-[11px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0c0e14] hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer text-left truncate flex items-center justify-between group disabled:opacity-50 shadow-2xs"
                      title={`Click to dispatch: ${action}`}
                    >
                      <span className="truncate flex items-center gap-1.5 min-w-0">
                        <Zap className="w-3 h-3 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="truncate font-medium">{action}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-blue-500 shrink-0 font-semibold pl-2">
                        Run →
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Task Input Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={inputInstruction}
                    onChange={(e) => setInputInstruction(e.target.value)}
                    placeholder={`Custom task for ${agent.name}...`}
                    disabled={isSending}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0c0e14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans shadow-2xs disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputInstruction.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Sending...' : 'Assign'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs text-slate-500 font-mono">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Direct instruction restricted. Requires Admin, Owner, or assigned role.</span>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── BASELINE STANDARDS VIEWER MODAL ── */}
      {showBaselineModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div 
            className="w-full max-w-2xl bg-white dark:bg-[#0f1424] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#151a2d]">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Enterprise Role Playbook: {agent.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {agent.role} • {agent.department} • Non-negotiable baseline engineering directives
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBaselineModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap border border-slate-800 select-text">
                {agent.systemPrompt}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151a2d] flex justify-end">
              <button
                onClick={() => setShowBaselineModal(false)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm cursor-pointer"
              >
                Close Directives
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
