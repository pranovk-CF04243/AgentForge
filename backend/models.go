package main

import (
	"encoding/json"
	"strings"
	"time"
)

// AgentState represents the operational status of an AI agent
type AgentState string

const (
	StateIdle            AgentState = "IDLE"
	StateThinking        AgentState = "THINKING"
	StateWorking         AgentState = "WORKING"
	StateWaiting         AgentState = "WAITING"
	StateBlocked         AgentState = "BLOCKED"
	StateFailed          AgentState = "FAILED"
	StateCompleted       AgentState = "COMPLETED"
	StateCommunicating   AgentState = "COMMUNICATING"
	StateWaitingApproval AgentState = "WAITING_APPROVAL"
	StateTransiting      AgentState = "TRANSITING"
)

// TaskStatus represents the lifecycle of a task
type TaskStatus string

const (
	TaskPending         TaskStatus = "PENDING"
	TaskStaged          TaskStatus = "STAGED"
	TaskQueued          TaskStatus = "QUEUED"
	TaskAssigned        TaskStatus = "ASSIGNED"
	TaskRunning         TaskStatus = "RUNNING"
	TaskWaitingApproval TaskStatus = "WAITING_APPROVAL"
	TaskWaiting         TaskStatus = "WAITING"
	TaskBlocked         TaskStatus = "BLOCKED"
	TaskReview          TaskStatus = "REVIEW"
	TaskCompleted       TaskStatus = "COMPLETED"
	TaskFailed          TaskStatus = "FAILED"
	TaskCancelled       TaskStatus = "CANCELLED"
)

// Priority represents task priority
type Priority string

const (
	PriorityLow      Priority = "LOW"
	PriorityMedium   Priority = "MEDIUM"
	PriorityHigh     Priority = "HIGH"
	PriorityCritical Priority = "CRITICAL"
)

// Vector3 represents a 3D coordinate in the virtual office
type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Agent represents an AI digital employee
type Agent struct {
	ID             string     `gorm:"primaryKey" json:"id"`
	Name           string     `json:"name"`
	Role           string     `json:"role"`
	Description    string     `json:"description"`
	Department     string     `json:"department"`
	Model          string     `json:"model"`
	SystemPrompt   string     `json:"systemPrompt"`
	CustomPrompt   string     `gorm:"column:custom_prompt" json:"customPrompt,omitempty"`
	Skills         []string   `gorm:"serializer:json" json:"skills"`
	Tools          []string   `gorm:"serializer:json" json:"tools"`
	// AllowedRoles lists workspace member roles that can send instructions to this agent.
	// An empty list means only admin/owner can instruct. ["developer"] opens it to developers too.
	AllowedRoles   []string   `gorm:"serializer:json" json:"allowedRoles,omitempty"`
	State          AgentState `json:"state"`
	CurrentTaskID  *string    `json:"currentTaskId,omitempty"`
	CurrentProject *string    `json:"currentProject,omitempty"`
	Position       Vector3    `gorm:"serializer:json" json:"position"`
	TargetPosition *Vector3   `gorm:"serializer:json" json:"targetPosition,omitempty"`
	DeskPosition   Vector3    `gorm:"serializer:json" json:"deskPosition"`
	Zone           string     `json:"zone"`
	TotalTokens    int64      `json:"totalTokens"`
	EstimatedCost  float64    `json:"estimatedCost"`
	SuccessRate    float64    `json:"successRate"`
	ActiveAction   string     `json:"activeAction,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

// Task represents an engineering work unit
type Task struct {
	ID           string     `gorm:"primaryKey" json:"id"`
	ProjectID    string     `gorm:"index" json:"projectId"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Priority     Priority   `json:"priority"`
	Status       TaskStatus `gorm:"index" json:"status"`
	AssignedTo   *string    `gorm:"index" json:"assignedTo,omitempty"`
	EpicID       *string    `gorm:"index" json:"epicId,omitempty"`
	Dependencies []string   `gorm:"serializer:json" json:"dependencies"`
	ParentTaskID *string    `json:"parentTaskId,omitempty"`
	RequiredRole string     `json:"requiredRole"`
	Skills       []string   `gorm:"serializer:json" json:"skills"`
	Tools        []string   `gorm:"serializer:json" json:"tools"`
	Progress     int        `json:"progress"`
	Logs         []string   `gorm:"serializer:json" json:"logs"`
	Output       string     `json:"output,omitempty"`
	Artifacts    []string   `gorm:"serializer:json" json:"artifacts,omitempty"`
	Branch       string     `json:"branch,omitempty"`
	PRURL        string     `json:"prUrl,omitempty"`
	TokenUsage   int64      `json:"tokenUsage"`
	CostUSD      float64    `json:"costUsd"`
	ErrorDetails string     `json:"errorDetails,omitempty"`
	RequiresSign bool       `json:"requiresApproval"`
	// CreatedBy holds the UserID of the workspace member who created this task
	CreatedBy    string     `json:"createdBy,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

// Epic represents a functional high-level initiative or milestone parsed from BRD
type Epic struct {
	ID                 string    `gorm:"primaryKey" json:"id"`
	ProjectID          string    `gorm:"index" json:"projectId"`
	Title              string    `json:"title"`
	Description        string    `json:"description"`
	AcceptanceCriteria []string  `gorm:"serializer:json" json:"acceptance_criteria"`
	Status             string    `json:"status"` // e.g. "Mapped", "In Progress", "Complete"
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// StudioMessage represents a persisted roundtable discussion message in Specification Studio
type StudioMessage struct {
	ID         string    `gorm:"primaryKey" json:"id"`
	ProjectID  string    `gorm:"index" json:"projectId"`
	Sender     string    `json:"sender"`
	SenderName string    `json:"senderName"`
	Role       string    `json:"role"`
	Avatar     string    `json:"avatar"`
	Content    string    `json:"content"`
	Timestamp  string    `json:"timestamp"`
	Chips      []string  `gorm:"serializer:json" json:"chips,omitempty"`
	SystemNote string    `json:"systemNote,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Project represents a software engineering initiative
type Project struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Building      string    `json:"building"`
	TechStack     []string  `gorm:"serializer:json" json:"techStack"`
	RepositoryURL string    `json:"repositoryUrl,omitempty"`
	TargetBranch  string    `json:"targetBranch,omitempty"`
	Status        string    `json:"status"`
	Progress      int       `json:"progress"`
	AgentIDs      []string  `gorm:"serializer:json" json:"agentIds"`
	Epics         []Epic    `gorm:"foreignKey:ProjectID" json:"epics,omitempty"`
	// OwnerID is the UserID of the workspace member who created this project
	OwnerID       string    `gorm:"index" json:"ownerId,omitempty"`
	// WorkspaceID scopes this project to a workspace (multi-tenancy)
	WorkspaceID   string    `gorm:"index" json:"workspaceId,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// SystemEvent represents an event stream message
type SystemEvent struct {
	ID        string                 `gorm:"primaryKey" json:"id"`
	Type      string                 `json:"type"`
	Source    string                 `json:"source"`
	Message   string                 `json:"message"`
	Payload   map[string]interface{} `gorm:"serializer:json" json:"payload,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// Incident represents a production or pipeline failure
type Incident struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	ProjectID   string     `json:"projectId"`
	Title       string     `json:"title"`
	Severity    string     `json:"severity"`
	Status      string     `json:"status"`
	Description string     `json:"description"`
	AssignedSRE *string    `json:"assignedSre,omitempty"`
	RootCause   string     `json:"rootCause,omitempty"`
	Mitigation  string     `json:"mitigation,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	ResolvedAt  *time.Time `json:"resolvedAt,omitempty"`
}

// HumanApproval represents a blocked gate requiring user sign-off
type HumanApproval struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TaskID      string    `json:"taskId"`
	AgentID     string    `json:"agentId"`
	ActionType  string    `json:"actionType"`
	Description string    `json:"description"`
	DiffPreview string    `json:"diffPreview,omitempty"`
	PRURL       string    `json:"prUrl,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ProjectEnvironment represents an isolated deployment stage (dev, uat, prod)
type ProjectEnvironment struct {
	ID               string    `gorm:"primaryKey" json:"id"`
	ProjectID        string    `json:"projectId"`
	Environment      string    `json:"environment"` // "dev", "uat", "prod"
	ClusterType      string    `json:"clusterType"` // "direct_kubeconfig", "gitops_argocd"
	Namespace        string    `json:"namespace"`
	KubeConfig       string    `json:"kubeConfig,omitempty"`
	GitOpsRepoURL    string    `json:"gitOpsRepoUrl,omitempty"`
	RequiresApproval bool      `json:"requiresApproval"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// AlertWebhookPayload represents incoming alerts from Prometheus Alertmanager, Datadog, or K8s event exporters
type AlertWebhookPayload struct {
	AlertName   string                 `json:"alertname"`
	Severity    string                 `json:"severity"`
	ProjectID   string                 `json:"projectId"`
	Environment string                 `json:"environment"`
	PodName     string                 `json:"podName"`
	Namespace   string                 `json:"namespace"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// APMMetrics represents system & agent observability data

type APMMetrics struct {
	CPUUsagePercent    float64 `json:"cpuUsagePercent"`
	MemoryUsagePercent float64 `json:"memoryUsagePercent"`
	APILatencyMs       float64 `json:"apiLatencyMs"`
	ErrorRatePercent   float64 `json:"errorRatePercent"`
	ActiveAgents       int     `json:"activeAgents"`
	RunningTasks       int     `json:"runningTasks"`
	BlockedTasks       int     `json:"blockedTasks"`
	ActiveIncidents    int     `json:"activeIncidents"`
	TotalTokens        int64   `json:"totalTokens"`
	EstimatedCostUSD   float64 `json:"estimatedCostUsd"`
}

// FlexibleString unmarshals from strings, arrays, or objects safely
type FlexibleString string

func (fs *FlexibleString) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		*fs = ""
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		*fs = FlexibleString(s)
		return nil
	}
	var v interface{}
	if err := json.Unmarshal(b, &v); err == nil {
		switch val := v.(type) {
		case []interface{}:
			var sb strings.Builder
			for _, item := range val {
				if m, ok := item.(map[string]interface{}); ok {
					if text, ok := m["text"].(string); ok {
						sb.WriteString(text)
					} else {
						bytes, _ := json.Marshal(item)
						sb.WriteString(string(bytes))
					}
				} else if strVal, ok := item.(string); ok {
					sb.WriteString(strVal)
				} else {
					bytes, _ := json.Marshal(item)
					sb.WriteString(string(bytes))
				}
			}
			*fs = FlexibleString(sb.String())
			return nil
		default:
			bytes, _ := json.Marshal(val)
			*fs = FlexibleString(string(bytes))
			return nil
		}
	}
	*fs = FlexibleString(string(b))
	return nil
}

// Internal Task Event Webhook Payload from Python Agent Runtime
type TaskEventPayload struct {
	Type       string                 `json:"type"` // "token", "log", "step", "status", "completion", "error"
	TaskID     string                 `json:"task_id"`
	AgentID    string                 `json:"agent_id,omitempty"`
	Content    FlexibleString         `json:"content,omitempty"`
	Status     string                 `json:"status,omitempty"`
	Progress   int                    `json:"progress,omitempty"`
	TokensUsed int64                  `json:"tokens_used,omitempty"`
	CostUSD    float64                `json:"cost_usd,omitempty"`
	Artifacts  []string               `json:"artifacts,omitempty"`
	Branch     string                 `json:"branch,omitempty"`
	PRURL      string                 `json:"pr_url,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// Kubernetes Cluster & Workload Models

type ClusterNode struct {
	Name           string   `json:"name"`
	Ready          bool     `json:"ready"`
	Status         string   `json:"status"`
	Roles          []string `json:"roles"`
	Version        string   `json:"version"`
	OS             string   `json:"os"`
	CapacityCPU    string   `json:"capacity_cpu"`
	CapacityMemory string   `json:"capacity_memory"`
}

type ClusterStatusResponse struct {
	Status         string        `json:"status"`
	ClusterType    string        `json:"cluster_type"`
	Version        string        `json:"version"`
	Nodes          []ClusterNode `json:"nodes"`
	TotalNodes     int           `json:"total_nodes"`
	KubeconfigPath string        `json:"kubeconfig_path"`
	Error          string        `json:"error,omitempty"`
}

type LivePod struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Phase     string   `json:"phase"`
	Status    string   `json:"status"`
	Ready     string   `json:"ready"`
	IsReady   bool     `json:"is_ready"`
	Restarts  int      `json:"restarts"`
	Age       string   `json:"age"`
	Images    []string `json:"images"`
	PodIP     string   `json:"pod_ip"`
}

type LiveDeployment struct {
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Replicas          int    `json:"replicas"`
	ReadyReplicas     int    `json:"ready_replicas"`
	UpdatedReplicas   int    `json:"updated_replicas"`
	AvailableReplicas int    `json:"available_replicas"`
	Age               string `json:"age"`
}

type LiveService struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Type      string   `json:"type"`
	ClusterIP string   `json:"cluster_ip"`
	Ports     []string `json:"ports"`
	Age       string   `json:"age"`
}

type LiveWorkloadsResponse struct {
	Success     bool             `json:"success"`
	Namespace   string           `json:"namespace"`
	Pods        []LivePod        `json:"pods"`
	Deployments []LiveDeployment `json:"deployments"`
	Services    []LiveService    `json:"services"`
	Error       string           `json:"error,omitempty"`
}

type ProvisionNamespacePayload struct {
	ProjectID   string `json:"project_id"`
	Environment string `json:"environment,omitempty"`
	CPULimit    string `json:"cpu_limit,omitempty"`
	MemoryLimit string `json:"memory_limit,omitempty"`
}

type DeployClusterPayload struct {
	ProjectID   string `json:"project_id"`
	Environment string `json:"environment,omitempty"`
	Timeout     int    `json:"timeout,omitempty"`
}

// ProjectCredential represents an integration secret or connection configuration
type ProjectCredential struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	ProjectID    string    `gorm:"index" json:"projectId"`
	Name         string    `json:"name"`         // e.g. "POSTGRES_PASSWORD"
	Type         string    `json:"type"`         // env_var | k8s_secret | config_file
	Status       string    `json:"status"`       // pending | stub | confirmed
	Description  string    `json:"description"`
	ExampleValue string    `json:"exampleValue"` // safe placeholder, never the real secret
	IsRequired   bool      `json:"isRequired"`
	Integration  string    `json:"integration"`  // e.g. "PostgreSQL", "Stripe API", "Auth0"
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// DeploymentHealthReport represents the 3-stage post-deploy verification output
type DeploymentHealthReport struct {
	ProjectID           string   `json:"projectId"`
	Namespace           string   `json:"namespace"`
	Overall             string   `json:"overall"` // HEALTHY | DEGRADED | FAILED
	PodCheckPassed      bool     `json:"podCheckPassed"`
	LogScanPassed       bool     `json:"logScanPassed"`
	HealthProbePassed   bool     `json:"healthProbePassed"`
	ErrorExcerpts       []string `gorm:"serializer:json" json:"errorExcerpts"`
	ErrorClassification string   `json:"errorClassification"` // CrashLoop | ServiceLevel | Dependency | None
	RemediationRequired bool     `json:"remediationRequired"`
	RemediationAttempt  int      `json:"remediationAttempt"`
}

// ModelInfo represents a model in the static model catalogue
type ModelInfo struct {
	ID               string  `json:"id"`
	Provider         string  `json:"provider"`    // google | anthropic
	DisplayName      string  `json:"displayName"`
	SpeedRating      int     `json:"speedRating"` // 1-3
	QualityRating    int     `json:"qualityRating"` // 1-5
	InputPricePer1M  float64 `json:"inputPricePer1M"`  // USD
	OutputPricePer1M float64 `json:"outputPricePer1M"` // USD
}

// AgentConfigUpdate represents payload to update an agent's runtime configuration
type AgentConfigUpdate struct {
	Name         *string  `json:"name,omitempty"`
	Model        *string  `json:"model,omitempty"`
	CustomPrompt *string  `json:"customPrompt,omitempty"`
	Tools        []string `json:"tools,omitempty"`
}

// CostProjection represents projected 30-day costs comparing current and new models
type CostProjection struct {
	AgentID       string  `json:"agentId"`
	CurrentModel  string  `json:"currentModel"`
	NewModel      string  `json:"newModel"`
	TotalTokens   int64   `json:"totalTokens"`
	CurrentCost30 float64 `json:"currentCost30"`
	NewCost30     float64 `json:"newCost30"`
	CostDelta     float64 `json:"costDelta"`
}

// ─────────────────────────────────────────────────────
// User Management & Auth Models
// ─────────────────────────────────────────────────────

// User represents a platform account. PasswordHash is never serialised to JSON.
type User struct {
	ID           string     `gorm:"primaryKey" json:"id"`
	Email        string     `gorm:"uniqueIndex" json:"email"`
	Name         string     `json:"name"`
	AvatarURL    string     `json:"avatarUrl,omitempty"`
	PasswordHash string     `json:"-"`
	// GitHub OAuth fields — GitHubID is unique when set
	GitHubID     *string    `gorm:"uniqueIndex" json:"-"`
	GitHubLogin  string     `json:"githubLogin,omitempty"`
	IsActive     bool       `json:"isActive"`
	LastSeenAt   *time.Time `json:"lastSeenAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

// Workspace is the top-level tenant container for a team or organisation.
type Workspace struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Name      string    `json:"name"`
	Slug      string    `gorm:"uniqueIndex" json:"slug"`
	OwnerID           string    `json:"ownerId"`
	CustomPermissions string    `gorm:"type:text" json:"customPermissions,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// WorkspaceMember maps a User to a Workspace with a specific role.
// Roles: "owner" | "admin" | "developer" | "viewer"
type WorkspaceMember struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	WorkspaceID     string    `gorm:"index" json:"workspaceId"`
	UserID          string    `gorm:"index" json:"userId"`
	Role            string    `json:"role"`
	ProjectAccess   string    `gorm:"default:'all'" json:"projectAccess"` // "all" | "custom"
	AllowedProjects string    `gorm:"type:text" json:"allowedProjects,omitempty"` // JSON string array of project IDs e.g. ["proj-1","proj-2"]
	InvitedBy       string    `json:"invitedBy"`
	JoinedAt        time.Time `json:"joinedAt"`
}

// Invite holds a pending invite token so a new user can join a workspace.
type Invite struct {
	ID            string     `gorm:"primaryKey" json:"id"`
	WorkspaceID   string     `gorm:"index" json:"workspaceId"`
	Email         string     `json:"email"`
	Role          string     `json:"role"`
	Token         string     `gorm:"index" json:"token,omitempty"`
	TokenHash     string     `gorm:"index" json:"-"`
	OTPCodeHash   string     `json:"-"`
	OTPExpiresAt  *time.Time `json:"-"`
	OTPVerifiedAt *time.Time `json:"otpVerifiedAt,omitempty"`
	ProjectAccess string     `gorm:"default:'all'" json:"projectAccess"`
	AllowedProjects string   `gorm:"type:text" json:"allowedProjects,omitempty"`

	OTPTries      int        `json:"-"`
	InvitedBy     string     `json:"invitedBy"`
	ExpiresAt     time.Time  `json:"expiresAt"`
	UsedAt        *time.Time `json:"usedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// RefreshToken stores the SHA-256 hash of an issued refresh token for rotation.
type RefreshToken struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index" json:"userId"`
	TokenHash string    `gorm:"uniqueIndex" json:"-"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

// ActivityLog is an immutable audit record written on every significant action.
type ActivityLog struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	WorkspaceID string    `gorm:"index" json:"workspaceId"`
	ProjectID   string    `gorm:"index" json:"projectId,omitempty"`
	UserID      string    `gorm:"index" json:"userId"`
	UserName    string    `json:"userName"`
	// Action uses dot-notation: "project.created", "credentials.viewed", "approval.decided"
	Action      string    `gorm:"index" json:"action"`
	ResourceID  string    `json:"resourceId,omitempty"`
	Detail      string    `json:"detail,omitempty"`
	IPAddress   string    `gorm:"index" json:"ipAddress,omitempty"`
	UserAgent   string    `json:"userAgent,omitempty"`
	Status      string    `gorm:"index;default:SUCCESS" json:"status"`   // "SUCCESS" | "FAILURE"
	Severity    string    `gorm:"index;default:INFO" json:"severity"`     // "INFO" | "WARN" | "CRITICAL" | "SECURITY"
	Metadata    string    `gorm:"type:text" json:"metadata,omitempty"`     // JSON serialized metadata
	CreatedAt   time.Time `gorm:"index" json:"createdAt"`
}

// PresenceUser is a transient (non-DB) struct broadcast over WebSocket to show who is online.
type PresenceUser struct {
	UserID      string `json:"userId"`
	UserName    string `json:"userName"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	Role        string `json:"role"`
	ProjectID   string `json:"projectId,omitempty"`
	ProjectName string `json:"projectName,omitempty"`
}
