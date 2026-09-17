package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

type Orchestrator struct {
	mu           sync.RWMutex
	hub          *Hub
	db           *gorm.DB
	agents       map[string]*Agent
	projects     map[string]*Project
	tasks        map[string]*Task
	incidents    map[string]*Incident
	approvals    map[string]*HumanApproval
	events       []SystemEvent
	metrics      APMMetrics
	activeTicker *time.Ticker
}

func NewOrchestrator(hub *Hub, db *gorm.DB) *Orchestrator {
	o := &Orchestrator{
		hub:       hub,
		db:        db,
		agents:    make(map[string]*Agent),
		projects:  make(map[string]*Project),
		tasks:     make(map[string]*Task),
		incidents: make(map[string]*Incident),
		approvals: make(map[string]*HumanApproval),
		events:    make([]SystemEvent, 0),
		metrics: APMMetrics{
			ActiveAgents:    14,
			RunningTasks:    0,
			BlockedTasks:    0,
			ActiveIncidents: 0,
		},
	}

	o.initializeData()
	return o
}

func (o *Orchestrator) initializeData() {
	o.mu.Lock()
	defer o.mu.Unlock()

	// 1. Load or Seed Projects
	var projectCount int64
	if o.db != nil {
		o.db.Model(&Project{}).Count(&projectCount)
	}
	if projectCount == 0 {
		p1 := &Project{
			ID:            "proj-1",
			Name:          "AgentForge Platform",
			Description:   "Autonomous AI Engineering Workspace & Command Center",
			Building:      "Building A",
			TechStack:     []string{"Go", "Python", "React", "PostgreSQL", "LangGraph"},
			RepositoryURL: "https://github.com/agentforge/agentforge",
			TargetBranch:  "main",
			Status:        "ACTIVE",
			Progress:      0,
			AgentIDs:      []string{},
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if o.db != nil {
			o.db.Create(p1)
		}
		o.projects[p1.ID] = p1
	} else if o.db != nil {
		var projs []*Project
		o.db.Find(&projs)
		for _, p := range projs {
			o.projects[p.ID] = p
		}
	}

	// 2. Load or Seed 14 AI Digital Employees
	var agentCount int64
	if o.db != nil {
		o.db.Model(&Agent{}).Count(&agentCount)
	}
	if agentCount == 0 {
		o.seedDigitalEmployees()
	} else if o.db != nil {
		var dbAgents []*Agent
		o.db.Find(&dbAgents)
		for _, a := range dbAgents {
			o.agents[a.ID] = a
		}
	}

	// 3. Load Existing Tasks
	if o.db != nil {
		var dbTasks []*Task
		o.db.Find(&dbTasks)
		for _, t := range dbTasks {
			o.tasks[t.ID] = t
		}

		// Normalize agent states: reset any agent whose task is not actively running
		for _, a := range o.agents {
			if a.CurrentTaskID != nil {
				if t, ok := o.tasks[*a.CurrentTaskID]; !ok || t.Status != TaskRunning {
					a.CurrentTaskID = nil
					a.State = StateIdle
					a.ActiveAction = "Standing by"
					o.safeSave(a)
				}
			} else if a.State != StateIdle {
				a.State = StateIdle
				a.ActiveAction = "Standing by"
				o.safeSave(a)
			}
		}

		// 4. Load Existing Incidents
		var dbIncidents []*Incident
		o.db.Where("status != ?", "RESOLVED").Find(&dbIncidents)
		for _, inc := range dbIncidents {
			o.incidents[inc.ID] = inc
		}

		// 5. Load Existing Approvals
		var dbApprovals []*HumanApproval
		o.db.Where("status = ?", "PENDING").Find(&dbApprovals)
		for _, app := range dbApprovals {
			o.approvals[app.ID] = app
		}
	}

	o.recordEvent("system.init", "AgentForge Engine", fmt.Sprintf("AgentForge workspace ready with %d AI digital employees.", len(o.agents)))
}

func (o *Orchestrator) seedDigitalEmployees() {
		roles := []struct {
			ID        string
			Name      string
			Role      string
			Dept      string
			Zone      string
			Model     string
			Desk      Vector3
			Skills    []string
			Tools     []string
			SysPrompt string
		}{
			// Leadership Pod
			{
				ID: "agent-pm", Name: "Elena Vance", Role: "Project Manager", Dept: "Leadership", Zone: "leadership",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -4.5, Y: 0.0, Z: -4.5},
				Skills:    []string{"Sprint Planning", "Stakeholder Alignment", "Milestone Tracking", "Resource Allocation"},
				Tools:     []string{"read_file", "write_file"},
				SysPrompt: "You are Elena Vance, Lead Project Manager. Orchestrate scope, deliver milestones, manage risks, and translate user goals into actionable engineering deliverables.",
			},
			{
				ID: "agent-arch", Name: "Dr. Marcus Cole", Role: "Software Architect", Dept: "Leadership", Zone: "leadership",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -2.5, Y: 0.0, Z: -4.5},
				Skills:    []string{"System Architecture", "API Specifications", "Data Modeling", "Distributed Systems"},
				Tools:     []string{"read_file", "write_file", "run_command"},
				SysPrompt: "You are Dr. Marcus Cole, Principal Software Architect. Design clean, production-grade microservices, OpenAPI specifications, and scalable database schemas.",
			},
			{
				ID: "agent-doc", Name: "Seraphina Stone", Role: "Jira & Workflow Agent", Dept: "Leadership", Zone: "leadership",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -4.5, Y: 0.0, Z: -2.5},
				Skills:    []string{"Jira Automation", "Sprint Backlog", "Issue Triage", "Documentation"},
				Tools:     []string{"read_file", "write_file"},
				SysPrompt: "You are Seraphina Stone, Workflow Orchestrator. Maintain comprehensive technical documentation, changelogs, and workflow tracking.",
			},
			{
				ID: "agent-research", Name: "Orion Spark", Role: "Business Analyst (BA) Agent", Dept: "Leadership", Zone: "leadership",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -2.5, Y: 0.0, Z: -2.5},
				Skills:    []string{"User Story Mapping", "Acceptance Criteria", "Business Requirements"},
				Tools:     []string{"read_file", "write_file"},
				SysPrompt: "You are Orion Spark, Lead Business Analyst. Translate business goals into detailed user stories and verifiable acceptance criteria.",
			},

			// Engineering Pod
			{
				ID: "agent-backend", Name: "Kaelen Voss", Role: "Senior Developer", Dept: "Engineering", Zone: "engineering",
				Model: "gemini-2.5-flash", Desk: Vector3{X: 2.5, Y: 0.0, Z: -4.5},
				Skills:    []string{"Go", "Python", "PostgreSQL", "Kafka", "REST APIs", "Clean Architecture"},
				Tools:     []string{"run_command", "read_file", "write_file", "git_ops", "run_test_suite"},
				SysPrompt: "You are Kaelen Voss, Senior Backend Engineer. Implement resilient, tested, high-performance services and database migrations with zero tech debt.",
			},
			{
				ID: "agent-frontend", Name: "Aria Sterling", Role: "Junior Developer (Frontend)", Dept: "Engineering", Zone: "engineering",
				Model: "gemini-2.5-flash", Desk: Vector3{X: 4.5, Y: 0.0, Z: -4.5},
				Skills:    []string{"React 18", "TypeScript", "TailwindCSS", "State Management", "UI Components"},
				Tools:     []string{"run_command", "read_file", "write_file", "git_ops"},
				SysPrompt: "You are Aria Sterling, Frontend Developer. Build pixel-perfect, accessible, and reactive user interfaces using React, TypeScript, and modern component systems.",
			},
			{
				ID: "agent-mobile", Name: "Leo Chang", Role: "Junior Developer (Full-Stack)", Dept: "Engineering", Zone: "engineering",
				Model: "gemini-2.5-flash", Desk: Vector3{X: 3.5, Y: 0.0, Z: -2.5},
				Skills:    []string{"Node.js", "Python", "REST APIs", "Integration Testing", "Docker"},
				Tools:     []string{"run_command", "read_file", "write_file", "git_ops"},
				SysPrompt: "You are Leo Chang, Full-Stack Developer. Implement end-to-end integration hooks, utility scripts, and glue code across backend and frontend layers.",
			},

			// QA Pod
			{
				ID: "agent-qa", Name: "Sasha Quinn", Role: "Lead QA Engineer", Dept: "Quality Assurance", Zone: "qa",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -4.5, Y: 0.0, Z: 1.5},
				Skills:    []string{"Test Automation", "Regression Testing", "Chaos Engineering", "Integration Verification"},
				Tools:     []string{"run_command", "run_test_suite", "read_file", "write_file"},
				SysPrompt: "You are Sasha Quinn, Lead QA Engineer. Rigorously validate code using automated unit, integration, and contract tests. Catch all regressions and boundary flaws.",
			},
			{
				ID: "agent-reviewer", Name: "Victor Thorne", Role: "QA Automation Engineer", Dept: "Quality Assurance", Zone: "qa",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -2.5, Y: 0.0, Z: 1.5},
				Skills:    []string{"Automated Testing", "Code Quality Auditing", "SonarQube Standards", "Security Testing"},
				Tools:     []string{"run_command", "run_test_suite", "read_file"},
				SysPrompt: "You are Victor Thorne, QA Automation Specialist. Enforce strict code quality metrics, linting compliance, and automated stress testing.",
			},

			// DevOps & Infra Pod
			{
				ID: "agent-devops", Name: "Caleb Cruz", Role: "DevOps Engineer", Dept: "DevOps & Infrastructure", Zone: "devops",
				Model: "gemini-2.5-flash", Desk: Vector3{X: 2.5, Y: 0.0, Z: 1.5},
				Skills:    []string{"Docker", "Kubernetes", "GitOps", "CI/CD Pipelines", "Terraform"},
				Tools:     []string{"run_command", "read_file", "write_file", "git_ops", "create_github_pr"},
				SysPrompt: "You are Caleb Cruz, Principal DevOps Engineer. Automate containerized deployments, manage CI/CD pipelines, package artifacts, and create Pull Requests.",
			},
			{
				ID: "agent-sre", Name: "Jaxson Reed", Role: "Cloud SRE Engineer", Dept: "DevOps & Infrastructure", Zone: "devops",
				Model: "gemini-2.5-flash", Desk: Vector3{X: 4.5, Y: 0.0, Z: 1.5},
				Skills:    []string{"Site Reliability", "Incident Diagnostics", "Prometheus", "Log Triage", "Root Cause Analysis"},
				Tools:     []string{"run_command", "read_file", "write_file"},
				SysPrompt: "You are Jaxson Reed, Cloud SRE Engineer. Triage outages, trace distributed system latency, isolate root causes, and apply remediation scripts.",
			},

			// Support Pod
			{
				ID: "agent-sec", Name: "Cipher Vance", Role: "Senior Support Engineer", Dept: "Support & Operations", Zone: "support",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -3.5, Y: 0.0, Z: 4.5},
				Skills:    []string{"Tier-3 Escalation", "Security Forensics", "Log Forensics", "Customer Success"},
				Tools:     []string{"read_file", "run_command"},
				SysPrompt: "You are Cipher Vance, Senior Support & SecOps Engineer. Investigate critical operational tickets, examine error logs, and diagnose escalated system faults.",
			},
			{
				ID: "agent-db", Name: "Tariq Mansour", Role: "Junior Support Engineer", Dept: "Support & Operations", Zone: "support",
				Model: "gemini-2.5-flash", Desk: Vector3{X: -1.5, Y: 0.0, Z: 4.5},
				Skills:    []string{"Ticket Triage", "Bug Reproduction", "Knowledge Base Updates"},
				Tools:     []string{"read_file", "run_command"},
				SysPrompt: "You are Tariq Mansour, Support Engineer. Verify bug repro steps, catalog edge cases, and assist customer inquiries.",
			},

			// Analytics Pod
			{
				ID: "agent-data", Name: "Maya Lin", Role: "Project Analytics Specialist", Dept: "Project Analytics", Zone: "analytics",
				Model: "gemini-2.5-flash", Desk: Vector3{X: 2.5, Y: 0.0, Z: 4.5},
				Skills:    []string{"Velocity Metrics", "Token Usage APM", "Burndown Analysis", "Cost Optimization"},
				Tools:     []string{"read_file"},
				SysPrompt: "You are Maya Lin, Project Analytics Specialist. Deliver real-time intelligence on engineering velocity, token expenditure, and sprint completion risk.",
			},
		}

		for _, r := range roles {
			agent := &Agent{
				ID:           r.ID,
				Name:         r.Name,
				Role:         r.Role,
				Description:  r.SysPrompt,
				Department:   r.Dept,
				Model:        r.Model,
				SystemPrompt: r.SysPrompt,
				Skills:       r.Skills,
				Tools:        r.Tools,
				State:        StateIdle,
				Position:     r.Desk,
				DeskPosition: r.Desk,
				Zone:         r.Zone,
				TotalTokens:  0,
				EstimatedCost: 0.0,
				SuccessRate:  100.0,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			}
			o.safeCreate(agent)
			o.agents[agent.ID] = agent
		}
}

func (o *Orchestrator) recordEvent(eventType, source, message string) SystemEvent {
	ev := SystemEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		Type:      eventType,
		Source:    source,
		Message:   message,
		Timestamp: time.Now(),
	}
	o.safeCreate(&ev)
	o.events = append(o.events, ev)
	if len(o.events) > 100 {
		o.events = o.events[len(o.events)-100:]
	}

	data, _ := json.Marshal(map[string]interface{}{
		"action": "EVENT",
		"event":  ev,
	})
	o.hub.Broadcast(data)
	return ev
}

// StartEventLoop monitors real system metrics and checks task watchdogs
func (o *Orchestrator) StartEventLoop() {
	o.activeTicker = time.NewTicker(5 * time.Second)
	go func() {
		for range o.activeTicker.C {
			o.updateRealMetrics()
			o.checkTaskWatchdogs()
			o.mu.Lock()
			o.drainTaskQueue()
			o.mu.Unlock()
		}
	}()
}

func (o *Orchestrator) checkTaskWatchdogs() {
	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	for _, t := range o.tasks {
		if t.Status == TaskRunning && now.Sub(t.UpdatedAt) > 10*time.Minute {
			t.Status = TaskFailed
			t.ErrorDetails = "Watchdog timeout: task exceeded 10 minutes without activity"
			t.Logs = append(t.Logs, fmt.Sprintf("[%s] WATCHDOG: Task timed out after 10m without activity.", now.Format("15:04:05")))
			t.UpdatedAt = now
			o.safeSave(t)
			o.broadcastTaskUpdate(t)

			if t.AssignedTo != nil {
				if ag, ok := o.agents[*t.AssignedTo]; ok {
					ag.State = StateIdle
					ag.CurrentTaskID = nil
					ag.ActiveAction = "At desk"
					ag.UpdatedAt = now
					o.safeSave(ag)
					o.broadcastAgentUpdate(ag)
				}
			}
		}
	}
}

func (o *Orchestrator) updateRealMetrics() {
	o.mu.Lock()
	defer o.mu.Unlock()

	var runningTasks int64
	var blockedTasks int64
	var totalTokens int64
	var totalCost float64

	o.db.Model(&Task{}).Where("status = ?", TaskRunning).Count(&runningTasks)
	o.db.Model(&Task{}).Where("status = ? OR status = ?", TaskBlocked, TaskWaitingApproval).Count(&blockedTasks)

	// Calculate accumulated tokens and cost across all agents
	for _, ag := range o.agents {
		totalTokens += ag.TotalTokens
		totalCost += ag.EstimatedCost
	}

	o.metrics.ActiveAgents = len(o.agents)
	o.metrics.RunningTasks = int(runningTasks)
	o.metrics.BlockedTasks = int(blockedTasks)
	o.metrics.ActiveIncidents = len(o.incidents)
	o.metrics.TotalTokens = totalTokens
	o.metrics.EstimatedCostUSD = totalCost

	metricsMsg, _ := json.Marshal(map[string]interface{}{
		"action":  "METRICS_UPDATE",
		"metrics": o.metrics,
	})
	o.hub.Broadcast(metricsMsg)
}

// DecomposeRequirement calls the Python Agent Runtime using Gemini to decompose requirements dynamically
func (o *Orchestrator) DecomposeRequirement(projectID, prompt string) ([]*Task, error) {
	o.recordEvent("orchestration.decomposition", "Architect Agent", fmt.Sprintf("Analyzing requirement with Gemini: '%s'", prompt))

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	reqPayload := map[string]string{
		"project_id": projectID,
		"prompt":     prompt,
	}
	body, _ := json.Marshal(reqPayload)

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Post(pythonURL+"/api/decompose", "application/json", bytes.NewBuffer(body))

	var createdTasks []*Task

	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		if err := json.NewDecoder(resp.Body).Decode(&createdTasks); err == nil && len(createdTasks) > 0 {
			log.Printf("[Orchestrator] Successfully received %d dynamic tasks from Gemini runtime.", len(createdTasks))
		}
	}

	// Fallback to foundational engineering workflow if runtime is initializing
	if len(createdTasks) == 0 {
		log.Println("[Orchestrator] Falling back to standard engineering DAG pipeline...")
		createdTasks = o.generateFallbackDAG(projectID, prompt)
	}

	o.mu.Lock()
	defer o.mu.Unlock()

	for _, t := range createdTasks {
		o.safeCreate(t)
		o.tasks[t.ID] = t
		o.broadcastTaskUpdate(t)
	}

	// Trigger ready tasks that have no dependencies
	for _, t := range createdTasks {
		if len(t.Dependencies) == 0 && (t.Status == TaskPending || t.Status == TaskQueued || t.Status == TaskWaiting) {
			o.assignTask(t)
		}
	}

	return createdTasks, nil
}

func (o *Orchestrator) generateFallbackDAG(projectID, prompt string) []*Task {
	now := time.Now()
	t1ID := fmt.Sprintf("task-%d-arch", now.UnixNano())
	t2ID := fmt.Sprintf("task-%d-dev", now.UnixNano()+1)
	t3ID := fmt.Sprintf("task-%d-qa", now.UnixNano()+2)
	t4ID := fmt.Sprintf("task-%d-ops", now.UnixNano()+3)

	return []*Task{
		{
			ID:           t1ID,
			ProjectID:    projectID,
			Title:        "Architectural Specification & Contracts",
			Description:  fmt.Sprintf("Design OpenAPI specification and system architecture for: %s", prompt),
			Priority:     PriorityHigh,
			Status:       TaskQueued,
			RequiredRole: "Software Architect",
			Skills:       []string{"System Architecture", "API Specifications"},
			Tools:        []string{"read_file", "write_file"},
			Dependencies: []string{},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t2ID,
			ProjectID:    projectID,
			Title:        "Backend Implementation & Logic",
			Description:  fmt.Sprintf("Implement business logic, routes, and data models based on architecture for: %s", prompt),
			Priority:     PriorityCritical,
			Status:       TaskWaiting,
			RequiredRole: "Senior Developer",
			Skills:       []string{"Go", "Python", "PostgreSQL", "REST APIs"},
			Tools:        []string{"run_command", "read_file", "write_file", "git_ops"},
			Dependencies: []string{t1ID},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t3ID,
			ProjectID:    projectID,
			Title:        "Automated Test Suite & Verification",
			Description:  "Execute comprehensive test suite, verify assertions, and ensure zero regressions.",
			Priority:     PriorityHigh,
			Status:       TaskWaiting,
			RequiredRole: "Lead QA Engineer",
			Skills:       []string{"Test Automation", "Regression Testing"},
			Tools:        []string{"run_command", "run_test_suite", "read_file"},
			Dependencies: []string{t2ID},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t4ID,
			ProjectID:    projectID,
			Title:        "GitHub Pull Request & Deployment Pipeline",
			Description:  "Commit changes to git branch, open GitHub Pull Request, and prepare deployment staging.",
			Priority:     PriorityCritical,
			Status:       TaskWaiting,
			RequiredRole: "DevOps Engineer",
			Skills:       []string{"Docker", "GitOps", "CI/CD Pipelines"},
			Tools:        []string{"run_command", "git_ops", "create_github_pr"},
			Dependencies: []string{t3ID},
			RequiresSign: true,
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}
}

func matchesRole(agentRole, requiredRole string) bool {
	if agentRole == requiredRole {
		return true
	}
	aLower := strings.ToLower(agentRole)
	rLower := strings.ToLower(requiredRole)

	if aLower == rLower {
		return true
	}

	// Frontend match (e.g. "Senior Frontend Developer" matches "Junior Developer (Frontend)")
	if strings.Contains(rLower, "frontend") && (strings.Contains(aLower, "frontend") || strings.Contains(aLower, "full-stack")) {
		return true
	}
	// Backend match
	if strings.Contains(rLower, "backend") && (strings.Contains(aLower, "backend") || strings.Contains(aLower, "developer")) {
		return true
	}
	// General Developer match
	if strings.Contains(rLower, "developer") && strings.Contains(aLower, "developer") {
		return true
	}
	// QA match
	if (strings.Contains(rLower, "qa") || strings.Contains(rLower, "test")) &&
		(strings.Contains(aLower, "qa") || strings.Contains(aLower, "test")) {
		return true
	}
	// DevOps / SRE match
	if (strings.Contains(rLower, "devops") || strings.Contains(rLower, "ops") || strings.Contains(rLower, "infra")) &&
		(strings.Contains(aLower, "devops") || strings.Contains(aLower, "sre")) {
		return true
	}
	// Architect match
	if strings.Contains(rLower, "arch") && strings.Contains(aLower, "arch") {
		return true
	}

	return false
}

func (o *Orchestrator) assignTask(task *Task) {
	// Find suitable agent matching required role
	for _, ag := range o.agents {
		if matchesRole(ag.Role, task.RequiredRole) {
			// Check if agent is currently busy with an active running task
			isBusy := false
			if ag.CurrentTaskID != nil {
				if currentTask, ok := o.tasks[*ag.CurrentTaskID]; ok && currentTask.Status == TaskRunning {
					isBusy = true
				}
			}
			if !isBusy && ag.State != StateWorking {
				task.AssignedTo = &ag.ID
				task.Status = TaskRunning
				task.UpdatedAt = time.Now()

				ag.State = StateWorking
				ag.CurrentTaskID = &task.ID
				ag.ActiveAction = fmt.Sprintf("Working on: %s", task.Title)
				ag.UpdatedAt = time.Now()

				o.safeSave(task)
				o.safeSave(ag)

				o.recordEvent("agent.task.started", ag.Name, fmt.Sprintf("Started working on: '%s'", task.Title))
				o.broadcastAgentUpdate(ag)
				o.broadcastTaskUpdate(task)

				// Dispatch execution to Python runtime in background
				go o.dispatchTaskToRuntime(task, ag)
				return
			}
		}
	}

	// Fallback: If no strict role match found, match any idle developer or engineer
	for _, ag := range o.agents {
		isBusy := false
		if ag.CurrentTaskID != nil {
			if currentTask, ok := o.tasks[*ag.CurrentTaskID]; ok && currentTask.Status == TaskRunning {
				isBusy = true
			}
		}
		if !isBusy && ag.State != StateWorking && ag.Role != "Project Manager" && ag.Role != "Jira & Workflow Agent" {
			task.AssignedTo = &ag.ID
			task.Status = TaskRunning
			task.UpdatedAt = time.Now()

			ag.State = StateWorking
			ag.CurrentTaskID = &task.ID
			ag.ActiveAction = fmt.Sprintf("Working on: %s", task.Title)
			ag.UpdatedAt = time.Now()

			o.safeSave(task)
			o.safeSave(ag)

			o.recordEvent("agent.task.started", ag.Name, fmt.Sprintf("Assigned (cross-role): '%s'", task.Title))
			o.broadcastAgentUpdate(ag)
			o.broadcastTaskUpdate(task)

			go o.dispatchTaskToRuntime(task, ag)
			return
		}
	}

	// No agent currently available: keep task in QUEUED status
	if task.Status != TaskRunning {
		task.Status = TaskQueued
		task.UpdatedAt = time.Now()
		o.safeSave(task)
		o.broadcastTaskUpdate(task)
	}
}

func (o *Orchestrator) drainTaskQueue() {
	for _, t := range o.tasks {
		if t.Status == TaskQueued || t.Status == TaskPending {
			o.assignTask(t)
		}
	}
}


func (o *Orchestrator) dispatchTaskToRuntime(task *Task, agent *Agent) {
	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	payload := map[string]interface{}{
		"task_id":       task.ID,
		"project_id":    task.ProjectID,
		"title":         task.Title,
		"description":   task.Description,
		"required_role": task.RequiredRole,
		"agent_id":      agent.ID,
		"agent_name":    agent.Name,
		"system_prompt": agent.SystemPrompt,
		"skills":        agent.Skills,
		"tools":         agent.Tools,
		"dependencies":  task.Dependencies,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Orchestrator] Error marshaling task payload: %v", err)
		return
	}

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(pythonURL+"/api/execute", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Printf("[Orchestrator] Failed to connect to Python runtime: %v", err)
		o.mu.Lock()
		task.Status = TaskFailed
		task.Logs = append(task.Logs, fmt.Sprintf("[%s] Error: Failed to reach Agent Runtime: %v", time.Now().Format("15:04:05"), err))
		o.safeSave(task)
		agent.State = StateFailed
		agent.ActiveAction = "Runtime unreachable"
		o.safeSave(agent)
		o.broadcastTaskUpdate(task)
		o.broadcastAgentUpdate(agent)
		o.mu.Unlock()
		return
	}
	defer resp.Body.Close()
}

// HandleTaskEvent receives real-time execution events from Python runtime
func (o *Orchestrator) HandleTaskEvent(event TaskEventPayload) {
	o.mu.Lock()
	defer o.mu.Unlock()

	task, ok := o.tasks[event.TaskID]
	if !ok {
		return
	}

	var agent *Agent
	if task.AssignedTo != nil {
		agent = o.agents[*task.AssignedTo]
	}

	switch event.Type {
	case "token":
		// Stream token to frontend via WebSocket
		streamMsg, _ := json.Marshal(map[string]interface{}{
			"action":  "TASK_STREAM",
			"taskId":  task.ID,
			"agentId": event.AgentID,
			"token":   event.Content,
		})
		o.hub.Broadcast(streamMsg)

	case "log":
		logEntry := fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), event.Content)
		task.Logs = append(task.Logs, logEntry)
		if event.Progress > 0 {
			task.Progress = event.Progress
		}
		o.safeSave(task)
		o.broadcastTaskUpdate(task)

	case "completion":
		task.Progress = 100
		task.Status = TaskCompleted
		if event.Content != "" {
			task.Output = string(event.Content)
		}
		if event.Branch != "" {
			task.Branch = event.Branch
		}
		if event.PRURL != "" {
			task.PRURL = event.PRURL
		}
		if event.TokensUsed > 0 {
			task.TokenUsage += event.TokensUsed
			if agent != nil {
				agent.TotalTokens += event.TokensUsed
			}
		}
		if event.CostUSD > 0 {
			task.CostUSD += event.CostUSD
			if agent != nil {
				agent.EstimatedCost += event.CostUSD
			}
		}

		o.safeSave(task)
		o.broadcastTaskUpdate(task)

		if agent != nil {
			agent.State = StateCompleted
			agent.ActiveAction = "Task completed"
			o.safeSave(agent)
			o.recordEvent("agent.task.completed", agent.Name, fmt.Sprintf("Completed task: '%s'", task.Title))
			o.broadcastAgentUpdate(agent)

			agentID := agent.ID
			go func() {
				time.Sleep(2 * time.Second)
				o.mu.Lock()
				if ag, exists := o.agents[agentID]; exists && ag.State == StateCompleted {
					ag.State = StateIdle
					ag.CurrentTaskID = nil
					ag.ActiveAction = "At desk"
					o.safeSave(ag)
					o.broadcastAgentUpdate(ag)
					o.drainTaskQueue()
				}
				o.mu.Unlock()
			}()
		}

		// Evaluate downstream DAG dependencies
		o.triggerNextTasks(task.ID)

	case "error":
		task.Status = TaskFailed
		task.ErrorDetails = string(event.Content)
		task.Logs = append(task.Logs, fmt.Sprintf("[%s] ERROR: %s", time.Now().Format("15:04:05"), event.Content))
		o.safeSave(task)
		o.broadcastTaskUpdate(task)

		if agent != nil {
			agent.CurrentTaskID = nil
			agent.State = StateIdle
			agent.ActiveAction = fmt.Sprintf("Standing by (previous task ended: %s)", event.Content)
			o.safeSave(agent)
			o.broadcastAgentUpdate(agent)
			o.drainTaskQueue()
		}
	}
}

func (o *Orchestrator) triggerNextTasks(completedTaskID string) {
	for _, t := range o.tasks {
		if t.Status == TaskWaiting || t.Status == TaskPending {
			allDone := true
			for _, depID := range t.Dependencies {
				if dep, ok := o.tasks[depID]; !ok || dep.Status != TaskCompleted {
					allDone = false
					break
				}
			}
			if allDone && len(t.Dependencies) > 0 {
				t.Status = TaskQueued
				o.safeSave(t)
				o.assignTask(t)
			}
		}
	}
	o.drainTaskQueue()
}

// RetryTask resets a failed or stuck task back to PENDING and triggers execution
func (o *Orchestrator) RetryTask(taskID string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	task, ok := o.tasks[taskID]
	if !ok {
		return fmt.Errorf("task not found: %s", taskID)
	}

	task.Status = TaskPending
	task.Progress = 0
	task.AssignedTo = nil
	task.ErrorDetails = ""
	task.UpdatedAt = time.Now()
	task.Logs = append(task.Logs, fmt.Sprintf("[%s] Task reset for retry by human director.", time.Now().Format("15:04:05")))

	o.safeSave(task)
	o.broadcastTaskUpdate(task)
	o.drainTaskQueue()
	return nil
}

// CreateProject persists a new engineering initiative to PostgreSQL and cache
func (o *Orchestrator) CreateProject(p *Project) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if p.ID == "" {
		p.ID = fmt.Sprintf("proj-%d", time.Now().Unix())
	}
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	p.Status = "ACTIVE"
	if p.Building == "" {
		p.Building = "Building A"
	}
	if p.TargetBranch == "" {
		p.TargetBranch = "main"
	}

	o.safeCreate(p)
	o.projects[p.ID] = p

	o.recordEvent("project.created", "Human Operator", fmt.Sprintf("Created new project: '%s' in %s", p.Name, p.Building))

	msg, _ := json.Marshal(map[string]interface{}{
		"action":  "PROJECT_CREATED",
		"project": p,
	})
	o.hub.Broadcast(msg)
	return nil
}

// LaunchPlan batch inserts human-verified tasks into PostgreSQL and launches pipeline
func (o *Orchestrator) LaunchPlan(tasks []*Task) ([]*Task, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	for _, t := range tasks {
		if t.ID == "" {
			t.ID = fmt.Sprintf("task-%d", time.Now().UnixNano())
		}
		t.CreatedAt = now
		t.UpdatedAt = now
		if len(t.Dependencies) == 0 {
			t.Status = TaskQueued
		} else {
			t.Status = TaskWaiting
		}
		o.safeCreate(t)
		o.tasks[t.ID] = t
		o.broadcastTaskUpdate(t)
	}

	o.recordEvent("orchestration.plan_launched", "Human Operator", fmt.Sprintf("Approved and launched plan with %d tasks.", len(tasks)))

	// Trigger ready tasks
	for _, t := range tasks {
		if len(t.Dependencies) == 0 {
			o.assignTask(t)
		}
	}

	return tasks, nil
}


// InstructAgent sends a direct human instruction to an agent
func (o *Orchestrator) InstructAgent(agentID, instruction string) (string, error) {
	o.mu.Lock()
	agent, ok := o.agents[agentID]
	if !ok {
		o.mu.Unlock()
		return "", fmt.Errorf("agent '%s' not found", agentID)
	}

	agent.State = StateThinking
	agent.ActiveAction = fmt.Sprintf("Executing instruction: %s", instruction)
	o.safeSave(agent)
	o.broadcastAgentUpdate(agent)
	o.mu.Unlock()

	o.recordEvent("agent.instruction", "Human Operator", fmt.Sprintf("Instructed %s (%s): '%s'", agent.Name, agent.Role, instruction))

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	payload := map[string]interface{}{
		"agent_id":      agent.ID,
		"agent_name":    agent.Name,
		"role":          agent.Role,
		"system_prompt": agent.SystemPrompt,
		"instruction":   instruction,
	}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Post(pythonURL+"/api/instruct", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		Response   string `json:"response"`
		TokensUsed int64  `json:"tokens_used"`
		CostUSD    float64 `json:"cost_usd"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	o.mu.Lock()
	agent.State = StateIdle
	agent.ActiveAction = "At desk"
	agent.TotalTokens += res.TokensUsed
	agent.EstimatedCost += res.CostUSD
	o.safeSave(agent)
	o.broadcastAgentUpdate(agent)
	o.mu.Unlock()

	return res.Response, nil
}

// TriggerIncident records an operational alert and activates SRE
func (o *Orchestrator) TriggerIncident(title, severity, desc string) *Incident {
	o.mu.Lock()
	defer o.mu.Unlock()

	incID := fmt.Sprintf("inc-%d", time.Now().Unix())
	sreAgentID := "agent-sre"
	inc := &Incident{
		ID:          incID,
		ProjectID:   "proj-1",
		Title:       title,
		Severity:    severity,
		Status:      "DETECTED",
		Description: desc,
		AssignedSRE: &sreAgentID,
		CreatedAt:   time.Now(),
	}
	o.safeCreate(inc)
	o.incidents[inc.ID] = inc

	if sre, ok := o.agents[sreAgentID]; ok {
		sre.State = StateThinking
		sre.ActiveAction = fmt.Sprintf("Diagnosing %s incident: %s", severity, title)
		sre.Position = Vector3{X: 6.5, Y: 0.0, Z: -2.5}
		o.safeSave(sre)
		o.broadcastAgentUpdate(sre)
	}

	o.recordEvent("incident.created", "Prometheus SRE Gateway", fmt.Sprintf("[%s] %s: %s", severity, title, desc))

	msg, _ := json.Marshal(map[string]interface{}{
		"action":   "INCIDENT_ALERT",
		"incident": inc,
	})
	o.hub.Broadcast(msg)
	return inc
}

// ResolveIncident clears an incident and returns SRE to desk
func (o *Orchestrator) ResolveIncident(id, rootCause, mitigation string) {
	o.mu.Lock()
	defer o.mu.Unlock()

	if inc, ok := o.incidents[id]; ok {
		now := time.Now()
		inc.Status = "RESOLVED"
		inc.RootCause = rootCause
		inc.Mitigation = mitigation
		inc.ResolvedAt = &now
		o.safeSave(inc)
		delete(o.incidents, id)

		if inc.AssignedSRE != nil {
			if sre, exists := o.agents[*inc.AssignedSRE]; exists {
				sre.State = StateIdle
				sre.Position = sre.DeskPosition
				sre.ActiveAction = "At desk"
				o.safeSave(sre)
				o.broadcastAgentUpdate(sre)
			}
		}

		o.recordEvent("incident.resolved", "SRE Commander", fmt.Sprintf("Incident '%s' resolved. Root cause: %s", inc.Title, rootCause))
	}
}

// RequestHumanApproval registers an approval gate
func (o *Orchestrator) RequestHumanApproval(taskID, agentID, actionType, desc, diff, prURL string) *HumanApproval {
	o.mu.Lock()
	defer o.mu.Unlock()

	appID := fmt.Sprintf("appr-%d", time.Now().Unix())
	appr := &HumanApproval{
		ID:          appID,
		TaskID:      taskID,
		AgentID:     agentID,
		ActionType:  actionType,
		Description: desc,
		DiffPreview: diff,
		PRURL:       prURL,
		Status:      "PENDING",
		CreatedAt:   time.Now(),
	}
	o.safeCreate(appr)
	o.approvals[appID] = appr

	if ag, ok := o.agents[agentID]; ok {
		ag.State = StateWaitingApproval
		ag.ActiveAction = fmt.Sprintf("Awaiting sign-off: %s", actionType)
		o.safeSave(ag)
		o.broadcastAgentUpdate(ag)
	}

	if t, ok := o.tasks[taskID]; ok {
		t.Status = TaskWaitingApproval
		o.safeSave(t)
		o.broadcastTaskUpdate(t)
	}

	o.recordEvent("approval.requested", "Security Gateway", fmt.Sprintf("Approval requested for %s by %s", actionType, agentID))

	data, _ := json.Marshal(map[string]interface{}{
		"action":   "APPROVAL_REQUESTED",
		"approval": appr,
	})
	o.hub.Broadcast(data)
	return appr
}

func (o *Orchestrator) HandleApprovalDecision(approvalID string, approved bool) {
	o.mu.Lock()
	defer o.mu.Unlock()

	appr, ok := o.approvals[approvalID]
	if !ok {
		return
	}

	if approved {
		appr.Status = "APPROVED"
		o.safeSave(appr)

		if t, ok := o.tasks[appr.TaskID]; ok {
			t.Status = TaskRunning
			t.Logs = append(t.Logs, fmt.Sprintf("[%s] Approval GRANTED by Human Administrator.", time.Now().Format("15:04:05")))
			o.safeSave(t)
			o.broadcastTaskUpdate(t)
		}
		if ag, ok := o.agents[appr.AgentID]; ok {
			ag.State = StateWorking
			ag.ActiveAction = "Executing approved deployment"
			o.safeSave(ag)
			o.broadcastAgentUpdate(ag)
		}
		o.recordEvent("approval.granted", "Human Operator", fmt.Sprintf("Approved action '%s' for agent %s", appr.ActionType, appr.AgentID))
	} else {
		appr.Status = "REJECTED"
		o.safeSave(appr)

		if t, ok := o.tasks[appr.TaskID]; ok {
			t.Status = TaskBlocked
			t.Logs = append(t.Logs, fmt.Sprintf("[%s] Approval REJECTED by Human Administrator.", time.Now().Format("15:04:05")))
			o.safeSave(t)
			o.broadcastTaskUpdate(t)
		}
		if ag, ok := o.agents[appr.AgentID]; ok {
			ag.State = StateBlocked
			ag.ActiveAction = "Action rejected by human"
			o.safeSave(ag)
			o.broadcastAgentUpdate(ag)
		}
		o.recordEvent("approval.rejected", "Human Operator", fmt.Sprintf("Rejected action '%s' for agent %s", appr.ActionType, appr.AgentID))
	}
}

func (o *Orchestrator) broadcastAgentUpdate(ag *Agent) {
	data, _ := json.Marshal(map[string]interface{}{
		"action": "AGENT_UPDATE",
		"agent":  ag,
	})
	o.hub.Broadcast(data)
}

func (o *Orchestrator) broadcastTaskUpdate(task *Task) {
	data, _ := json.Marshal(map[string]interface{}{
		"action": "TASK_UPDATE",
		"task":   task,
	})
	o.hub.Broadcast(data)
}

func (o *Orchestrator) safeSave(entity interface{}) {
	if o.db != nil {
		o.db.Save(entity)
	}
}

func (o *Orchestrator) safeCreate(entity interface{}) {
	if o.db != nil {
		o.db.Create(entity)
	}
}

