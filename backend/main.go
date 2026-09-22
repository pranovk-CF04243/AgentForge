package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://agentforge:agentforge_secret@localhost:5432/agentforge_db?sslmode=disable"
	}
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Warning: Failed to connect to database (%v). Waiting or will retry...", err)
		return
	}

	err = db.AutoMigrate(&Agent{}, &Task{}, &Project{}, &SystemEvent{}, &Incident{}, &HumanApproval{}, &BudgetPool{})
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

	handler := NewAPIHandler(orchestrator, hub)

	mux := http.NewServeMux()

	// REST Endpoints
	mux.HandleFunc("/api/health", handler.HealthCheck)
	mux.HandleFunc("/api/projects", handler.GetProjects)
	mux.HandleFunc("/api/projects/decompose", handler.DecomposeProject)
	mux.HandleFunc("/api/projects/analyze-brd", handler.AnalyzeBRD)
	mux.HandleFunc("/api/projects/replan", handler.ReplanTasks)
	mux.HandleFunc("/api/projects/launch-plan", handler.LaunchPlan)
	mux.HandleFunc("/api/agents", handler.GetAgents)
	mux.HandleFunc("/api/config/models", handler.GetModelCatalog)
	mux.HandleFunc("/api/config/models/default", handler.UpdateDefaultModel)
	mux.HandleFunc("/api/tasks", handler.GetTasks)
	mux.HandleFunc("/api/events", handler.GetEvents)
	mux.HandleFunc("/api/metrics", handler.GetMetrics)
	mux.HandleFunc("/api/incidents", handler.HandleIncidents)
	mux.HandleFunc("/api/incidents/resolve/", handler.ResolveIncident)
	mux.HandleFunc("/api/approvals", handler.HandleApprovals)

	// Webhook & Agent Interaction
	mux.HandleFunc("/api/internal/task-event", handler.HandleTaskEventWebhook)
	mux.HandleFunc("/api/internal/request-budget-topup", handler.HandleBudgetTopup)

	// Real-Time Streaming Endpoints
	mux.HandleFunc("/ws", handler.HandleWebSocket)
	mux.HandleFunc("/api/events/stream", handler.HandleSSE)

	// Custom routing wrapper to support wildcard prefix matching cleanly
	rootHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/incidents/resolve/") {
			handler.ResolveIncident(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/agents/") && strings.HasSuffix(r.URL.Path, "/instruct") {
			handler.InstructAgent(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/agents/") && strings.HasSuffix(r.URL.Path, "/model") {
			handler.UpdateAgentModel(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/tasks/") && strings.HasSuffix(r.URL.Path, "/retry") {
			handler.RetryTask(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})

	log.Printf("=====================================================")
	log.Printf("  AgentForge Production Engine — Version 2.0.0")
	log.Printf("  Listening on http://0.0.0.0:%s", port)
	log.Printf("  WebSocket: ws://localhost:%s/ws", port)
	log.Printf("  SSE Stream: http://localhost:%s/api/events/stream", port)
	log.Printf("=====================================================")

	if err := http.ListenAndServe(":"+port, rootHandler); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}
