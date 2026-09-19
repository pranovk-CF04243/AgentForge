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
  | 'STAGED'
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
  systemPrompt: string;
  customPrompt?: string;
  skills: string[];
  tools: string[];
  allowedRoles?: string[];
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
  epicId?: string;
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
  createdBy?: string;
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
  ownerId?: string;
  workspaceId?: string;
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

export interface DeploymentHealthReport {
  projectId: string;
  namespace: string;
  overall: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  podCheckPassed: boolean;
  logScanPassed: boolean;
  healthProbePassed: boolean;
  errorExcerpts: string[];
  errorClassification: string;
  remediationRequired: boolean;
  remediationAttempt: number;
  podDetails?: Array<{
    name: string;
    phase: string;
    ready: boolean;
    restarts: number;
    reasons: string[];
  }>;
}

export interface ClarificationQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  defaultOption?: string;
  impact?: string;
}

export interface RequirementsSummary {
  title: string;
  executive_summary: string;
  chosen_tech_stack: string[];
  confirmed_decisions: Array<{
    category: string;
    decision: string;
  }>;
  stub_assumptions: Array<{
    category: string;
    assumption: string;
  }>;
}

export interface ProjectCredential {
  id: string;
  projectId: string;
  name: string;
  type: 'env_var' | 'k8s_secret' | 'config_file' | string;
  status: 'pending' | 'stub' | 'confirmed';
  description: string;
  exampleValue: string;
  isRequired: boolean;
  integration: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModelInfo {
  id: string;
  provider: 'google' | 'anthropic';
  displayName: string;
  speedRating: number;
  qualityRating: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export interface AgentConfigUpdate {
  name?: string;
  model?: string;
  customPrompt?: string;
  tools?: string[];
}

export interface CostProjection {
  agentId: string;
  currentModel: string;
  newModel: string;
  totalTokens: number;
  currentCost30: number;
  newCost30: number;
  costDelta: number;
}

