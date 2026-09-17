import { create } from 'zustand';
import { Agent, Task, Project, Incident, HumanApproval, APMMetrics, SystemEvent } from '../types';

export type ViewMode = '3D_OFFICE' | 'KANBAN_DAG' | 'APM_INFRA' | 'SPLIT_VIEW' | 'SERVICE_ACCOUNTS';
export type CameraPreset = 'ALL' | 'DEVELOPMENT' | 'QA' | 'DEVOPS' | 'ARCHITECTURE' | 'INCIDENT_ROOM' | 'SERVER_ROOM';
export type Theme = 'dark' | 'light';

interface State {
  // Data
  agents: Record<string, Agent>;
  tasks: Record<string, Task>;
  projects: Record<string, Project>;
  incidents: Record<string, Incident>;
  approvals: Record<string, HumanApproval>;
  events: SystemEvent[];
  metrics: APMMetrics;

  // UI state
  theme: Theme;
  viewMode: ViewMode;
  cameraPreset: CameraPreset;
  selectedAgentId: string | null;
  selectedProjectId: string;
  activeApprovalModal: HumanApproval | null;
  isConnected: boolean;

  // Modals & Staged Plan State
  isCreateProjectModalOpen: boolean;
  isBRDModalOpen: boolean;
  isPlanVerificationModalOpen: boolean;
  draftBlueprint: any | null;
  stagedTasks: Task[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  selectAgent: (id: string | null) => void;
  selectProject: (id: string) => void;
  setCreateProjectModalOpen: (open: boolean) => void;
  setBRDModalOpen: (open: boolean) => void;
  setPlanVerificationModalOpen: (open: boolean) => void;
  createProject: (data: Partial<Project>) => Promise<void>;
  analyzeBRD: (payload: { projectId: string; title: string; content: string; supplementaryNotes?: string }) => Promise<void>;
  replanTasks: (prompt: string) => Promise<void>;
  updateStagedTask: (taskId: string, patch: Partial<Task>) => void;
  addStagedTask: (task: Task) => void;
  removeStagedTask: (taskId: string) => void;
  launchPlan: () => Promise<void>;
  initWebSocket: () => void;
  decomposeGoal: (goal: string) => Promise<void>;
  triggerIncident: (title?: string, severity?: string) => Promise<void>;
  resolveIncident: (id: string) => Promise<void>;
  decideApproval: (id: string, approved: boolean) => Promise<void>;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  sendAgentInstruction: (agentId: string, instruction: string) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

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

  theme: getInitialTheme(),
  viewMode: 'SPLIT_VIEW',
  cameraPreset: 'ALL',
  selectedAgentId: null,
  selectedProjectId: 'proj-1',
  activeApprovalModal: null,
  isConnected: false,

  // Modals & Staged Plan State
  isCreateProjectModalOpen: false,
  isBRDModalOpen: false,
  isPlanVerificationModalOpen: false,
  draftBlueprint: null,
  stagedTasks: [],

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
  selectProject: (selectedProjectId) => set({ selectedProjectId }),
  setCreateProjectModalOpen: (isCreateProjectModalOpen) => set({ isCreateProjectModalOpen }),
  setBRDModalOpen: (isBRDModalOpen) => set({ isBRDModalOpen }),
  setPlanVerificationModalOpen: (isPlanVerificationModalOpen) => set({ isPlanVerificationModalOpen }),

  initWebSocket: () => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log('[AgentForge WS] Connected to backend event stream');
          set({ isConnected: true });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.action === 'SNAPSHOT') {
              set({
                agents: data.agents || {},
                tasks: data.tasks || {},
                projects: data.projects || {},
                incidents: data.incidents || {},
                events: data.events || [],
                metrics: data.metrics || get().metrics,
              });
            } else if (data.action === 'AGENT_UPDATE') {
              set((state) => ({
                agents: { ...state.agents, [data.agent.id]: data.agent },
              }));
            } else if (data.action === 'TASK_UPDATE') {
              set((state) => ({
                tasks: { ...state.tasks, [data.task.id]: data.task },
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
            } else if (data.action === 'INCIDENT_ALERT') {
              set((state) => ({
                incidents: { ...state.incidents, [data.incident.id]: data.incident },
              }));
            } else if (data.action === 'APPROVAL_REQUESTED') {
              set((state) => ({
                approvals: { ...state.approvals, [data.approval.id]: data.approval },
                activeApprovalModal: data.approval,
              }));
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
          (tasksList || []).forEach((t: Task) => { tasksMap[t.id] = t; });
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
      tasks.forEach((t) => { updatedTasks[t.id] = t; });
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
    try {
      await fetch(`${BACKEND_URL}/api/incidents/resolve/${id}`, { method: 'POST' });
      const incs = { ...get().incidents };
      delete incs[id];
      set({ incidents: incs, cameraPreset: 'ALL' });
    } catch (e) {
      console.error('Error resolving incident:', e);
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

  sendAgentInstruction: async (agentId: string, instruction: string) => {
    const ag = get().agents[agentId];
    if (!ag) return;
    try {
      const newEvent: SystemEvent = {
        id: `evt-${Date.now()}`,
        type: 'agent.instruction',
        source: 'Human Operator',
        message: `Instructed ${ag.name} (${ag.role}): "${instruction}"`,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        events: [newEvent, ...state.events],
        agents: {
          ...state.agents,
          [agentId]: {
            ...ag,
            state: 'THINKING',
            activeAction: `Executing instruction: "${instruction.slice(0, 30)}..."`,
          },
        },
      }));

      const res = await fetch(`${BACKEND_URL}/api/agents/${agentId}/instruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
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

  analyzeBRD: async (payload: { projectId: string; title: string; content: string; supplementaryNotes?: string }) => {
    try {
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
        }),
      });
      if (!res.ok) throw new Error(`BRD analysis failed: ${res.statusText}`);
      const data = await res.json();

      const rawTasks = data.proposed_tasks || data.tasks || [];
      const staged: Task[] = rawTasks.map((t: any, idx: number) => ({
        id: t.id || `task-${Date.now()}-${idx + 1}`,
        projectId: t.projectId || payload.projectId,
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

      const event: SystemEvent = {
        id: `evt-${Date.now()}`,
        type: 'brd.analyzed',
        source: 'Orion Spark & Dr. Marcus Cole',
        message: `BRD "${payload.title}" decomposed into ${staged.length} engineering milestones for review.`,
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        draftBlueprint: data,
        stagedTasks: staged,
        isBRDModalOpen: false,
        isPlanVerificationModalOpen: true,
        events: [event, ...state.events],
      }));
    } catch (e) {
      console.error('Error analyzing BRD:', e);
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

  updateStagedTask: (taskId: string, patch: Partial<Task>) => {
    set((state) => ({
      stagedTasks: state.stagedTasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
    }));
  },

  addStagedTask: (task: Task) => {
    set((state) => ({
      stagedTasks: [...state.stagedTasks, task],
    }));
  },

  removeStagedTask: (taskId: string) => {
    set((state) => ({
      stagedTasks: state.stagedTasks.filter((t) => t.id !== taskId),
    }));
  },

  launchPlan: async () => {
    try {
      const staged = get().stagedTasks;
      if (staged.length === 0) return;

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
        isPlanVerificationModalOpen: false,
        events: [event, ...state.events],
      }));
    } catch (e) {
      console.error('Error launching plan:', e);
    }
  },
}));
