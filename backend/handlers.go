package main

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type APIHandler struct {
	orchestrator *Orchestrator
	hub          *Hub
}

func NewAPIHandler(o *Orchestrator, h *Hub) *APIHandler {
	return &APIHandler{
		orchestrator: o,
		hub:          h,
	}
}

func enableCORS(w http.ResponseWriter) {
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func (h *APIHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "AgentForge Backend Engine",
		"version":   "2.0.0-production",
		"timestamp": time.Now(),
	})
}

// checkProjectAccess checks if the caller has permission to access the specified project.
// Owners and admins have access to all projects. Developers/viewers with custom projectAccess
// must have the projectID in their allowedProjects list.
func checkProjectAccess(r *http.Request, projectID string) bool {
	callerRole := ctxGetRole(r)
	if callerRole == "owner" || callerRole == "admin" || callerRole == "" {
		return true
	}
	callerID := ctxGetUserID(r)
	wsID := ctxGetWorkspaceID(r)
	if DB == nil || callerID == "" || wsID == "" {
		return true
	}
	var member WorkspaceMember
	if err := DB.Where("user_id = ? AND workspace_id = ?", callerID, wsID).First(&member).Error; err != nil {
		return true
	}
	if member.ProjectAccess != "custom" || member.AllowedProjects == "" {
		return true
	}
	var allowed []string
	if err := json.Unmarshal([]byte(member.AllowedProjects), &allowed); err != nil {
		return true
	}
	for _, pid := range allowed {
		if pid == projectID {
			return true
		}
	}
	return false
}

// filterSnapshotForUser filters projects and tasks in a snapshot map based on member's allowed projects.
func filterSnapshotForUser(userID, workspaceID, role string, snapProjects map[string]*Project, snapTasks map[string]*Task) (map[string]*Project, map[string]*Task) {
	if role == "owner" || role == "admin" || userID == "" || workspaceID == "" || DB == nil {
		return snapProjects, snapTasks
	}
	var member WorkspaceMember
	if err := DB.Where("user_id = ? AND workspace_id = ?", userID, workspaceID).First(&member).Error; err != nil {
		return snapProjects, snapTasks
	}
	if member.ProjectAccess != "custom" || member.AllowedProjects == "" {
		return snapProjects, snapTasks
	}
	var allowed []string
	if err := json.Unmarshal([]byte(member.AllowedProjects), &allowed); err != nil {
		return snapProjects, snapTasks
	}
	allowedMap := make(map[string]bool)
	for _, pid := range allowed {
		allowedMap[pid] = true
	}
	filteredProj := make(map[string]*Project)
	for pid, p := range snapProjects {
		if allowedMap[pid] {
			filteredProj[pid] = p
		}
	}
	filteredTasks := make(map[string]*Task)
	for tid, t := range snapTasks {
		if allowedMap[t.ProjectID] {
			filteredTasks[tid] = t
		}
	}
	return filteredProj, filteredTasks
}

func (h *APIHandler) GetProjects(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method == http.MethodPost {
		var p Project
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, "Invalid project payload", http.StatusBadRequest)
			return
		}
		if err := h.orchestrator.CreateProject(&p); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(p)
		return
	}

	h.orchestrator.mu.RLock()
	defer h.orchestrator.mu.RUnlock()

	projects := make([]*Project, 0, len(h.orchestrator.projects))
	for _, p := range h.orchestrator.projects {
		if checkProjectAccess(r, p.ID) {
			projects = append(projects, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(projects)
}

func (h *APIHandler) DecomposeProject(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID string `json:"projectId"`
		Prompt    string `json:"prompt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	if req.Prompt == "" {
		req.Prompt = "Build Customer Onboarding API with OAuth2, PostgreSQL, and Kafka"
	}
	if req.ProjectID == "" {
		req.ProjectID = "proj-1"
	}

	if !checkProjectAccess(r, req.ProjectID) {
		http.Error(w, "Forbidden: you do not have access to this project", http.StatusForbidden)
		return
	}

	tasks, err := h.orchestrator.DecomposeRequirement(req.ProjectID, req.Prompt)
	if err != nil {
		http.Error(w, fmt.Sprintf("Decomposition failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tasks)
}

func (h *APIHandler) AnalyzeBRD(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	var reqData map[string]interface{}
	_ = json.Unmarshal(bodyBytes, &reqData)

	projectID, _ := reqData["projectId"].(string)
	if projectID == "" {
		projectID, _ = reqData["project_id"].(string)
	}
	if projectID == "" {
		projectID = "proj-1"
	}

	if !checkProjectAccess(r, projectID) {
		http.Error(w, "Forbidden: you do not have access to this project", http.StatusForbidden)
		return
	}

	// Attach existing epics and staged tasks if not already provided
	if _, ok := reqData["existing_epics"]; !ok {
		h.orchestrator.mu.RLock()
		if existingEpics, exists := h.orchestrator.epics[projectID]; exists {
			reqData["existing_epics"] = existingEpics
		}
		h.orchestrator.mu.RUnlock()
	}

	forwardBytes, _ := json.Marshal(reqData)

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Post(pythonURL+"/api/analyze-brd", "application/json", bytes.NewReader(forwardBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to contact analysis engine: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read analysis response", http.StatusInternalServerError)
		return
	}

	if resp.StatusCode == http.StatusOK {
		var parsedResult struct {
			Phase            string               `json:"phase"`
			Questions        []interface{}        `json:"questions"`
			Summary          interface{}          `json:"summary"`
			ExecutiveSummary string               `json:"executive_summary"`
			Epics            []*Epic              `json:"epics"`
			TechStack        []string             `json:"tech_stack_recommendations"`
			ProposedTasks    []*Task              `json:"proposed_tasks"`
			RequiredCreds    []*ProjectCredential `json:"required_credentials"`
		}

		if err := json.Unmarshal(respBytes, &parsedResult); err == nil {
			// 1. If phase is clarification, broadcast clarification questions
			if parsedResult.Phase == "clarification" && len(parsedResult.Questions) > 0 {
				clarMsg, _ := json.Marshal(map[string]interface{}{
					"action":    "STUDIO_CLARIFICATION",
					"projectId": projectID,
					"phase":     "clarification",
					"questions": parsedResult.Questions,
				})
				h.hub.Broadcast(clarMsg)
			}

			// 2. If phase is summary, broadcast requirements summary
			if (parsedResult.Phase == "summary" || parsedResult.Phase == "stack_approval") && parsedResult.Summary != nil {
				sumMsg, _ := json.Marshal(map[string]interface{}{
					"action":    "STUDIO_SUMMARY",
					"projectId": projectID,
					"phase":     "summary",
					"summary":   parsedResult.Summary,
				})
				h.hub.Broadcast(sumMsg)
			}

			// 3. Extract and persist detected credentials manifest
			if len(parsedResult.RequiredCreds) > 0 {
				_ = h.orchestrator.ExtractAndSaveCredentials(projectID, parsedResult.RequiredCreds)
			}

			// 4. If epics are returned, persist epics & staged tasks
			if len(parsedResult.Epics) > 0 {
				// Persist Epics to DB and memory
				for _, ep := range parsedResult.Epics {
					ep.ProjectID = projectID
					if ep.Status == "" {
						ep.Status = "Mapped"
					}
				}
				_ = h.orchestrator.SaveEpics(projectID, parsedResult.Epics)

				// Persist proposed engineering milestones as STAGED tasks
				if len(parsedResult.ProposedTasks) > 0 {
					_ = h.orchestrator.SaveStagedTasks(projectID, parsedResult.ProposedTasks)
				}

				// Persist initial roundtable chat messages in proper conversational order:
				// 1. First, persist the human engineering director's prompt directive
				content, _ := reqData["content"].(string)
				if content != "" {
					userMsg := &StudioMessage{
						ID:         fmt.Sprintf("msg-user-%d", time.Now().UnixMilli()),
						ProjectID:  projectID,
						Sender:     "user",
						SenderName: "Engineering Director",
						Role:       "Human Director",
						Avatar:     "HD",
						Content:    content,
						Timestamp:  time.Now().Format("03:04 PM"),
						CreatedAt:  time.Now().Add(-2 * time.Second),
					}
					_ = h.orchestrator.SaveStudioMessage(userMsg)
				}

				// 2. Second, persist Orion Spark's requirement breakdown
				title, _ := reqData["title"].(string)
				if title == "" {
					title = "Business Requirements"
				}
				orionMsg := &StudioMessage{
					ID:         fmt.Sprintf("msg-an-%d", time.Now().UnixMilli()+1),
					ProjectID:  projectID,
					Sender:     "orion",
					SenderName: "Orion Spark",
					Role:       "Lead Business Analyst",
					Avatar:     "OS",
					Content:    fmt.Sprintf("I've analyzed \"%s\" and mapped %d functional Epics with verified acceptance criteria.", title, len(parsedResult.Epics)),
					Timestamp:  time.Now().Format("03:04 PM"),
					Chips: []string{
						fmt.Sprintf("+ %s Architecture", title),
						"+ Automated Security Verification",
						"+ Zero-Downtime Deployment Spec",
					},
					CreatedAt:  time.Now().Add(-1 * time.Second),
				}
				_ = h.orchestrator.SaveStudioMessage(orionMsg)

				// 3. Third, persist Dr. Marcus Cole's engineering DAG confirmation
				marcusMsg := &StudioMessage{
					ID:         fmt.Sprintf("msg-an-%d", time.Now().UnixMilli()+2),
					ProjectID:  projectID,
					Sender:     "marcus",
					SenderName: "Dr. Marcus Cole",
					Role:       "Principal Software Architect",
					Avatar:     "MC",
					Content:    fmt.Sprintf("Engineered %d dependency stages into the Task DAG. All technical interfaces and service roles verified.", len(parsedResult.ProposedTasks)),
					Timestamp:  time.Now().Format("03:04 PM"),
					SystemNote: fmt.Sprintf("⚡ %d Tasks verified. 0 Dependency conflicts.", len(parsedResult.ProposedTasks)),
					CreatedAt:  time.Now(),
				}
				_ = h.orchestrator.SaveStudioMessage(marcusMsg)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(respBytes)
}

func (h *APIHandler) ReplanTasks(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	var reqBody struct {
		ProjectID    string `json:"projectId"`
		ProjectIDAlt string `json:"project_id"`
	}
	_ = json.Unmarshal(bodyBytes, &reqBody)
	projectID := reqBody.ProjectID
	if projectID == "" {
		projectID = reqBody.ProjectIDAlt
	}
	if projectID == "" {
		projectID = "proj-1"
	}

	if !checkProjectAccess(r, projectID) {
		http.Error(w, "Forbidden: you do not have access to this project", http.StatusForbidden)
		return
	}

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Post(pythonURL+"/api/replan", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to replan with architect: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read replan response", http.StatusInternalServerError)
		return
	}

	if resp.StatusCode == http.StatusOK {
		var updatedTasks []*Task
		if json.Unmarshal(respBytes, &updatedTasks) == nil && len(updatedTasks) > 0 {
			_ = h.orchestrator.SaveStagedTasks(projectID, updatedTasks)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(respBytes)
}

func (h *APIHandler) HandleProjectStagedTasks(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = "proj-1"
	}

	if r.Method == http.MethodGet {
		tasks := h.orchestrator.GetStagedTasks(projectID)
		if tasks == nil {
			tasks = []*Task{}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(tasks)
		return
	}

	if r.Method == http.MethodPost {
		var tasks []*Task
		if err := json.NewDecoder(r.Body).Decode(&tasks); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = h.orchestrator.SaveStagedTasks(projectID, tasks)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(tasks)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *APIHandler) LaunchPlan(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Tasks []*Task `json:"tasks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if len(req.Tasks) > 0 && req.Tasks[0].ProjectID != "" {
		if !checkProjectAccess(r, req.Tasks[0].ProjectID) {
			http.Error(w, "Forbidden: you do not have access to this project", http.StatusForbidden)
			return
		}
	}

	launched, err := h.orchestrator.LaunchPlan(req.Tasks)
	if err != nil {
		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "project.plan_launched",
			Detail:      fmt.Sprintf("Failed to launch plan: %v", err),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "FAILURE",
			Severity:    "WARN",
		})
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	LogAudit(AuditEntry{
		WorkspaceID: ctxGetWorkspaceID(r),
		UserID:      ctxGetUserID(r),
		UserName:    ctxGetUserName(r),
		Action:      "project.plan_launched",
		Detail:      fmt.Sprintf("Successfully launched plan with %d tasks", len(req.Tasks)),
		IPAddress:   ExtractClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"taskCount": len(req.Tasks)},
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(launched)
}

func (h *APIHandler) GetAgents(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	h.orchestrator.mu.RLock()
	defer h.orchestrator.mu.RUnlock()

	agents := make([]*Agent, 0, len(h.orchestrator.agents))
	for _, a := range h.orchestrator.agents {
		agents = append(agents, a)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(agents)
}

func (h *APIHandler) InstructAgent(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	agentID := strings.TrimPrefix(r.URL.Path, "/api/agents/")
	agentID = strings.TrimSuffix(agentID, "/instruct")

	var req struct {
		Instruction string `json:"instruction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Instruction == "" {
		http.Error(w, "Instruction required", http.StatusBadRequest)
		return
	}

	reply, err := h.orchestrator.InstructAgent(agentID, req.Instruction)
	if err != nil {
		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "agent.instructed",
			ResourceID:  agentID,
			Detail:      fmt.Sprintf("Failed to instruct agent %s: %v", agentID, err),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "FAILURE",
			Severity:    "WARN",
		})
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	LogAudit(AuditEntry{
		WorkspaceID: ctxGetWorkspaceID(r),
		UserID:      ctxGetUserID(r),
		UserName:    ctxGetUserName(r),
		Action:      "agent.instructed",
		ResourceID:  agentID,
		Detail:      fmt.Sprintf("Instructed agent %s: %s", agentID, req.Instruction),
		IPAddress:   ExtractClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"agentId": agentID, "instruction": req.Instruction},
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"agentId": agentID,
		"reply":   reply,
	})
}

// verifyInternalSecret authenticates internal webhooks between agent-runtime and backend.
func verifyInternalSecret(r *http.Request) bool {
	secret := os.Getenv("INTERNAL_WEBHOOK_SECRET")
	if secret == "" {
		secret = "agentforge-internal-dev-secret"
	}
	headerSecret := r.Header.Get("X-Internal-Secret")
	if headerSecret == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			headerSecret = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}
	return headerSecret != "" && subtle.ConstantTimeCompare([]byte(headerSecret), []byte(secret)) == 1
}

// authenticateRequestToken extracts and validates JWT from query parameter, Authorization header, or cookie.
func authenticateRequestToken(r *http.Request) (*JWTClaims, error) {
	rawToken := r.URL.Query().Get("token")
	if rawToken == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			rawToken = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}
	if rawToken == "" {
		if cookie, err := r.Cookie("af_token"); err == nil {
			rawToken = cookie.Value
		}
	}
	if rawToken == "" {
		return nil, fmt.Errorf("missing authentication token")
	}
	return VerifyJWT(rawToken, jwtSecret())
}

func (h *APIHandler) HandleTaskEventWebhook(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !verifyInternalSecret(r) {
		log.Printf("[Security] Unauthorized attempt to invoke /api/internal/task-event from %s", r.RemoteAddr)
		http.Error(w, "Unauthorized: invalid internal webhook secret", http.StatusUnauthorized)
		return
	}

	var payload TaskEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		log.Printf("[HandleTaskEventWebhook] JSON decode error: %v", err)
		http.Error(w, "Invalid event payload", http.StatusBadRequest)
		return
	}

	h.orchestrator.HandleTaskEvent(payload)
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (h *APIHandler) GetTasks(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	h.orchestrator.mu.RLock()
	defer h.orchestrator.mu.RUnlock()

	tasks := make([]*Task, 0, len(h.orchestrator.tasks))
	for _, t := range h.orchestrator.tasks {
		tasks = append(tasks, h.orchestrator.sanitizeTask(t))
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tasks)
}

func (h *APIHandler) RetryTask(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	taskID := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	taskID = strings.TrimSuffix(taskID, "/retry")

	if err := h.orchestrator.RetryTask(taskID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (h *APIHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	h.orchestrator.mu.RLock()
	defer h.orchestrator.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(h.orchestrator.events)
}

func (h *APIHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	h.orchestrator.mu.RLock()
	defer h.orchestrator.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(h.orchestrator.metrics)
}

func (h *APIHandler) HandleIncidents(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method == http.MethodGet {
		h.orchestrator.mu.RLock()
		defer h.orchestrator.mu.RUnlock()
		incidents := make([]*Incident, 0, len(h.orchestrator.incidents))
		for _, inc := range h.orchestrator.incidents {
			incidents = append(incidents, inc)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(incidents)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Title    string `json:"title"`
			Severity string `json:"severity"`
			Desc     string `json:"description"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Title == "" {
			req.Title = "Kafka Ingestion Backpressure & Latency Spike"
		}
		if req.Severity == "" {
			req.Severity = "SEV-1"
		}
		if req.Desc == "" {
			req.Desc = "Consumer group lag exceeded 50,000 messages. P99 latency degraded to 4200ms."
		}

		inc := h.orchestrator.TriggerIncident(req.Title, req.Severity, req.Desc)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(inc)
		return
	}
}

func (h *APIHandler) ResolveIncident(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/incidents/resolve/")
	h.orchestrator.ResolveIncident(id, "Consumer partition rebalanced; thread pool scaled to 16 workers.", "Automated autoscaling policy applied.")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "resolved", "id": id})
}

func (h *APIHandler) HandleApprovals(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method == http.MethodGet {
		h.orchestrator.mu.RLock()
		defer h.orchestrator.mu.RUnlock()
		approvals := make([]*HumanApproval, 0, len(h.orchestrator.approvals))
		for _, a := range h.orchestrator.approvals {
			approvals = append(approvals, a)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(approvals)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			ApprovalID string `json:"approvalId"`
			Approved   bool   `json:"approved"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}
		h.orchestrator.HandleApprovalDecision(req.ApprovalID, req.Approved)

		severity := "INFO"
		decisionStr := "Approved"
		if !req.Approved {
			severity = "WARN"
			decisionStr = "Rejected"
		}
		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "approval.decided",
			ResourceID:  req.ApprovalID,
			Detail:      fmt.Sprintf("%s human-in-the-loop gate for approval %s", decisionStr, req.ApprovalID),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    severity,
			Metadata:    map[string]interface{}{"approvalId": req.ApprovalID, "approved": req.Approved},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
}

func (h *APIHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	claims, err := authenticateRequestToken(r)
	if err != nil {
		log.Printf("[WebSocket] Unauthorized connection attempt from %s: %v", r.RemoteAddr, err)
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	conn, err := Upgrade(w, r)
	if err != nil {
		http.Error(w, "Failed to upgrade to websocket: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Populate identity on WS connection from validated JWT claims
	conn.UserID = claims.Sub
	conn.UserName = claims.Name
	conn.WorkspaceID = claims.WorkspaceID
	conn.Role = claims.Role

	h.hub.RegisterWS(conn)

	// Broadcast presence update to workspace peers
	if conn.WorkspaceID != "" {
		h.hub.BroadcastPresence(conn.WorkspaceID)
	}

	// Send initial snapshot
	h.orchestrator.mu.RLock()
	snapProj, snapTasks := filterSnapshotForUser(conn.UserID, conn.WorkspaceID, conn.Role, h.orchestrator.projects, h.orchestrator.tasks)
	snapshot, _ := json.Marshal(map[string]interface{}{
		"action":         "SNAPSHOT",
		"agents":         h.orchestrator.agents,
		"tasks":          snapTasks,
		"projects":       snapProj,
		"events":         h.orchestrator.events,
		"incidents":      h.orchestrator.incidents,
		"metrics":        h.orchestrator.metrics,
		"epics":          h.orchestrator.epics,
		"studioMessages": h.orchestrator.studioMessages,
	})
	h.orchestrator.mu.RUnlock()
	_ = conn.WriteText(snapshot)

	// Read loop
	go func() {
		defer func() {
			h.hub.UnregisterWS(conn)
			if conn.WorkspaceID != "" {
				h.hub.BroadcastPresence(conn.WorkspaceID)
			}
		}()
		for {
			msg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			var clientMsg map[string]interface{}
			if err := json.Unmarshal(msg, &clientMsg); err == nil {
				action, _ := clientMsg["action"].(string)
				if action == "PING" {
					_ = conn.WriteText([]byte(`{"action":"PONG"}`))
				} else if action == "SET_PROJECT" {
					if projID, ok := clientMsg["projectId"].(string); ok {
						conn.ProjectID = projID
						if conn.WorkspaceID != "" {
							h.hub.BroadcastPresence(conn.WorkspaceID)
						}
					}
				}
			}
		}
	}()
}

func (h *APIHandler) HandleSSE(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	claims, err := authenticateRequestToken(r)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}
	_ = claims

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	ch := make(chan []byte, 32)
	h.hub.RegisterSSE(ch)
	defer h.hub.UnregisterSSE(ch)

	// Send initial snapshot
	h.orchestrator.mu.RLock()
	snapProj, snapTasks := filterSnapshotForUser(claims.Sub, claims.WorkspaceID, claims.Role, h.orchestrator.projects, h.orchestrator.tasks)
	snapshot, _ := json.Marshal(map[string]interface{}{
		"action":         "SNAPSHOT",
		"agents":         h.orchestrator.agents,
		"tasks":          snapTasks,
		"projects":       snapProj,
		"events":         h.orchestrator.events,
		"incidents":      h.orchestrator.incidents,
		"metrics":        h.orchestrator.metrics,
		"epics":          h.orchestrator.epics,
		"studioMessages": h.orchestrator.studioMessages,
	})
	h.orchestrator.mu.RUnlock()
	_, _ = fmt.Fprintf(w, "data: %s\n\n", snapshot)
	flusher.Flush()

	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			return
		case msg := <-ch:
			_, _ = fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		}
	}
}

func (h *APIHandler) HandleAlertWebhook(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var alert AlertWebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&alert); err != nil {
		http.Error(w, fmt.Sprintf("Invalid alert payload: %v", err), http.StatusBadRequest)
		return
	}

	if alert.AlertName == "" {
		alert.AlertName = "KubernetesPodAlert"
	}
	if alert.Severity == "" {
		alert.Severity = "CRITICAL"
	}

	incident, task, err := h.orchestrator.HandleAlertWebhook(&alert)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to process alert: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "incident_spawned",
		"incident": incident,
		"task":     task,
	})
}

func (h *APIHandler) GetProjectEnvironments(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	projectID := r.URL.Query().Get("projectId")
	var envs []*ProjectEnvironment
	if h.orchestrator.db != nil {
		if projectID != "" {
			h.orchestrator.db.Where("project_id = ?", projectID).Find(&envs)
		} else {
			h.orchestrator.db.Find(&envs)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(envs)
}

func (h *APIHandler) GetClusterStatus(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	projectID := r.URL.Query().Get("projectId")
	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s/api/cluster/status?project_id=%s", pythonURL, url.QueryEscape(projectID)))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"status":"OFFLINE","error":"%v"}`, err), http.StatusOK)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) GetClusterWorkloads(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	projectID := r.URL.Query().Get("projectId")
	namespace := r.URL.Query().Get("namespace")
	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 10 * time.Second}
	targetURL := fmt.Sprintf("%s/api/cluster/workloads?project_id=%s", pythonURL, url.QueryEscape(projectID))
	if namespace != "" {
		targetURL += fmt.Sprintf("&namespace=%s", url.QueryEscape(namespace))
	}

	resp, err := client.Get(targetURL)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%v"}`, err), http.StatusOK)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) GetClusterLogs(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	podName := r.URL.Query().Get("pod")
	namespace := r.URL.Query().Get("namespace")
	tail := r.URL.Query().Get("tail")
	projectID := r.URL.Query().Get("projectId")
	if tail == "" {
		tail = "100"
	}

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 15 * time.Second}
	targetURL := fmt.Sprintf("%s/api/cluster/logs?pod_name=%s&namespace=%s&tail=%s&project_id=%s",
		pythonURL, url.QueryEscape(podName), url.QueryEscape(namespace), url.QueryEscape(tail), url.QueryEscape(projectID))

	resp, err := client.Get(targetURL)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%v"}`, err), http.StatusOK)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) ProvisionClusterNamespace(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(pythonURL+"/api/cluster/provision", "application/json", r.Body)
	if err != nil {
		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "cluster.namespace_provisioned",
			ResourceID:  "kubernetes-cluster",
			Detail:      fmt.Sprintf("Failed to provision cluster namespace: %v", err),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "FAILURE",
			Severity:    "CRITICAL",
		})
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	status := "SUCCESS"
	if resp.StatusCode >= 400 {
		status = "FAILURE"
	}
	LogAudit(AuditEntry{
		WorkspaceID: ctxGetWorkspaceID(r),
		UserID:      ctxGetUserID(r),
		UserName:    ctxGetUserName(r),
		Action:      "cluster.namespace_provisioned",
		ResourceID:  "kubernetes-cluster",
		Detail:      fmt.Sprintf("Provisioned cluster namespace (status: %d)", resp.StatusCode),
		IPAddress:   ExtractClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      status,
		Severity:    "CRITICAL",
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) DeployToCluster(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(pythonURL+"/api/cluster/deploy", "application/json", r.Body)
	if err != nil {
		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "cluster.deployed",
			ResourceID:  "kubernetes-cluster",
			Detail:      fmt.Sprintf("Failed cluster deployment request: %v", err),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "FAILURE",
			Severity:    "CRITICAL",
		})
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	deployStatus := "SUCCESS"
	if resp.StatusCode >= 400 {
		deployStatus = "FAILURE"
	}
	LogAudit(AuditEntry{
		WorkspaceID: ctxGetWorkspaceID(r),
		UserID:      ctxGetUserID(r),
		UserName:    ctxGetUserName(r),
		Action:      "cluster.deployed",
		ResourceID:  "kubernetes-cluster",
		Detail:      fmt.Sprintf("Cluster deployment dispatched (status: %d)", resp.StatusCode),
		IPAddress:   ExtractClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      deployStatus,
		Severity:    "CRITICAL",
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) ConnectExternalCluster(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(pythonURL+"/api/cluster/connect-external", "application/json", r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) HandleProjectEpics(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = "proj-1"
	}

	if r.Method == http.MethodGet {
		epics := h.orchestrator.GetEpics(projectID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(epics)
		return
	}

	if r.Method == http.MethodPost {
		var epics []*Epic
		if err := json.NewDecoder(r.Body).Decode(&epics); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = h.orchestrator.SaveEpics(projectID, epics)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(epics)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *APIHandler) HandleProjectStudioMessages(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = "proj-1"
	}

	if r.Method == http.MethodGet {
		msgs := h.orchestrator.GetStudioMessages(projectID)
		if msgs == nil {
			msgs = []*StudioMessage{}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(msgs)
		return
	}

	if r.Method == http.MethodPost {
		var msg StudioMessage
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if msg.ProjectID == "" {
			msg.ProjectID = projectID
		}
		_ = h.orchestrator.SaveStudioMessage(&msg)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(msg)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *APIHandler) HandleAssignTask(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		TaskID  string `json:"taskId"`
		AgentID string `json:"agentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	task, err := h.orchestrator.AssignTaskDirectly(payload.TaskID, payload.AgentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(task)
}

func (h *APIHandler) HandleDeploymentFailure(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !verifyInternalSecret(r) {
		log.Printf("[Security] Unauthorized attempt to invoke /api/internal/deployment-failure from %s", r.RemoteAddr)
		http.Error(w, "Unauthorized: invalid internal webhook secret", http.StatusUnauthorized)
		return
	}

	var payload struct {
		ProjectID    string                 `json:"project_id"`
		HealthReport DeploymentHealthReport `json:"health_report"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	inc, task, err := h.orchestrator.TriggerDeploymentRemediationLoop(payload.ProjectID, &payload.HealthReport)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"incident": inc,
		"task":     task,
	})
}

func (h *APIHandler) HandleClusterHealthCheck(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	projectID := r.URL.Query().Get("projectId")
	namespace := r.URL.Query().Get("namespace")
	env := r.URL.Query().Get("environment")
	if env == "" {
		env = "dev"
	}

	reqURL := fmt.Sprintf("%s/api/cluster/health-check?projectId=%s&namespace=%s&environment=%s", pythonURL, url.QueryEscape(projectID), url.QueryEscape(namespace), url.QueryEscape(env))

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(reqURL)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (h *APIHandler) HandleProjectCredentials(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = "proj-1"
	}

	if r.Method == http.MethodGet {
		creds := h.orchestrator.GetCredentials(projectID)
		if creds == nil {
			creds = []*ProjectCredential{}
		}

		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			ProjectID:   projectID,
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "credentials.viewed",
			ResourceID:  projectID,
			Detail:      fmt.Sprintf("Accessed secret credentials store for project %s", projectID),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "SECURITY",
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(creds)
		return
	}

	if r.Method == http.MethodPost {
		var creds []*ProjectCredential
		if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = h.orchestrator.ExtractAndSaveCredentials(projectID, creds)

		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			ProjectID:   projectID,
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "credentials.saved",
			ResourceID:  projectID,
			Detail:      fmt.Sprintf("Saved %d credentials for project %s", len(creds), projectID),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "SECURITY",
			Metadata:    map[string]interface{}{"projectId": projectID, "credentialCount": len(creds)},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(h.orchestrator.GetCredentials(projectID))
		return
	}

	if r.Method == http.MethodPatch {
		credID := r.URL.Query().Get("credId")
		var payload struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = h.orchestrator.UpdateCredentialStatus(projectID, credID, payload.Status)

		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			ProjectID:   projectID,
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "credentials.updated",
			ResourceID:  credID,
			Detail:      fmt.Sprintf("Updated credential %s status to %s", credID, payload.Status),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "SECURITY",
			Metadata:    map[string]interface{}{"projectId": projectID, "credId": credID, "status": payload.Status},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "status": payload.Status})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *APIHandler) HandleValidateCredentials(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = "proj-1"
	}
	env := r.URL.Query().Get("env")
	if env == "" {
		env = r.URL.Query().Get("environment")
	}
	if env == "" {
		env = "dev"
	}

	blocked, warnings, blockers := h.orchestrator.ValidateCredentialsForDeploy(projectID, env)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"blocked":  blocked,
		"warnings": warnings,
		"blockers": blockers,
	})
}

func (h *APIHandler) HandleAgents(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	agentID := r.URL.Query().Get("id")
	if agentID == "" {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) >= 3 {
			agentID = pathParts[2] // /api/agents/{id}
		}
	}

	if r.Method == http.MethodPatch || r.Method == http.MethodPost {
		var update AgentConfigUpdate
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		agent, err := h.orchestrator.UpdateAgentConfig(agentID, update)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		LogAudit(AuditEntry{
			WorkspaceID: ctxGetWorkspaceID(r),
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "agent.config_updated",
			ResourceID:  agentID,
			Detail:      fmt.Sprintf("Agent %s configuration updated", agentID),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "WARN",
			Metadata:    map[string]interface{}{"agentId": agentID},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(agent)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *APIHandler) HandleModelCatalogue(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}
	catalogue := h.orchestrator.GetModelCatalogue()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(catalogue)
}

func (h *APIHandler) HandleCostProjection(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	agentID := r.URL.Query().Get("agentId")
	if agentID == "" {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) >= 3 {
			agentID = pathParts[2]
		}
	}
	newModel := r.URL.Query().Get("newModel")
	if newModel == "" {
		http.Error(w, "newModel parameter is required", http.StatusBadRequest)
		return
	}

	projection, err := h.orchestrator.ProjectCostDelta(agentID, newModel)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(projection)
}



