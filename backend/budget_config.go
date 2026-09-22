package main

import (
	"encoding/json"
	"log"
	"os"
)

// RoleBudget defines the per-task token/cost allotment for a given agent
// role (or the "default" fallback used for any role not explicitly listed).
type RoleBudget struct {
	TokenBudget   int64   `json:"token_budget"`
	CostBudgetUSD float64 `json:"cost_budget_usd"`
}

// CrisisPoolConfig controls the shared pool that leftover ("banked") tokens
// spill into once an agent goes idle, and the caps applied when an agent
// draws a top-up from that pool mid-task.
type CrisisPoolConfig struct {
	InitialTokens    int64 `json:"initial_tokens"`
	MaxDrawPerTask   int64 `json:"max_draw_per_task"`
	MaxDrawPctOfPool int64 `json:"max_draw_pct_of_pool"`
}

// BudgetConfig is the parsed contents of config/token_budgets.json — the
// single source of truth for per-role token budgets and crisis-pool tuning.
// It is loaded once at startup (see LoadBudgetConfig); there is no hot
// reload in v1.
type BudgetConfig struct {
	Default    RoleBudget            `json:"default"`
	Roles      map[string]RoleBudget `json:"roles"`
	CrisisPool CrisisPoolConfig      `json:"crisis_pool"`
}

// defaultBudgetConfig is used when the JSON file is missing or unparsable,
// so the backend degrades gracefully (matching the safeSave/safeCreate
// no-DB-required philosophy) instead of failing to start. The generous
// token budget effectively disables enforcement until a real config file is
// supplied.
func defaultBudgetConfig() *BudgetConfig {
	return &BudgetConfig{
		Default: RoleBudget{TokenBudget: 1_000_000, CostBudgetUSD: 100.0},
		Roles:   map[string]RoleBudget{},
		CrisisPool: CrisisPoolConfig{
			InitialTokens:    0,
			MaxDrawPerTask:   0,
			MaxDrawPctOfPool: 0,
		},
	}
}

// LoadBudgetConfig reads and parses the token-budget JSON config from path.
// On any error (missing file, bad JSON) it logs a warning and returns a
// generous built-in default rather than failing startup.
func LoadBudgetConfig(path string) *BudgetConfig {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("[BudgetConfig] Warning: could not read %s (%v); using generous unlimited default.", path, err)
		return defaultBudgetConfig()
	}

	var cfg BudgetConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Printf("[BudgetConfig] Warning: could not parse %s (%v); using generous unlimited default.", path, err)
		return defaultBudgetConfig()
	}

	if cfg.Roles == nil {
		cfg.Roles = map[string]RoleBudget{}
	}
	if cfg.Default.TokenBudget <= 0 {
		log.Printf("[BudgetConfig] Warning: %s has no positive default.token_budget; using generous unlimited default.", path)
		return defaultBudgetConfig()
	}

	log.Printf("[BudgetConfig] Loaded token budget config from %s (%d role overrides, crisis pool: %d tokens).",
		path, len(cfg.Roles), cfg.CrisisPool.InitialTokens)
	return &cfg
}

// BudgetFor returns the configured budget for the given agent role, falling
// back to the Default entry if the role isn't listed, or if the listed
// entry omits a positive token_budget.
func (c *BudgetConfig) BudgetFor(role string) RoleBudget {
	if rb, ok := c.Roles[role]; ok {
		if rb.TokenBudget <= 0 {
			rb.TokenBudget = c.Default.TokenBudget
		}
		if rb.CostBudgetUSD <= 0 {
			rb.CostBudgetUSD = c.Default.CostBudgetUSD
		}
		return rb
	}
	return c.Default
}
