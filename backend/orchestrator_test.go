package main

import (
	"testing"
)

func TestOrchestratorInitialization(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	if len(o.agents) != 14 {
		t.Fatalf("Expected 14 agents seeded, got %d", len(o.agents))
	}

	if len(o.projects) < 1 {
		t.Fatalf("Expected at least 1 project seeded, got %d", len(o.projects))
	}

	// Verify key roles exist
	expectedRoles := []string{
		"Project Manager", "Software Architect", "Senior Developer",
		"Junior Developer (Frontend)", "Lead QA Engineer", "DevOps Engineer", "Cloud SRE Engineer",
	}

	roleFound := make(map[string]bool)
	for _, a := range o.agents {
		roleFound[a.Role] = true
	}

	for _, role := range expectedRoles {
		if !roleFound[role] {
			t.Errorf("Expected role %s to be present", role)
		}
	}
}

func TestDecomposeRequirementDAG(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	tasks, err := o.DecomposeRequirement("proj-1", "Build Payment Gateway with Stripe and Webhooks")
	if err != nil {
		t.Fatalf("Decomposition error: %v", err)
	}

	if len(tasks) < 4 {
		t.Fatalf("Expected at least 4 tasks created in DAG, got %d", len(tasks))
	}

	// Task 1 (Architect) should have no dependencies
	if len(tasks[0].Dependencies) != 0 {
		t.Errorf("Task 1 should have 0 dependencies, got %d", len(tasks[0].Dependencies))
	}

	// Task 2 depends on Task 1
	if len(tasks[1].Dependencies) == 0 || tasks[1].Dependencies[0] != tasks[0].ID {
		t.Errorf("Task 2 should depend on Task 1")
	}

	// Final task (DevOps) requires approval
	finalTask := tasks[len(tasks)-1]
	if !finalTask.RequiresSign {
		t.Errorf("Final deployment task should require human approval")
	}
}

func TestIncidentLifecycle(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	inc := o.TriggerIncident("Database Connection Pool Exhaustion", "SEV-1", "All connections in use.")
	if inc == nil {
		t.Fatal("Incident was not created")
	}

	sre := o.agents["agent-sre"]
	if sre.State != StateThinking {
		t.Errorf("Expected SRE agent to be in THINKING state, got %s", sre.State)
	}

	// Resolve incident
	o.ResolveIncident(inc.ID, "Increased pool size to 100", "Updated helm values")

	if sre.State != StateIdle {
		t.Errorf("Expected SRE agent to revert to IDLE state, got %s", sre.State)
	}
}

func TestHumanApprovalWorkflow(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	tasks, err := o.DecomposeRequirement("proj-1", "Test Approval")
	if err != nil {
		t.Fatalf("Decompose error: %v", err)
	}
	task := tasks[0]

	appr := o.RequestHumanApproval(task.ID, "agent-devops", "PRODUCTION_DEPLOY", "Deploy v2.4 to prod-us-east-1", "diff --git a/helm/values.yaml...", "https://github.com/agentforge/workspace/pull/12")

	if appr.Status != "PENDING" {
		t.Errorf("Expected status PENDING, got %s", appr.Status)
	}
	if appr.PRURL == "" {
		t.Errorf("Expected PRURL to be set")
	}

	ag := o.agents["agent-devops"]
	if ag.State != StateWaitingApproval {
		t.Errorf("Expected agent to be WAITING_APPROVAL, got %s", ag.State)
	}

	// Approve
	o.HandleApprovalDecision(appr.ID, true)
	if appr.Status != "APPROVED" {
		t.Errorf("Expected status APPROVED, got %s", appr.Status)
	}
	if ag.State != StateWorking {
		t.Errorf("Expected agent to resume WORKING state, got %s", ag.State)
	}
}
