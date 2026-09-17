package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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
		projects = append(projects, p)
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

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Post(pythonURL+"/api/analyze-brd", "application/json", r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to contact analysis engine: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
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

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Post(pythonURL+"/api/replan", "application/json", r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to replan with architect: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
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

	launched, err := h.orchestrator.LaunchPlan(req.Tasks)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

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
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"agentId": agentID,
		"reply":   reply,
	})
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
		tasks = append(tasks, t)
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
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
}

func (h *APIHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := Upgrade(w, r)
	if err != nil {
		http.Error(w, "Failed to upgrade to websocket: "+err.Error(), http.StatusBadRequest)
		return
	}
	h.hub.RegisterWS(conn)

	// Send initial snapshot
	h.orchestrator.mu.RLock()
	snapshot, _ := json.Marshal(map[string]interface{}{
		"action":    "SNAPSHOT",
		"agents":    h.orchestrator.agents,
		"tasks":     h.orchestrator.tasks,
		"projects":  h.orchestrator.projects,
		"events":    h.orchestrator.events,
		"incidents": h.orchestrator.incidents,
		"metrics":   h.orchestrator.metrics,
	})
	h.orchestrator.mu.RUnlock()
	_ = conn.WriteText(snapshot)

	// Read loop
	go func() {
		defer h.hub.UnregisterWS(conn)
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
				}
			}
		}
	}()
}

func (h *APIHandler) HandleSSE(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
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
	snapshot, _ := json.Marshal(map[string]interface{}{
		"action":    "SNAPSHOT",
		"agents":    h.orchestrator.agents,
		"tasks":     h.orchestrator.tasks,
		"projects":  h.orchestrator.projects,
		"events":    h.orchestrator.events,
		"incidents": h.orchestrator.incidents,
		"metrics":   h.orchestrator.metrics,
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
