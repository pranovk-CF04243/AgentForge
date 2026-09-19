import { create } from 'zustand';
import { 
  Agent, 
  Task, 
  Project, 
  Incident, 
  HumanApproval, 
  APMMetrics, 
  SystemEvent,
  ProjectCredential,
  ModelInfo,
  AgentConfigUpdate,
  CostProjection,
  DeploymentHealthReport,
  ClarificationQuestion,
  RequirementsSummary
} from '../types';
import { apiFetch, getAccessToken } from '../lib/api';

export type ViewMode = '3D_OFFICE' | 'KANBAN_DAG' | 'APM_INFRA' | 'SPLIT_VIEW' | 'SERVICE_ACCOUNTS' | 'TEAM_MANAGEMENT';
export type CameraPreset = 'ALL' | 'DEVELOPMENT' | 'QA' | 'DEVOPS' | 'ARCHITECTURE' | 'INCIDENT_ROOM' | 'SERVER_ROOM';
export type Theme = 'dark' | 'light';
export type StudioLayout = 'WAR_ROOM' | 'COCKPIT';
export type StudioTab = 'DAG' | 'OPENAPI' | 'K8S' | 'PRD' | 'CREDENTIALS';

export interface StudioMessage {
  id: string;
  projectId?: string;
  sender: 'user' | 'orion' | 'marcus' | 'caleb';
  senderName: string;
  role: string;
  avatar: string;
  content: string;
  timestamp: string;
  chips?: string[];
  systemNote?: string;
}

export interface ClusterNode {
  name: string;
  ready: boolean;
  status: string;
  roles: string[];
  version: string;
  os: string;
  capacity_cpu: string;
  capacity_memory: string;
}

export interface ClusterStatus {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  cluster_type: string;
  version: string;
  nodes: ClusterNode[];
  total_nodes: number;
  kubeconfig_path?: string;
  error?: string;
}

export interface LivePod {
  name: string;
  namespace: string;
  phase: string;
  status: string;
  ready: string;
  is_ready: boolean;
  restarts: number;
  age: string;
  images: string[];
  pod_ip: string;
}

export interface LiveDeployment {
  name: string;
  namespace: string;
  replicas: number;
  ready_replicas: number;
  updated_replicas: number;
  available_replicas: number;
  age: string;
}

export interface LiveService {
  name: string;
  namespace: string;
  type: string;
  cluster_ip: string;
  ports: string[];
  age: string;
}

export interface LiveWorkloads {
  success: boolean;
  namespace: string;
  pods: LivePod[];
  deployments: LiveDeployment[];
  services: LiveService[];
  error?: string;
}

export interface Epic {
  id: string;
  projectId: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface State {
  // Data
  agents: Record<string, Agent>;
  tasks: Record<string, Task>;
  projects: Record<string, Project>;
  incidents: Record<string, Incident>;
  approvals: Record<string, HumanApproval>;
  events: SystemEvent[];
  metrics: APMMetrics;

  // Persistent Project Blueprint & Memory
  projectEpics: Record<string, Epic[]>;
  projectStagedTasks: Record<string, Task[]>;
  projectStudioMessages: Record<string, StudioMessage[]>;

  // Feature 1A & 1C: Deployment Health & Credentials
  credentials: Record<string, ProjectCredential[]>;
  deploymentHealthReports: Record<string, DeploymentHealthReport>;

  // Feature 1B: Conversational Onboarding State
  brdPhase: 'discovery' | 'clarification' | 'generate' | 'complete';
  brdQuestions: ClarificationQuestion[];
  brdAnswers: Record<string, string>;
  brdSummary: RequirementsSummary | null;
  isAnalyzingBRD: boolean;

  // Feature 3: Dynamic Agent Config & Model Catalogue
  modelCatalogue: ModelInfo[];

  // UI state
  theme: Theme;
  viewMode: ViewMode;
  cameraPreset: CameraPreset;
  selectedAgentId: string | null;
  selectedProjectId: string;
  selectedTaskId: string | null;
  activeApprovalModal: HumanApproval | null;
  isConnected: boolean;
  onlineUsers: any[];

  // Modals & Staged Plan State
  isCreateProjectModalOpen: boolean;
  isBRDModalOpen: boolean;
  isPlanVerificationModalOpen: boolean;
  isSpecStudioOpen: boolean;
  specStudioLayout: StudioLayout;
  activeStudioTab: StudioTab;
  studioMessages: StudioMessage[];
  draftBlueprint: any | null;
  stagedTasks: Task[];

  // Kubernetes Live Cluster State
  isK8sModalOpen: boolean;
  clusterStatus: ClusterStatus | null;
  liveWorkloads: LiveWorkloads | null;
  activePodLogs: { podName: string; logs: string; isLoading: boolean } | null;
  isDeployingCluster: boolean;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  selectAgent: (id: string | null) => void;
  selectProject: (id: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  setCreateProjectModalOpen: (open: boolean) => void;
  setBRDModalOpen: (open: boolean) => void;
  setPlanVerificationModalOpen: (open: boolean) => void;
  setSpecStudioOpen: (open: boolean) => void;
  setSpecStudioLayout: (layout: StudioLayout) => void;
  setActiveStudioTab: (tab: StudioTab) => void;
  sendStudioMessage: (text: string) => Promise<void>;
  addStudioMessage: (msg: StudioMessage) => void;
  createProject: (data: Partial<Project>) => Promise<void>;
  analyzeBRD: (payload: { projectId: string; title: string; content: string; supplementaryNotes?: string; phase?: string }) => Promise<void>;
  replanTasks: (prompt: string) => Promise<void>;
  updateStagedTask: (taskId: string, patch: Partial<Task>) => void;
  addStagedTask: (task: Task) => void;
  removeStagedTask: (taskId: string) => void;
  launchPlan: () => Promise<void>;
  initWebSocket: () => void;
  decomposeGoal: (goal: string) => Promise<void>;
  triggerIncident: (title?: string, severity?: string) => Promise<void>;
  resolveIncident: (id: string) => Promise<void>;
  resolveAllIncidents: () => Promise<void>;
  decideApproval: (id: string, approved: boolean) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  sendAgentInstruction: (agentId: string, instruction: string, projectId?: string) => Promise<void>;
  assignTaskToAgent: (taskId: string, agentId: string) => Promise<void>;
  fetchProjectEpics: (projectId: string) => Promise<void>;
  updateProjectEpics: (projectId: string, epics: Epic[]) => Promise<void>;
  fetchProjectStudioMessages: (projectId: string) => Promise<void>;
  fetchProjectStagedTasks: (projectId: string) => Promise<void>;

  // Feature 1A & 1C Actions
  fetchProjectCredentials: (projectId: string) => Promise<ProjectCredential[]>;
  updateCredentialStatus: (projectId: string, credId: string, status: 'pending' | 'stub' | 'confirmed') => Promise<void>;
  validateCredentialsForDeploy: (projectId: string, env?: string) => Promise<{ blocked: boolean; warnings: string[]; blockers: string[] }>;
  fetchClusterHealth: (projectId: string, namespace?: string, env?: string) => Promise<DeploymentHealthReport | null>;

  // Feature 1B Actions
  setBrdPhase: (phase: 'discovery' | 'clarification' | 'generate' | 'complete') => void;
  setBrdAnswer: (questionId: string, answer: string) => void;
  submitBrdAnswers: (projectId: string, title: string, content: string, supplementaryNotes?: string) => Promise<void>;
  approveBrdSummary: (projectId: string, title: string, content: string, supplementaryNotes?: string) => Promise<void>;
  resetBrdState: () => void;

  // Feature 3 Actions
  fetchModelCatalogue: () => Promise<ModelInfo[]>;
  fetchCostProjection: (agentId: string, newModel: string) => Promise<CostProjection | null>;
  updateAgentConfig: (agentId: string, update: AgentConfigUpdate) => Promise<Agent | null>;

  // Kubernetes Cluster Actions
  setK8sModalOpen: (open: boolean) => void;
  fetchClusterStatus: () => Promise<void>;
  fetchClusterWorkloads: (namespace?: string) => Promise<void>;
  fetchPodLogs: (podName: string, namespace?: string) => Promise<void>;
  provisionNamespace: (projectId: string, environment?: string, cpuLimit?: string, memLimit?: string) => Promise<{ success: boolean; message?: string }>;
  deployToCluster: (projectId: string, environment?: string) => Promise<{ success: boolean; message?: string }>;
}


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const fetch = apiFetch;

export function normalizeTask(t: Task): Task {
  if (!t) return t;
  return {
    ...t,
    skills: Array.isArray(t.skills) ? t.skills : [],
    tools: Array.isArray(t.tools) ? t.tools : [],
    dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
    logs: Array.isArray(t.logs) ? t.logs : [],
    artifacts: Array.isArray(t.artifacts) ? t.artifacts : [],
  };
}

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('agentforge-theme') as Theme;
    if (saved === 'dark' || saved === 'light') {
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
      return saved;
    }
    // Default to dark theme for Cyber/Command aesthetic
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    return 'dark';
  }
  return 'dark';
};

const applyThemeToDOM = (theme: Theme) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('agentforge-theme', theme);
    } catch (e) {
      // ignore storage errors
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }
};

export const initialStudioMessages: StudioMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'orion',
    senderName: 'Orion Spark',
    role: 'Lead Business Analyst',
    avatar: 'OS',
    content: "Welcome to Specification Studio 2.0. Dr. Marcus Cole and I are ready to collaborate on your business requirements, epics, and technical deliverables. You can review parsed Epics on the left, upload specs, or click a decision pill below.",
    timestamp: '12:00 PM',
    chips: [
      '+ 24h Key Grace Period',
      '+ Redis Token Bucket (100 req/min)',
      '+ PostgreSQL Row-Level Security',
      '+ GitOps ArgoCD Manifests'
    ]
  },
  {
    id: 'msg-init-2',
    sender: 'marcus',
    senderName: 'Dr. Marcus Cole',
    role: 'Principal Software Architect',
    avatar: 'MC',
    content: "I have structured the engineering blueprint into a validated Directed Acyclic Graph (DAG). Any directives you provide in this chat will dynamically update the DAG, OpenAPI 3.0 contracts, and Kubernetes overlays in real-time.",
    timestamp: '12:01 PM',
    systemNote: '⚡ Active: 6 Milestones formulated • 0 Dependency conflicts'
  }
];

export const useStore = create<State>((set, get) => ({
  agents: {},
  tasks: {},
  projects: {},
  incidents: {},
  approvals: {},
  events: [],
  metrics: {
    cpuUsagePercent: 32.4,
    memoryUsagePercent: 44.8,
    apiLatencyMs: 42.1,
    errorRatePercent: 0.01,
    activeAgents: 14,
    runningTasks: 2,
    blockedTasks: 0,
    activeIncidents: 0,
    totalTokens: 462100,
    estimatedCostUsd: 1.38,
  },

  projectEpics: {},
  projectStagedTasks: {},
  projectStudioMessages: {},

  theme: getInitialTheme(),
  viewMode: 'SPLIT_VIEW',
  cameraPreset: 'ALL',
  selectedAgentId: null,
  selectedProjectId: 'proj-1',
  selectedTaskId: null,
  activeApprovalModal: null,
  isConnected: false,
  onlineUsers: [],

  // Modals & Staged Plan State
  isCreateProjectModalOpen: false,
  isBRDModalOpen: false,
  isPlanVerificationModalOpen: false,
  isSpecStudioOpen: false,
  specStudioLayout: 'COCKPIT',
  activeStudioTab: 'DAG',
  studioMessages: [],
  draftBlueprint: null,
  stagedTasks: [],

  // Feature 1A & 1C: Deployment Health & Credentials
  credentials: {},
  deploymentHealthReports: {},

  // Feature 1B: Conversational Onboarding State
  brdPhase: 'discovery',
  brdQuestions: [],
  brdAnswers: {},
  brdSummary: null,
  isAnalyzingBRD: false,

  // Feature 3: Dynamic Agent Config & Model Catalogue
  modelCatalogue: [],

  // Kubernetes Live Cluster State
  isK8sModalOpen: false,
  clusterStatus: null,
  liveWorkloads: null,
  activePodLogs: null,
  isDeployingCluster: false,

  toggleTheme: () => {
    const current = get().theme;
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    applyThemeToDOM(next);
    set({ theme: next });
  },
  setTheme: (theme: Theme) => {
    applyThemeToDOM(theme);
    set({ theme });
  },
  setViewMode: (viewMode) => set({ viewMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  selectProject: (selectedProjectId) => {
    const epics = get().projectEpics[selectedProjectId] || [];
    const messages = get().projectStudioMessages[selectedProjectId] || [];
    const staged = get().projectStagedTasks[selectedProjectId] || [];
    set({
      selectedProjectId,
      stagedTasks: staged,
      studioMessages: messages,
    });
    get().fetchClusterWorkloads();
    get().fetchProjectEpics(selectedProjectId);
    get().fetchProjectStudioMessages(selectedProjectId);
    get().fetchProjectStagedTasks(selectedProjectId);
    get().fetchProjectCredentials(selectedProjectId);
    get().fetchClusterHealth(selectedProjectId);
  },
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setCreateProjectModalOpen: (isCreateProjectModalOpen) => set({ isCreateProjectModalOpen }),
  setBRDModalOpen: (isBRDModalOpen) => set({ isBRDModalOpen, isSpecStudioOpen: isBRDModalOpen }),
  setPlanVerificationModalOpen: (isPlanVerificationModalOpen) => set({ isPlanVerificationModalOpen }),
  setSpecStudioOpen: (isSpecStudioOpen) => set({ isSpecStudioOpen, isBRDModalOpen: isSpecStudioOpen }),
  setSpecStudioLayout: (specStudioLayout) => set({ specStudioLayout }),
  setActiveStudioTab: (activeStudioTab) => set({ activeStudioTab }),
  setK8sModalOpen: (isK8sModalOpen) => {
    set({ isK8sModalOpen });
    if (isK8sModalOpen) {
      get().fetchClusterStatus();
      get().fetchClusterWorkloads();
    }
  },

  initWebSocket: () => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      try {
        const token = getAccessToken();
        const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
        ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('[AgentForge WS] Connected to backend event stream');
          set({ isConnected: true });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.action === 'SNAPSHOT') {
              const activeProjId = get().selectedProjectId || 'proj-1';
              const epicsMap = data.epics || {};
              const messagesMap = data.studioMessages || {};
              const allTasksMap: Record<string, Task> = {};
              if (data.tasks) {
                Object.entries(data.tasks).forEach(([id, t]) => {
                  allTasksMap[id] = normalizeTask(t as Task);
                });
              }

              // Extract and group staged tasks by projectId
              const stagedByProject: Record<string, Task[]> = {};
              Object.values(allTasksMap).forEach((t) => {
                if (t.status === 'STAGED' && t.projectId) {
                  if (!stagedByProject[t.projectId]) stagedByProject[t.projectId] = [];
                  stagedByProject[t.projectId].push(t);
                }
              });

              set({
                agents: data.agents || {},
                tasks: allTasksMap,
                projects: data.projects || {},
                incidents: data.incidents || {},
                events: data.events || [],
                metrics: data.metrics || get().metrics,
                projectEpics: epicsMap,
                projectStudioMessages: messagesMap,
                studioMessages: messagesMap[activeProjId] || [],
                projectStagedTasks: stagedByProject,
                stagedTasks: stagedByProject[activeProjId] || [],
              });
            } else if (data.action === 'EPICS_UPDATED') {
              set((state) => ({
                projectEpics: {
                  ...state.projectEpics,
                  [data.projectId]: data.epics || [],
                },
              }));
            } else if (data.action === 'STUDIO_MESSAGE_NEW') {
              set((state) => {
                const currentList = state.projectStudioMessages[data.projectId] || [];
                if (currentList.some((m) => m.id === data.message.id)) {
                  return state;
                }
                const updatedList = [...currentList, data.message];
                const isSelected = state.selectedProjectId === data.projectId;
                return {
                  projectStudioMessages: {
                    ...state.projectStudioMessages,
                    [data.projectId]: updatedList,
                  },
                  ...(isSelected ? { studioMessages: updatedList } : {}),
                };
              });
            } else if (data.action === 'AGENT_UPDATE') {
              set((state) => ({
                agents: { ...state.agents, [data.agent.id]: data.agent },
              }));
            } else if (data.action === 'TASK_UPDATE') {
              set((state) => ({
                tasks: { ...state.tasks, [data.task.id]: normalizeTask(data.task) },
              }));
            } else if (data.action === 'TASK_STREAM') {
              set((state) => {
                const existingTask = state.tasks[data.taskId];
                if (!existingTask) return state;
                return {
                  tasks: {
                    ...state.tasks,
                    [data.taskId]: {
                      ...existingTask,
                      output: (existingTask.output || '') + (data.token || ''),
                    },
                  },
                };
              });
            } else if (data.action === 'EVENT') {
              set((state) => ({
                events: [data.event, ...state.events.slice(0, 99)],
              }));
            } else if (data.action === 'METRICS_UPDATE') {
              set({ metrics: data.metrics });
            } else if (data.action === 'INCIDENT_ALERT' || data.action === 'INCIDENT_CREATED') {
              if (data.incident) {
                set((state) => ({
                  incidents: { ...state.incidents, [data.incident.id]: data.incident },
                }));
              }
            } else if (data.action === 'INCIDENT_RESOLVED') {
              if (data.incidentId) {
                set((state) => {
                  const incs = { ...state.incidents };
                  delete incs[data.incidentId];
                  return { incidents: incs };
                });
              }
            } else if (data.action === 'APPROVAL_REQUESTED') {
              set((state) => ({
                approvals: { ...state.approvals, [data.approval.id]: data.approval },
                activeApprovalModal: data.approval,
              }));
            } else if (data.action === 'PROJECT_CREATED' || data.action === 'PROJECT_UPDATED') {
              if (data.project) {
                set((state) => ({
                  projects: { ...state.projects, [data.project.id]: data.project },
                }));
              }
            } else if (data.action === 'CREDENTIALS_UPDATED') {
              if (data.projectId && data.credentials) {
                set((state) => ({
                  credentials: {
                    ...state.credentials,
                    [data.projectId]: data.credentials,
                  },
                }));
              }
            } else if (data.action === 'STUDIO_CLARIFICATION') {
              set({
                brdPhase: 'clarification',
                brdQuestions: data.questions || [],
                isBRDModalOpen: true,
                isSpecStudioOpen: true,
              });
            } else if (data.action === 'STUDIO_SUMMARY') {
              set({
                brdPhase: 'generate',
                brdSummary: data.summary || null,
                isBRDModalOpen: true,
                isSpecStudioOpen: true,
              });
            } else if (data.action === 'DEPLOYMENT_HEALTH_REPORT') {
              if (data.report && data.report.projectId) {
                set((state) => ({
                  deploymentHealthReports: {
                    ...state.deploymentHealthReports,
                    [data.report.projectId]: data.report,
                  },
                }));
              }
            } else if (data.action === 'PRESENCE_UPDATE') {
              set({ onlineUsers: data.members || [] });
            } else if (data.action === 'ACTIVITY_FEED') {
              if (data.entry) {
                set((state) => ({
                  events: [
                    {
                      id: data.entry.id,
                      type: data.entry.action,
                      source: data.entry.userName || 'Workspace',
                      message: data.entry.detail || data.entry.action,
                      timestamp: data.entry.createdAt || new Date().toISOString(),
                    },
                    ...state.events.slice(0, 99),
                  ],
                }));
              }
            }
          } catch (e) {
            console.error('[AgentForge WS] Error parsing message:', e);
          }
        };

        ws.onclose = () => {
          set({ isConnected: false });
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        set({ isConnected: false });
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    // Fallback: fetch initial snapshot over REST if WS takes a moment
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => res.json())
      .then(() => {
        Promise.all([
          fetch(`${BACKEND_URL}/api/agents`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/api/tasks`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/api/projects`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/api/metrics`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/api/events`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/api/incidents`).then((r) => r.json()),
        ]).then(([agentsList, tasksList, projectsList, metrics, eventsList, incList]) => {
          const agentsMap: Record<string, Agent> = {};
          (agentsList || []).forEach((a: Agent) => { agentsMap[a.id] = a; });
          const tasksMap: Record<string, Task> = {};
          (tasksList || []).forEach((t: Task) => { tasksMap[t.id] = normalizeTask(t); });
          const projectsMap: Record<string, Project> = {};
          (projectsList || []).forEach((p: Project) => { projectsMap[p.id] = p; });
          const incMap: Record<string, Incident> = {};
          (incList || []).forEach((inc: Incident) => { incMap[inc.id] = inc; });

          set({
            agents: agentsMap,
            tasks: tasksMap,
            projects: projectsMap,
            metrics: metrics || get().metrics,
            events: eventsList || [],
            incidents: incMap,
          });
        }).catch((err) => console.warn('REST init fallback error:', err));
      })
      .catch((err) => console.warn('Backend not yet reachable:', err));
  },

  decomposeGoal: async (goal: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: get().selectedProjectId, prompt: goal }),
      });
      const tasks: Task[] = await res.json();
      const updatedTasks = { ...get().tasks };
      tasks.forEach((t) => { updatedTasks[t.id] = normalizeTask(t); });
      set({ tasks: updatedTasks });
    } catch (e) {
      console.error('Error decomposing goal:', e);
    }
  },

  triggerIncident: async (title = 'Kafka Ingestion Backpressure & Latency Spike', severity = 'SEV-1') => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          severity,
          description: 'P99 message broker latency exceeded 4500ms. Partitions 4 & 7 stalled.',
        }),
      });
      const inc: Incident = await res.json();
      set((state) => ({
        incidents: { ...state.incidents, [inc.id]: inc },
        cameraPreset: 'INCIDENT_ROOM',
      }));
    } catch (e) {
      console.error('Error triggering incident:', e);
    }
  },

  resolveIncident: async (id: string) => {
    // Optimistically remove immediately from local state
    const incs = { ...get().incidents };
    delete incs[id];
    set({ incidents: incs, cameraPreset: 'ALL' });

    try {
      await fetch(`${BACKEND_URL}/api/incidents/resolve/${id}`, { method: 'POST' });
    } catch (e) {
      console.error('Error resolving incident:', e);
    }
  },

  resolveAllIncidents: async () => {
    const incs = { ...get().incidents };
    set({ incidents: {}, cameraPreset: 'ALL' });
    for (const id of Object.keys(incs)) {
      try {
        await fetch(`${BACKEND_URL}/api/incidents/resolve/${id}`, { method: 'POST' });
      } catch (e) {
        console.error('Error resolving incident:', e);
      }
    }
  },


  decideApproval: async (id: string, approved: boolean) => {
    try {
      await fetch(`${BACKEND_URL}/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: id, approved }),
      });
      const appr = { ...get().approvals };
      if (appr[id]) {
        appr[id].status = approved ? 'APPROVED' : 'REJECTED';
      }
      set({ approvals: appr, activeApprovalModal: null });
    } catch (e) {
      console.error('Error deciding approval:', e);
    }
  },

  retryTask: async (taskId: string) => {
    const task = get().tasks[taskId];
    if (!task) return;

    // Optimistically update the task state to PENDING and clear failures
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskId]: {
          ...task,
          status: 'PENDING',
          progress: 0,
          errorDetails: undefined,
          assignedTo: undefined,
          updatedAt: new Date().toISOString(),
        },
      },
      events: [
        {
          id: `evt-${Date.now()}`,
          type: 'task.retried',
          source: 'Human Operator',
          message: `Initiating retry for milestone: "${task.title}"`,
          timestamp: new Date().toISOString(),
        },
        ...state.events,
      ],
    }));

    try {
      let res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/retry`, {
        method: 'POST',
      });
      if (!res.ok) {
        // Retry with relative path in case proxied through nginx
        res = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      }
      if (!res.ok) {
        throw new Error(`Failed to retry task: ${res.statusText}`);
      }
    } catch (e) {
      console.error('Error retrying task:', e);
    }
  },

  sendAgentInstruction: async (agentId: string, instruction: string, projectId?: string) => {
    const ag = get().agents[agentId];
    if (!ag) return;
    const currentProjId = projectId || get().selectedProjectId;
    const project = get().projects[currentProjId];
    const projectContext = project ? ` on [${project.name}]` : '';

    try {
      const newEvent: SystemEvent = {
        id: `evt-${Date.now()}`,
        type: 'agent.instruction',
        source: 'Human Operator',
        message: `Instructed ${ag.name} (${ag.role})${projectContext}: "${instruction}"`,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        events: [newEvent, ...state.events],
        agents: {
          ...state.agents,
          [agentId]: {
            ...ag,
            state: 'THINKING',
            currentProject: currentProjId,
            activeAction: `Executing task for ${project?.name || 'workspace'}: "${instruction.slice(0, 30)}..."`,
          },
        },
      }));

      const res = await fetch(`${BACKEND_URL}/api/agents/${agentId}/instruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, projectId: currentProjId }),
      });
      const data = await res.json();
      if (data.reply) {
        const replyEvent: SystemEvent = {
          id: `evt-${Date.now() + 1}`,
          type: 'agent.reply',
          source: `${ag.name} (${ag.role})`,
          message: data.reply,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          events: [replyEvent, ...state.events],
        }));
      }
    } catch (e) {
      console.error('Error sending agent instruction:', e);
    }
  },

  createProject: async (data: Partial<Project>) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Create project failed: ${res.statusText}`);
      const project: Project = await res.json();

      set((state) => ({
        projects: { ...state.projects, [project.id]: project },
        selectedProjectId: project.id,
        stagedTasks: [],
        studioMessages: [],
        draftBlueprint: null,
        projectEpics: { ...state.projectEpics, [project.id]: [] },
        projectStagedTasks: { ...state.projectStagedTasks, [project.id]: [] },
        projectStudioMessages: { ...state.projectStudioMessages, [project.id]: [] },
        isCreateProjectModalOpen: false,
        events: [
          {
            id: `evt-${Date.now()}`,
            type: 'project.created',
            source: 'Human Director',
            message: `Created new project workspace: ${project.name} (${project.building})`,
            timestamp: new Date().toISOString(),
          },
          ...state.events,
        ],
      }));
    } catch (e) {
      console.error('Error creating project:', e);
    }
  },

  setBrdPhase: (brdPhase) => set({ brdPhase }),
  setBrdAnswer: (questionId, answer) => set((state) => ({
    brdAnswers: { ...state.brdAnswers, [questionId]: answer },
  })),
  resetBrdState: () => set({
    brdPhase: 'discovery',
    brdQuestions: [],
    brdAnswers: {},
    brdSummary: null,
    isAnalyzingBRD: false,
  }),

  analyzeBRD: async (payload: { projectId: string; title: string; content: string; supplementaryNotes?: string; phase?: string }) => {
    set({ isAnalyzingBRD: true });
    try {
      const existingEpics = get().projectEpics[payload.projectId] || [];
      const existingTasks = get().projectStagedTasks[payload.projectId] || [];
      const targetPhase = payload.phase || 'discovery';

      const res = await fetch(`${BACKEND_URL}/api/projects/analyze-brd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: payload.projectId,
          projectId: payload.projectId,
          title: payload.title,
          content: payload.content,
          supplementary_notes: payload.supplementaryNotes,
          supplementaryNotes: payload.supplementaryNotes,
          phase: targetPhase,
          existing_epics: existingEpics,
          existing_tasks: existingTasks,
        }),
      });
      if (!res.ok) throw new Error(`BRD analysis failed: ${res.statusText}`);
      const data = await res.json();

      // Check if runtime returned clarification questions (Feature 1B: Conversational Onboarding)
      if (data.phase === 'clarification' && Array.isArray(data.questions) && data.questions.length > 0) {
        set({
          brdPhase: 'clarification',
          brdQuestions: data.questions,
          isBRDModalOpen: true,
          isSpecStudioOpen: true,
          isPlanVerificationModalOpen: false,
        });
        return;
      }

      // Check if runtime returned summary
      if (data.phase === 'summary' && data.summary) {
        set({
          brdPhase: 'generate',
          brdSummary: data.summary,
          isBRDModalOpen: true,
          isSpecStudioOpen: true,
        });
        return;
      }

      // Epics and tasks generated directly
      const rawTasks = data.proposed_tasks || data.tasks || [];
      const staged: Task[] = rawTasks.map((t: any, idx: number) => ({
        id: t.id || `task-${Date.now()}-${idx + 1}`,
        projectId: t.projectId || payload.projectId,
        epicId: t.epicId || undefined,
        title: t.title || `Milestone ${idx + 1}`,
        description: t.description || '',
        priority: t.priority || 'HIGH',
        status: 'QUEUED',
        requiredRole: t.requiredRole || 'Senior Developer',
        skills: t.skills || ['Software Engineering'],
        tools: t.tools || ['read_file', 'write_file', 'run_command'],
        dependencies: t.dependencies || [],
        requiresApproval: t.requiresApproval || false,
        progress: 0,
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const parsedEpics: Epic[] = (data.epics || []).map((e: any, idx: number) => ({
        id: e.id || `EPIC-0${idx + 1}`,
        projectId: payload.projectId,
        title: e.title,
        description: e.description,
        acceptance_criteria: e.acceptance_criteria || [],
        status: 'Mapped',
      }));

      const event: SystemEvent = {
        id: `evt-${Date.now()}`,
        type: 'brd.analyzed',
        source: 'Orion Spark & Dr. Marcus Cole',
        message: `BRD "${payload.title}" decomposed into ${staged.length} engineering milestones for review.`,
        timestamp: new Date().toISOString(),
      };

      // Refresh canonical studio messages from backend to guarantee precise chronological order
      try {
        const msgRes = await fetch(`${BACKEND_URL}/api/projects/studio-messages?projectId=${payload.projectId}`);
        if (msgRes.ok) {
          const canonicalMsgs: StudioMessage[] = await msgRes.json();
          if (Array.isArray(canonicalMsgs) && canonicalMsgs.length > 0) {
            set((state) => ({
              studioMessages: canonicalMsgs,
              projectStudioMessages: {
                ...state.projectStudioMessages,
                [payload.projectId]: canonicalMsgs,
              },
            }));
          }
        }
      } catch (err) {
        console.warn('Could not refresh studio messages:', err);
      }

      set((state) => ({
        draftBlueprint: data,
        stagedTasks: staged,
        brdPhase: 'complete',
        projectEpics: {
          ...state.projectEpics,
          [payload.projectId]: parsedEpics,
        },
        projectStagedTasks: {
          ...state.projectStagedTasks,
          [payload.projectId]: staged,
        },
        isBRDModalOpen: true,
        isSpecStudioOpen: true,
        isPlanVerificationModalOpen: false,
        events: [event, ...state.events],
      }));

      get().fetchProjectCredentials(payload.projectId);
    } catch (e) {
      console.error('Error analyzing BRD:', e);
    } finally {
      set({ isAnalyzingBRD: false });
    }
  },

  submitBrdAnswers: async (projectId: string, title: string, content: string, supplementaryNotes?: string) => {
    set({ isAnalyzingBRD: true });
    try {
      const pid = projectId || get().selectedProjectId || 'proj-1';
      const answers = get().brdAnswers;
      const res = await fetch(`${BACKEND_URL}/api/projects/analyze-brd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: pid,
          projectId: pid,
          title,
          content,
          supplementary_notes: supplementaryNotes,
          supplementaryNotes,
          phase: 'clarification',
          clarification_answers: answers,
        }),
      });
      if (!res.ok) throw new Error(`Clarification submission failed: ${res.statusText}`);
      const data = await res.json();
      if (data.summary) {
        set({
          brdSummary: data.summary,
          brdPhase: 'generate',
        });
      }
    } catch (e) {
      console.error('Error submitting BRD answers:', e);
    } finally {
      set({ isAnalyzingBRD: false });
    }
  },

  approveBrdSummary: async (projectId: string, title: string, content: string, supplementaryNotes?: string) => {
    set({ isAnalyzingBRD: true });
    try {
      const pid = projectId || get().selectedProjectId || 'proj-1';
      const summary = get().brdSummary;
      const res = await fetch(`${BACKEND_URL}/api/projects/analyze-brd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: pid,
          projectId: pid,
          title,
          content,
          supplementary_notes: supplementaryNotes,
          supplementaryNotes,
          phase: 'generate',
          approved_context: summary,
        }),
      });
      if (!res.ok) throw new Error(`BRD generation failed: ${res.statusText}`);
      const data = await res.json();

      const rawTasks = data.proposed_tasks || data.tasks || [];
      const staged: Task[] = rawTasks.map((t: any, idx: number) => ({
        id: t.id || `task-${Date.now()}-${idx + 1}`,
        projectId: t.projectId || pid,
        epicId: t.epicId || undefined,
        title: t.title || `Milestone ${idx + 1}`,
        description: t.description || '',
        priority: t.priority || 'HIGH',
        status: 'QUEUED',
        requiredRole: t.requiredRole || 'Senior Developer',
        skills: t.skills || ['Software Engineering'],
        tools: t.tools || ['read_file', 'write_file', 'run_command'],
        dependencies: t.dependencies || [],
        requiresApproval: t.requiresApproval || false,
        progress: 0,
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const parsedEpics: Epic[] = (data.epics || []).map((e: any, idx: number) => ({
        id: e.id || `EPIC-0${idx + 1}`,
        projectId: pid,
        title: e.title,
        description: e.description,
        acceptance_criteria: e.acceptance_criteria || [],
        status: 'Mapped',
      }));

      set((state) => ({
        draftBlueprint: data,
        stagedTasks: staged,
        brdPhase: 'complete',
        projectEpics: {
          ...state.projectEpics,
          [pid]: parsedEpics,
        },
        projectStagedTasks: {
          ...state.projectStagedTasks,
          [pid]: staged,
        },
      }));

      await get().fetchProjectCredentials(pid);
    } catch (e) {
      console.error('Error generating epics from approved summary:', e);
    } finally {
      set({ isAnalyzingBRD: false });
    }
  },

  replanTasks: async (prompt: string) => {
    try {
      const currentTasks = get().stagedTasks;
      const pid = get().selectedProjectId || currentTasks[0]?.projectId || 'proj-1';
      const res = await fetch(`${BACKEND_URL}/api/projects/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: pid,
          projectId: pid,
          current_tasks: currentTasks,
          currentTasks: currentTasks,
          revision_prompt: prompt,
          revisionPrompt: prompt,
        }),
      });
      if (!res.ok) throw new Error(`Replan failed: ${res.statusText}`);
      const updated: any[] = await res.json();

      if (Array.isArray(updated)) {
        const mapped: Task[] = updated.map((t: any, idx: number) => ({
          id: t.id || `task-rev-${Date.now()}-${idx + 1}`,
          projectId: t.projectId || pid,
          title: t.title || `Task ${idx + 1}`,
          description: t.description || '',
          priority: t.priority || 'HIGH',
          status: t.status || 'QUEUED',
          requiredRole: t.requiredRole || 'Senior Developer',
          skills: t.skills || ['Software Engineering'],
          tools: t.tools || ['read_file', 'write_file', 'run_command'],
          dependencies: t.dependencies || [],
          requiresApproval: t.requiresApproval || false,
          progress: t.progress || 0,
          logs: t.logs || [],
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        const event: SystemEvent = {
          id: `evt-${Date.now()}`,
          type: 'plan.revised',
          source: 'Dr. Marcus Cole',
          message: `Blueprint updated with revisions: "${prompt.slice(0, 45)}..."`,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          stagedTasks: mapped,
          events: [event, ...state.events],
        }));
      }
    } catch (e) {
      console.error('Error replanning tasks:', e);
    }
  },

  addStudioMessage: (msg: StudioMessage) => {
    const pid = msg.projectId || get().selectedProjectId || 'proj-1';
    set((state) => {
      const currentList = state.projectStudioMessages[pid] || [];
      if (currentList.some((m) => m.id === msg.id)) return state;
      const updatedList = [...currentList, msg];
      const isSelected = state.selectedProjectId === pid;
      return {
        projectStudioMessages: {
          ...state.projectStudioMessages,
          [pid]: updatedList,
        },
        ...(isSelected ? { studioMessages: updatedList } : {}),
      };
    });
  },

  sendStudioMessage: async (text: string) => {
    const pid = get().selectedProjectId || 'proj-1';
    const userMsg: StudioMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      senderName: 'Engineering Director',
      role: 'Human Director',
      avatar: 'HD',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const thinkingMsgId = `msg-think-${Date.now()}`;
    const thinkingMsg: StudioMessage = {
      id: thinkingMsgId,
      sender: 'marcus',
      senderName: 'Dr. Marcus Cole',
      role: 'Principal Software Architect',
      avatar: 'MC',
      content: `Evaluating architectural impact of directive: "${text}"...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentList = get().projectStudioMessages[pid] || [];
    const updatedMessages = [...currentList, userMsg, thinkingMsg];

    set((state) => ({
      studioMessages: updatedMessages,
      projectStudioMessages: {
        ...state.projectStudioMessages,
        [pid]: updatedMessages,
      },
    }));

    // Save to DB in background
    fetch(`${BACKEND_URL}/api/projects/studio-messages?projectId=${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userMsg),
    }).catch((err) => console.warn('Failed to persist studio message to DB:', err));

    try {
      await get().replanTasks(text);

      const currentTasks = get().stagedTasks;
      const updatedMsg: StudioMessage = {
        id: thinkingMsgId,
        sender: 'marcus',
        senderName: 'Dr. Marcus Cole',
        role: 'Principal Software Architect',
        avatar: 'MC',
        content: `Directive incorporated into execution DAG. I have calibrated ${currentTasks.length} stages to reflect: "${text}". All dependencies, tools, and roles have been verified.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        systemNote: `⚡ ${currentTasks.length} Stages aligned with acceptance criteria. Ready for mobilization.`,
      };

      const finalized = (get().projectStudioMessages[pid] || []).map((m) => (m.id === thinkingMsgId ? updatedMsg : m));
      set((state) => ({
        studioMessages: finalized,
        projectStudioMessages: {
          ...state.projectStudioMessages,
          [pid]: finalized,
        },
      }));

      fetch(`${BACKEND_URL}/api/projects/studio-messages?projectId=${pid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMsg),
      }).catch((err) => console.warn('Failed to persist Marcus message to DB:', err));
    } catch (e) {
      set((state) => ({
        studioMessages: state.studioMessages.map((m) =>
          m.id === thinkingMsgId
            ? {
                ...m,
                content: `Directive noted: "${text}". Please review the updated blueprint parameters.`,
              }
            : m
        ),
      }));
    }
  },

  updateStagedTask: (taskId: string, patch: Partial<Task>) => {
    const pid = get().selectedProjectId || 'proj-1';
    set((state) => {
      const updated = state.stagedTasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t));
      return {
        stagedTasks: updated,
        projectStagedTasks: {
          ...state.projectStagedTasks,
          [pid]: updated,
        },
      };
    });
  },

  addStagedTask: (task: Task) => {
    const pid = get().selectedProjectId || 'proj-1';
    set((state) => {
      const updated = [...state.stagedTasks, task];
      return {
        stagedTasks: updated,
        projectStagedTasks: {
          ...state.projectStagedTasks,
          [pid]: updated,
        },
      };
    });
  },

  removeStagedTask: (taskId: string) => {
    const pid = get().selectedProjectId || 'proj-1';
    set((state) => {
      const updated = state.stagedTasks.filter((t) => t.id !== taskId);
      return {
        stagedTasks: updated,
        projectStagedTasks: {
          ...state.projectStagedTasks,
          [pid]: updated,
        },
      };
    });
  },

  launchPlan: async () => {
    try {
      const staged = get().stagedTasks;
      if (staged.length === 0) return;
      const pid = get().selectedProjectId || 'proj-1';

      const res = await fetch(`${BACKEND_URL}/api/projects/launch-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: staged }),
      });
      if (!res.ok) throw new Error(`Launch plan failed: ${res.statusText}`);
      const launched: Task[] = await res.json();

      const newTasksMap = { ...get().tasks };
      (launched || []).forEach((t) => {
        newTasksMap[t.id] = t;
      });

      const event: SystemEvent = {
        id: `evt-${Date.now()}`,
        type: 'plan.launched',
        source: 'Human Director',
        message: `Dispatched ${launched.length} verified engineering milestones to execution pipeline.`,
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        tasks: newTasksMap,
        stagedTasks: [],
        draftBlueprint: null,
        projectStagedTasks: {
          ...state.projectStagedTasks,
          [pid]: [],
        },
        isPlanVerificationModalOpen: false,
        isSpecStudioOpen: false,
        isBRDModalOpen: false,
        events: [event, ...state.events],
      }));
    } catch (e) {
      console.error('Error launching plan:', e);
    }
  },

  assignTaskToAgent: async (taskId: string, agentId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, agentId }),
      });
      if (!res.ok) throw new Error(`Assign task failed: ${res.statusText}`);
      const updatedTask: Task = await res.json();
      set((state) => ({
        tasks: { ...state.tasks, [updatedTask.id]: updatedTask },
      }));
    } catch (e) {
      console.error('Error assigning task to agent:', e);
    }
  },

  fetchProjectEpics: async (projectId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/epics?projectId=${projectId}`);
      if (res.ok) {
        const epics: Epic[] = await res.json();
        set((state) => ({
          projectEpics: { ...state.projectEpics, [projectId]: epics || [] },
        }));
      }
    } catch (e) {
      console.error('Error fetching project epics:', e);
    }
  },

  updateProjectEpics: async (projectId: string, epics: Epic[]) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/epics?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(epics),
      });
      if (res.ok) {
        const saved: Epic[] = await res.json();
        set((state) => ({
          projectEpics: { ...state.projectEpics, [projectId]: saved || epics },
        }));
      }
    } catch (e) {
      console.error('Error updating project epics:', e);
    }
  },

  fetchProjectStudioMessages: async (projectId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/studio-messages?projectId=${projectId}`);
      if (res.ok) {
        const msgs: StudioMessage[] = await res.json();
        set((state) => ({
          projectStudioMessages: { ...state.projectStudioMessages, [projectId]: msgs || [] },
          ...(state.selectedProjectId === projectId ? { studioMessages: msgs || [] } : {}),
        }));
      }
    } catch (e) {
      console.error('Error fetching studio messages:', e);
    }
  },

  fetchProjectStagedTasks: async (projectId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/staged-tasks?projectId=${projectId}`);
      if (res.ok) {
        const tasks: Task[] = await res.json();
        set((state) => ({
          projectStagedTasks: { ...state.projectStagedTasks, [projectId]: tasks || [] },
          ...(state.selectedProjectId === projectId ? { stagedTasks: tasks || [] } : {}),
        }));
      }
    } catch (e) {
      console.error('Error fetching project staged tasks:', e);
    }
  },

  fetchClusterStatus: async () => {
    try {
      const pid = get().selectedProjectId;
      const res = await fetch(`${BACKEND_URL}/api/v1/cluster/status?projectId=${pid}`);
      if (!res.ok) return;
      const data: ClusterStatus = await res.json();
      set({ clusterStatus: data });
    } catch (e) {
      console.error('Error fetching cluster status:', e);
    }
  },

  fetchClusterWorkloads: async (namespace?: string) => {
    try {
      const pid = get().selectedProjectId;
      const targetNs = namespace || `agentforge-${pid}-dev`.toLowerCase();
      const res = await fetch(`${BACKEND_URL}/api/v1/cluster/workloads?projectId=${pid}&namespace=${targetNs}`);
      if (!res.ok) return;
      const data: LiveWorkloads = await res.json();
      set({ liveWorkloads: data });
    } catch (e) {
      console.error('Error fetching cluster workloads:', e);
    }
  },

  fetchPodLogs: async (podName: string, namespace?: string) => {
    try {
      set({ activePodLogs: { podName, logs: 'Connecting to live container pod logs stream...', isLoading: true } });
      const pid = get().selectedProjectId;
      const targetNs = namespace || `agentforge-${pid}-dev`.toLowerCase();
      const res = await fetch(`${BACKEND_URL}/api/v1/cluster/logs?pod=${encodeURIComponent(podName)}&namespace=${encodeURIComponent(targetNs)}&projectId=${pid}&tail=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ activePodLogs: { podName, logs: data.logs || 'No log stream output available.', isLoading: false } });
    } catch (e: any) {
      set({ activePodLogs: { podName, logs: `Failed to load container logs: ${e.message}`, isLoading: false } });
    }
  },

  provisionNamespace: async (projectId: string, environment = 'dev', cpuLimit = '2', memLimit = '4Gi') => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/cluster/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, environment, cpu_limit: cpuLimit, memory_limit: memLimit }),
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchClusterWorkloads();
        return { success: true, message: `Namespace ${data.namespace} provisioned with quotas.` };
      }
      return { success: false, message: data.error || 'Failed to provision namespace' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  deployToCluster: async (projectId: string, environment = 'dev') => {
    set({ isDeployingCluster: true });
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/cluster/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, environment, timeout: 90 }),
      });
      const data = await res.json();
      if (data.health_report) {
        set((state) => ({
          deploymentHealthReports: {
            ...state.deploymentHealthReports,
            [projectId]: data.health_report,
          },
        }));
      }
      if (data.success) {
        set({ liveWorkloads: data.workloads });
        await get().fetchClusterStatus();
        await get().fetchClusterHealth(projectId, data.namespace || undefined, environment);
        return { success: true, message: `Deployed manifests to ${data.namespace} and verified rollout!` };
      }
      return { success: false, message: data.error || 'Deployment failed' };
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      set({ isDeployingCluster: false });
    }
  },

  // Feature 1A & 1C Actions
  fetchProjectCredentials: async (projectId: string) => {
    try {
      const pid = projectId || get().selectedProjectId || 'proj-1';
      const res = await fetch(`${BACKEND_URL}/api/credentials?projectId=${encodeURIComponent(pid)}`);
      if (res.ok) {
        const creds = await res.json();
        set((state) => ({
          credentials: { ...state.credentials, [pid]: creds || [] },
        }));
        return creds || [];
      }
      return [];
    } catch (e) {
      console.error('Error fetching credentials:', e);
      return [];
    }
  },

  updateCredentialStatus: async (projectId: string, credId: string, status: 'pending' | 'stub' | 'confirmed') => {
    const pid = projectId || get().selectedProjectId || 'proj-1';
    set((state) => {
      const current = state.credentials[pid] || [];
      const updated = current.map((c) => (c.id === credId ? { ...c, status } : c));
      return { credentials: { ...state.credentials, [pid]: updated } };
    });
    try {
      await fetch(`${BACKEND_URL}/api/credentials?projectId=${encodeURIComponent(pid)}&credId=${encodeURIComponent(credId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error('Error updating credential status:', e);
    }
  },

  validateCredentialsForDeploy: async (projectId: string, env = 'dev') => {
    try {
      const pid = projectId || get().selectedProjectId || 'proj-1';
      const res = await fetch(`${BACKEND_URL}/api/credentials/validate?projectId=${encodeURIComponent(pid)}&env=${encodeURIComponent(env)}`);
      if (res.ok) {
        return await res.json();
      }
      return { blocked: false, warnings: [], blockers: [] };
    } catch (e) {
      console.error('Error validating credentials:', e);
      return { blocked: false, warnings: [], blockers: [] };
    }
  },

  fetchClusterHealth: async (projectId: string, namespace?: string, env = 'dev') => {
    try {
      const pid = projectId || get().selectedProjectId || 'proj-1';
      const targetNs = namespace || `agentforge-${pid}-${env}`.toLowerCase();
      const res = await fetch(`${BACKEND_URL}/api/cluster/health-check?projectId=${encodeURIComponent(pid)}&namespace=${encodeURIComponent(targetNs)}&environment=${encodeURIComponent(env)}`);
      if (res.ok) {
        const report = await res.json();
        set((state) => ({
          deploymentHealthReports: {
            ...state.deploymentHealthReports,
            [pid]: report,
          },
        }));
        return report;
      }
      return null;
    } catch (e) {
      console.error('Error fetching cluster health:', e);
      return null;
    }
  },

  // Feature 3 Actions
  fetchModelCatalogue: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/models`);
      if (res.ok) {
        const catalogue: ModelInfo[] = await res.json();
        set({ modelCatalogue: catalogue });
        return catalogue;
      }
      return [];
    } catch (e) {
      console.error('Error fetching model catalogue:', e);
      return [];
    }
  },

  fetchCostProjection: async (agentId: string, newModel: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(agentId)}/cost-projection?newModel=${encodeURIComponent(newModel)}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Error projecting cost delta:', e);
      return null;
    }
  },

  updateAgentConfig: async (agentId: string, update: AgentConfigUpdate) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        const updatedAgent: Agent = await res.json();
        set((state) => ({
          agents: { ...state.agents, [agentId]: updatedAgent },
          events: [
            {
              id: `evt-${Date.now()}`,
              type: 'agent.updated',
              source: 'Human Operator',
              message: `Reconfigured agent "${updatedAgent.name}" (Model: ${updatedAgent.model})`,
              timestamp: new Date().toISOString(),
            },
            ...state.events,
          ],
        }));
        return updatedAgent;
      }
      return null;
    } catch (e) {
      console.error('Error updating agent config:', e);
      return null;
    }
  },
}));

