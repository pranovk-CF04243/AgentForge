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
	Provider       string     `json:"provider"` // "" = no override, use global default; else "gemini"|"ollama"|"nvidia"
	SystemPrompt   string     `json:"systemPrompt"`
	Skills         []string   `gorm:"serializer:json" json:"skills"`
	Tools          []string   `gorm:"serializer:json" json:"tools"`
	State          AgentState `json:"state"`
	CurrentTaskID  *string    `json:"currentTaskId,omitempty"`
	CurrentProject *string    `json:"currentProject,omitempty"`
	Position       Vector3    `gorm:"serializer:json" json:"position"`
	TargetPosition *Vector3   `gorm:"serializer:json" json:"targetPosition,omitempty"`
	DeskPosition   Vector3    `gorm:"serializer:json" json:"deskPosition"`
	Zone           string     `json:"zone"`
	TotalTokens    int64      `json:"totalTokens"`
	EstimatedCost  float64    `json:"estimatedCost"`
	BankedSurplus  int64      `json:"bankedSurplus"`
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
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
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

// BudgetPool persists the shared "crisis pool" of leftover tokens that any
// agent may draw a capped top-up from when its own per-task budget runs out.
// A single row (ID "global") is used; see backend/budget_config.go.
type BudgetPool struct {
	ID     string `gorm:"primaryKey" json:"id"`
	Tokens int64  `json:"tokens"`
}

// BudgetTopupRequest is sent by the Python agent-runtime to
// /api/internal/request-budget-topup when an agent's own token allotment for
// the current task has been exhausted mid-execution.
type BudgetTopupRequest struct {
	TaskID          string `json:"task_id"`
	AgentID         string `json:"agent_id"`
	RequestedTokens int64  `json:"requested_tokens"`
}

// BudgetTopupResponse reports how many tokens were actually granted from the
// shared crisis pool (capped per backend/budget_config.go's CrisisPoolConfig)
// and how much the pool has left afterward.
type BudgetTopupResponse struct {
	GrantedTokens int64 `json:"granted_tokens"`
	PoolRemaining int64 `json:"pool_remaining"`
}

// ModelRef identifies an LLM by provider + model name, e.g.
// {"gemini", "gemini-2.5-flash"}. Used both for the global default and for
// an agent's per-agent override (see backend/model_catalog.go).
type ModelRef struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

// AvailableModelEntry is one selectable catalog entry surfaced to the
// frontend's model dropdowns.
type AvailableModelEntry struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Label    string `json:"label"`
}

// ModelCatalogResponse is served by GET /api/config/models.
type ModelCatalogResponse struct {
	Default         ModelRef               `json:"default"`
	AvailableModels []AvailableModelEntry  `json:"available_models"`
}

// UpdateAgentModelRequest is the body for PATCH /api/agents/{id}/model.
// Provider and Model both empty means "clear override, use global default".
type UpdateAgentModelRequest struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

// UpdateDefaultModelRequest is the body for PUT /api/config/models/default.
type UpdateDefaultModelRequest struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}
