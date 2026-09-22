export type AgentState = 
  | 'IDLE'
  | 'THINKING'
  | 'WORKING'
  | 'WAITING'
  | 'BLOCKED'
  | 'FAILED'
  | 'COMPLETED'
  | 'COMMUNICATING'
  | 'WAITING_APPROVAL'
  | 'TRANSITING';

export type TaskStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'ASSIGNED'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'REVIEW'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  department: string;
  model: string;
  provider: string; // "" = no override, use global default; else "gemini" | "ollama" | "nvidia"
  systemPrompt: string;
  skills: string[];
  tools: string[];
  state: AgentState;
  currentTaskId?: string;
  currentProject?: string;
  position: Vector3;
  deskPosition: Vector3;
  zone: string; // "development", "qa", "devops", "architecture", "incident_room", "server_room", "management", "security", "database"
  totalTokens: number;
  estimatedCost: number;
  successRate: number;
  activeAction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  assignedTo?: string;
  dependencies: string[];
  parentTaskId?: string;
  requiredRole: string;
  skills: string[];
  tools: string[];
  progress: number;
  logs: string[];
  output?: string;
  artifacts?: string[];
  branch?: string;
  prUrl?: string;
  requiresApproval?: boolean;
  errorDetails?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  building: string;
  techStack: string[];
  repositoryUrl?: string;
  targetBranch?: string;
  status: string;
  progress: number;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  message: string;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface Incident {
  id: string;
  projectId: string;
  title: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3';
  status: 'DETECTED' | 'INVESTIGATING' | 'IDENTIFIED' | 'RESOLVED';
  description: string;
  assignedSre?: string;
  rootCause?: string;
  mitigation?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface HumanApproval {
  id: string;
  taskId: string;
  agentId: string;
  actionType: string;
  description: string;
  diffPreview?: string;
  prUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface APMMetrics {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  apiLatencyMs: number;
  errorRatePercent: number;
  activeAgents: number;
  runningTasks: number;
  blockedTasks: number;
  activeIncidents: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface ModelRef {
  provider: string;
  model: string;
}

export interface AvailableModelEntry {
  provider: string;
  model: string;
  label: string;
}

export interface ModelCatalog {
  default: ModelRef;
  available_models: AvailableModelEntry[];
}
