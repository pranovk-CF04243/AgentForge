package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"agentforge/backend/kafka_producer"
)

var DB *gorm.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		if os.Getenv("ENV") == "production" {
			log.Fatal("CRITICAL SECURITY ERROR: DATABASE_URL environment variable must be set in production mode")
		}
		log.Printf("[SECURITY WARNING] DATABASE_URL not set. Falling back to local development database.")
		dsn = "postgres://agentforge:agentforge_secret@localhost:5432/agentforge_db?sslmode=disable"
	}
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Warning: Failed to connect to database (%v). Waiting or will retry...", err)
		return
	}

	err = db.AutoMigrate(
		&Agent{}, &Task{}, &Project{}, &SystemEvent{}, &Incident{},
		&HumanApproval{}, &ProjectEnvironment{}, &Epic{}, &StudioMessage{}, &ProjectCredential{},
		// User management & auth
		&User{}, &Workspace{}, &WorkspaceMember{}, &Invite{}, &RefreshToken{}, &ActivityLog{},
	)
	if err != nil {
		log.Printf("Warning: AutoMigrate encountered error: %v", err)
	}

	DB = db
	log.Println("Successfully connected to PostgreSQL database and migrated schemas.")
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	initDB()

	hub := NewHub()
	orchestrator := NewOrchestrator(hub, DB)
	orchestrator.StartEventLoop()

	kafkaProducer := kafka_producer.NewAsyncChannelAuditProducer(1000)
	defer kafkaProducer.Close()
	InitAuditLogger(DB, hub, kafkaProducer)

	handler := NewAPIHandler(orchestrator, hub)
	authHandler := NewAuthHandler(orchestrator)
	wsHandler := NewWorkspaceHandler(orchestrator, hub)

	mux := http.NewServeMux()

	// ── Public Auth Routes (no JWT required) ─────────────────────────────
	mux.HandleFunc("/api/auth/bootstrap", authHandler.HandleBootstrap)
	mux.HandleFunc("/api/auth/login", authHandler.HandleLogin)
	mux.HandleFunc("/api/auth/refresh", authHandler.HandleRefresh)
	mux.HandleFunc("/api/auth/logout", authHandler.HandleLogout)
	mux.HandleFunc("/api/auth/github", authHandler.HandleGitHubLogin)
	mux.HandleFunc("/api/auth/github/callback", authHandler.HandleGitHubCallback)
	// Invite endpoints: preview, request-otp, verify-otp, and accept
	mux.HandleFunc("/api/auth/invites/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/accept") {
			authHandler.HandleInviteAccept(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/request-otp") {
			authHandler.HandleInviteRequestOTP(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/verify-otp") {
			authHandler.HandleInviteVerifyOTP(w, r)
		} else {
			authHandler.HandleInvitePreview(w, r)
		}
	})

	// ── Authenticated Routes (JWT required) ──────────────────────────────
	mux.HandleFunc("/api/auth/me", authHandler.HandleMe)

	// Workspace management
	mux.HandleFunc("/api/workspace", wsHandler.HandleWorkspace)
	mux.HandleFunc("/api/workspace/members", wsHandler.HandleMembers)
	mux.HandleFunc("/api/workspace/members/", wsHandler.HandleMember)
	mux.HandleFunc("/api/workspace/invites", wsHandler.HandleInvites)
	mux.HandleFunc("/api/workspace/invites/", wsHandler.HandleInviteDelete)
	mux.HandleFunc("/api/workspace/activity", wsHandler.HandleActivity)
	mux.HandleFunc("/api/workspace/activity/export", wsHandler.HandleActivityExport)
	mux.HandleFunc("/api/workspace/rbac/permissions", wsHandler.HandleRBACPermissions)
	mux.HandleFunc("/api/workspace/rbac/permissions/reset", wsHandler.HandleRBACPermissionsReset)

	// REST Endpoints
	mux.HandleFunc("/api/health", handler.HealthCheck)
	mux.HandleFunc("/api/projects", handler.GetProjects)
	mux.HandleFunc("/api/projects/decompose", handler.DecomposeProject)
	mux.HandleFunc("/api/projects/analyze-brd", handler.AnalyzeBRD)
	mux.HandleFunc("/api/projects/epics", handler.HandleProjectEpics)
	mux.HandleFunc("/api/projects/studio-messages", handler.HandleProjectStudioMessages)
	mux.HandleFunc("/api/projects/replan", handler.ReplanTasks)
	mux.HandleFunc("/api/projects/staged-tasks", handler.HandleProjectStagedTasks)
	mux.HandleFunc("/api/projects/launch-plan", handler.LaunchPlan)
	mux.HandleFunc("/api/agents", handler.GetAgents)
	mux.HandleFunc("/api/tasks", handler.GetTasks)
	mux.HandleFunc("/api/tasks/assign", handler.HandleAssignTask)
	mux.HandleFunc("/api/events", handler.GetEvents)
	mux.HandleFunc("/api/metrics", handler.GetMetrics)
	mux.HandleFunc("/api/incidents", handler.HandleIncidents)
	mux.HandleFunc("/api/incidents/resolve/", handler.ResolveIncident)
	mux.HandleFunc("/api/approvals", handler.HandleApprovals)
	mux.HandleFunc("/api/environments", handler.GetProjectEnvironments)

	// Kubernetes Live Cluster & Provisioning Endpoints
	mux.HandleFunc("/api/v1/cluster/status", handler.GetClusterStatus)
	mux.HandleFunc("/api/v1/cluster/workloads", handler.GetClusterWorkloads)
	mux.HandleFunc("/api/v1/cluster/logs", handler.GetClusterLogs)
	mux.HandleFunc("/api/v1/cluster/provision", handler.ProvisionClusterNamespace)
	mux.HandleFunc("/api/v1/cluster/deploy", handler.DeployToCluster)
	mux.HandleFunc("/api/v1/cluster/connect", handler.ConnectExternalCluster)
	mux.HandleFunc("/api/v1/cluster/health-check", handler.HandleClusterHealthCheck)
	mux.HandleFunc("/api/cluster/health-check", handler.HandleClusterHealthCheck)

	// Credentials Governance Endpoints
	mux.HandleFunc("/api/v1/projects/credentials", handler.HandleProjectCredentials)
	mux.HandleFunc("/api/projects/credentials", handler.HandleProjectCredentials)
	mux.HandleFunc("/api/credentials", handler.HandleProjectCredentials)
	mux.HandleFunc("/api/v1/projects/credentials/validate", handler.HandleValidateCredentials)
	mux.HandleFunc("/api/projects/credentials/validate", handler.HandleValidateCredentials)
	mux.HandleFunc("/api/credentials/validate", handler.HandleValidateCredentials)

	// Models & AI Configuration
	mux.HandleFunc("/api/v1/models", handler.HandleModelCatalogue)
	mux.HandleFunc("/api/models", handler.HandleModelCatalogue)
	mux.HandleFunc("/api/agents/update", handler.HandleAgents)
	mux.HandleFunc("/api/v1/agents/update", handler.HandleAgents)

	// Webhook & Agent Interaction
	mux.HandleFunc("/api/internal/task-event", handler.HandleTaskEventWebhook)
	mux.HandleFunc("/api/internal/deployment-failure", handler.HandleDeploymentFailure)
	mux.HandleFunc("/api/internal/debate/message", handler.HandlePostDebateMessage)
	mux.HandleFunc("/api/debates", handler.HandleStartDebate)

	mux.HandleFunc("/api/v1/webhooks/alerts", handler.HandleAlertWebhook)

	// Real-Time Streaming Endpoints
	mux.HandleFunc("/ws", handler.HandleWebSocket)
	mux.HandleFunc("/api/events/stream", handler.HandleSSE)

	// ── Custom routing wrapper (wildcard prefix matching) ─────────────────
	innerRouter := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/incidents/resolve/") {
			handler.ResolveIncident(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/agents/") && strings.HasSuffix(r.URL.Path, "/instruct") {
			// Require at least developer role to instruct agents (enforced per-agent in handler)
			RequireRole("developer")(handler.InstructAgent)(w, r)
			return
		}
		if (strings.HasPrefix(r.URL.Path, "/api/agents/") || strings.HasPrefix(r.URL.Path, "/api/v1/agents/")) && strings.HasSuffix(r.URL.Path, "/cost-projection") {
			handler.HandleCostProjection(w, r)
			return
		}
		if (strings.HasPrefix(r.URL.Path, "/api/agents/") || strings.HasPrefix(r.URL.Path, "/api/v1/agents/")) && (r.Method == http.MethodPatch || r.Method == http.MethodPost) {
			// Only admin+ can change agent model/prompt
			RequireRole("admin")(handler.HandleAgents)(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/tasks/") && strings.HasSuffix(r.URL.Path, "/retry") {
			RequireRole("developer")(handler.RetryTask)(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})

	// Public paths that bypass JWT verification
	publicPaths := []string{
		"/api/auth/bootstrap",
		"/api/auth/login",
		"/api/auth/refresh",
		"/api/auth/logout",
		"/api/auth/github",
		"/api/auth/invites/",
		"/api/health",
		"/api/internal/", // agent runtime webhook — internal only
		"/ws",
		"/api/events/stream",
		"/api/v1/cluster/status",
		"/api/v1/cluster/workloads",
		"/api/v1/cluster/logs",
		"/api/v1/cluster/health-check",
		"/api/cluster/health-check",
	}

	// Apply SecurityHeaders, CORS, MaxBytes (2MB payload limit), and JWT middleware to all routes
	maxPayloadBytes := int64(2 << 20) // 2 MB
	rootHandler := SecurityHeadersMiddleware(CORSMiddleware(MaxBytesMiddleware(maxPayloadBytes)(JWTMiddleware(jwtSecret(), publicPaths)(innerRouter))))

	log.Printf("=====================================================")
	log.Printf("  AgentForge Production Engine — Version 2.0.0")
	log.Printf("  Listening on http://0.0.0.0:%s", port)
	log.Printf("  WebSocket: ws://localhost:%s/ws", port)
	log.Printf("  SSE Stream: http://localhost:%s/api/events/stream", port)
	log.Printf("  Auth: POST /api/auth/bootstrap | /api/auth/login")
	log.Printf("=====================================================")

	if err := http.ListenAndServe(":"+port, rootHandler); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}
