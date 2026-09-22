package main

import (
	"encoding/json"
	"log"
	"os"
	"sync"
)

// ModelCatalog is the parsed contents of config/model_catalog.json: the
// global default (provider, model) LLM choice, and the list of selectable
// entries used to populate the frontend's model dropdowns. Loaded once at
// startup, like BudgetConfig; unlike BudgetConfig, its Default can be
// updated at runtime (via PUT /api/config/models/default) and that change
// is persisted back to the same JSON file on disk, so it survives a
// backend restart.
type ModelCatalog struct {
	mu              sync.RWMutex
	path            string
	Default         ModelRef               `json:"default"`
	AvailableModels []AvailableModelEntry  `json:"available_models"`
}

// defaultModelCatalog is used when the JSON file is missing or unparsable,
// so the backend degrades gracefully instead of failing to start. It falls
// back to Gemini only, using GEMINI_MODEL if set.
func defaultModelCatalog(path string) *ModelCatalog {
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.5-flash"
	}
	return &ModelCatalog{
		path:    path,
		Default: ModelRef{Provider: "gemini", Model: model},
		AvailableModels: []AvailableModelEntry{
			{Provider: "gemini", Model: model, Label: "Gemini (default)"},
		},
	}
}

// LoadModelCatalog reads and parses the model-catalog JSON config from
// path. On any error (missing file, bad JSON, missing default) it logs a
// warning and returns a Gemini-only built-in default rather than failing
// startup.
func LoadModelCatalog(path string) *ModelCatalog {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("[ModelCatalog] Warning: could not read %s (%v); using Gemini-only default.", path, err)
		return defaultModelCatalog(path)
	}

	var cfg ModelCatalog
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Printf("[ModelCatalog] Warning: could not parse %s (%v); using Gemini-only default.", path, err)
		return defaultModelCatalog(path)
	}

	if cfg.Default.Provider == "" || cfg.Default.Model == "" {
		log.Printf("[ModelCatalog] Warning: %s has no valid default provider/model; using Gemini-only default.", path)
		return defaultModelCatalog(path)
	}

	cfg.path = path
	log.Printf("[ModelCatalog] Loaded model catalog from %s (default: %s/%s, %d selectable models).",
		path, cfg.Default.Provider, cfg.Default.Model, len(cfg.AvailableModels))
	return &cfg
}

// GetDefault returns a copy of the current global default (thread-safe).
func (c *ModelCatalog) GetDefault() ModelRef {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Default
}

// SetDefault updates the in-memory global default and persists it back to
// the JSON config file on disk, so it survives a backend restart. If the
// disk write fails, the in-memory value still takes effect for the running
// process — the error is logged and returned for the caller's awareness,
// but does not roll back the in-memory change.
func (c *ModelCatalog) SetDefault(ref ModelRef) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Default = ref
	return c.persistLocked()
}

// persistLocked writes the current catalog (default + available_models)
// back to disk. Callers must hold c.mu.
func (c *ModelCatalog) persistLocked() error {
	if c.path == "" {
		return nil
	}
	out := struct {
		Default         ModelRef               `json:"default"`
		AvailableModels []AvailableModelEntry  `json:"available_models"`
	}{c.Default, c.AvailableModels}

	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		log.Printf("[ModelCatalog] Warning: failed to marshal catalog for persistence: %v", err)
		return err
	}
	if err := os.WriteFile(c.path, data, 0644); err != nil {
		log.Printf("[ModelCatalog] Warning: failed to persist default to %s: %v", c.path, err)
		return err
	}
	return nil
}

// Snapshot returns a JSON-serializable copy for GET /api/config/models.
func (c *ModelCatalog) Snapshot() ModelCatalogResponse {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return ModelCatalogResponse{Default: c.Default, AvailableModels: c.AvailableModels}
}
