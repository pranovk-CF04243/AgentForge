package main

import (
	"testing"
)

func TestBudgetFor_RoleFallbackToDefault(t *testing.T) {
	cfg := &BudgetConfig{
		Default: RoleBudget{TokenBudget: 100},
		Roles: map[string]RoleBudget{
			"Senior Developer": {TokenBudget: 500},
		},
	}

	if got := cfg.BudgetFor("Senior Developer").TokenBudget; got != 500 {
		t.Errorf("Expected role-specific budget 500, got %d", got)
	}
	if got := cfg.BudgetFor("Unknown Role").TokenBudget; got != 100 {
		t.Errorf("Expected fallback to default budget 100, got %d", got)
	}
}

func TestBankedSurplusCarriesToNextTask(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	o.budgetConfig = &BudgetConfig{Default: RoleBudget{TokenBudget: 1000}}

	agent := o.agents["agent-backend"]
	task := &Task{ID: "task-budget-1", AssignedTo: &agent.ID}
	o.tasks[task.ID] = task

	o.dispatchTaskAllotmentForTest(task, agent)
	if allotted := o.taskAllotments[task.ID]; allotted != 1000 {
		t.Fatalf("Expected first task allotment 1000, got %d", allotted)
	}

	o.HandleTaskEvent(TaskEventPayload{
		Type:       "completion",
		TaskID:     task.ID,
		AgentID:    agent.ID,
		TokensUsed: 600,
	})

	if agent.BankedSurplus != 400 {
		t.Errorf("Expected banked surplus of 400 (1000-600), got %d", agent.BankedSurplus)
	}
}

func TestBankedSurplusSpillsToCrisisPoolOnIdle(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	agent := o.agents["agent-backend"]
	agent.BankedSurplus = 400
	o.crisisPool = 0

	o.settleAgentIdleLocked(agent)

	if o.crisisPool != 400 {
		t.Errorf("Expected crisis pool to receive spilled surplus of 400, got %d", o.crisisPool)
	}
	if agent.BankedSurplus != 0 {
		t.Errorf("Expected agent's banked surplus to reset to 0, got %d", agent.BankedSurplus)
	}
}

func TestCrisisPoolDrawGrantedAndCapped(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	o.crisisPool = 1000
	o.budgetConfig.CrisisPool = CrisisPoolConfig{MaxDrawPerTask: 300, MaxDrawPctOfPool: 25}

	granted := o.RequestBudgetTopup("task-1", "agent-backend", 1000)
	if granted != 250 {
		t.Errorf("Expected draw capped to 25%% of pool (250), got %d", granted)
	}
	if o.crisisPool != 750 {
		t.Errorf("Expected pool to decrease by granted amount to 750, got %d", o.crisisPool)
	}

	granted2 := o.RequestBudgetTopup("task-2", "agent-backend", 100)
	if granted2 != 100 {
		t.Errorf("Expected a request under both caps to be granted in full (100), got %d", granted2)
	}
}

func TestCrisisPoolDrawDeniedWhenPoolEmpty(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	o.crisisPool = 0
	o.budgetConfig.CrisisPool = CrisisPoolConfig{MaxDrawPerTask: 300, MaxDrawPctOfPool: 25}

	granted := o.RequestBudgetTopup("task-1", "agent-backend", 500)
	if granted != 0 {
		t.Errorf("Expected 0 granted when crisis pool is empty, got %d", granted)
	}
}

func TestTaskFailsOnBudgetExceededEvent(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	agent := o.agents["agent-backend"]
	task := &Task{ID: "task-budget-fail", AssignedTo: &agent.ID, Status: TaskRunning}
	o.tasks[task.ID] = task
	agent.State = StateWorking
	agent.CurrentTaskID = &task.ID

	o.HandleTaskEvent(TaskEventPayload{
		Type:    "error",
		TaskID:  task.ID,
		AgentID: agent.ID,
		Content: FlexibleString("Token budget exceeded for agent Kaelen Voss (used 900/800 tokens)"),
	})

	if task.Status != TaskFailed {
		t.Errorf("Expected task status TaskFailed, got %s", task.Status)
	}
	if task.ErrorDetails == "" {
		t.Errorf("Expected task.ErrorDetails to be set")
	}
	if agent.State != StateIdle {
		t.Errorf("Expected agent to be freed back to StateIdle, got %s", agent.State)
	}
}

// dispatchTaskAllotmentForTest mirrors the allotment computation done inside
// dispatchTaskToRuntime, without making the real HTTP call to the Python
// runtime, so banked-surplus bookkeeping can be tested in isolation.
func (o *Orchestrator) dispatchTaskAllotmentForTest(task *Task, agent *Agent) {
	o.mu.Lock()
	defer o.mu.Unlock()
	base := o.budgetConfig.BudgetFor(agent.Role).TokenBudget
	allotted := base + agent.BankedSurplus
	agent.BankedSurplus = 0
	o.taskAllotments[task.ID] = allotted
}
