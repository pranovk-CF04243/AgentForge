package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadModelCatalog_FallsBackToGeminiOnMissingFile(t *testing.T) {
	cfg := LoadModelCatalog("does/not/exist.json")
	if cfg.Default.Provider != "gemini" {
		t.Errorf("Expected fallback default provider 'gemini', got %q", cfg.Default.Provider)
	}
	if cfg.Default.Model == "" {
		t.Errorf("Expected fallback default model to be non-empty")
	}
}

func TestLoadModelCatalog_FallsBackOnBadJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.json")
	if err := os.WriteFile(path, []byte("{not valid json"), 0644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	cfg := LoadModelCatalog(path)
	if cfg.Default.Provider != "gemini" {
		t.Errorf("Expected fallback default provider 'gemini' on bad JSON, got %q", cfg.Default.Provider)
	}
}

func TestLoadModelCatalog_LoadsValidFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "catalog.json")
	contents := `{
		"default": {"provider": "ollama", "model": "llama3.1"},
		"available_models": [
			{"provider": "ollama", "model": "llama3.1", "label": "Llama 3.1"}
		]
	}`
	if err := os.WriteFile(path, []byte(contents), 0644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	cfg := LoadModelCatalog(path)
	if cfg.Default.Provider != "ollama" || cfg.Default.Model != "llama3.1" {
		t.Errorf("Expected default ollama/llama3.1, got %s/%s", cfg.Default.Provider, cfg.Default.Model)
	}
	if len(cfg.AvailableModels) != 1 {
		t.Errorf("Expected 1 available model, got %d", len(cfg.AvailableModels))
	}
}

func TestEffectiveModelFor_UsesOverrideWhenPresent(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	agent := o.agents["agent-backend"]
	agent.Provider = "ollama"
	agent.Model = "llama3.1"

	got := o.EffectiveModelFor(agent)
	if got.Provider != "ollama" || got.Model != "llama3.1" {
		t.Errorf("Expected override ollama/llama3.1, got %s/%s", got.Provider, got.Model)
	}
}

func TestEffectiveModelFor_FallsBackToGlobalDefaultWhenNoOverride(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	o.modelCatalog.SetDefault(ModelRef{Provider: "gemini", Model: "gemini-2.5-pro"})
	agent := o.agents["agent-backend"]
	agent.Provider = ""
	agent.Model = ""

	got := o.EffectiveModelFor(agent)
	if got.Provider != "gemini" || got.Model != "gemini-2.5-pro" {
		t.Errorf("Expected global default gemini/gemini-2.5-pro, got %s/%s", got.Provider, got.Model)
	}
}

func TestSetAgentModelOverride_PersistsAndBroadcasts(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)

	agent, err := o.SetAgentModelOverride("agent-backend", "nvidia", "meta/llama-3.1-70b-instruct")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if agent.Provider != "nvidia" || agent.Model != "meta/llama-3.1-70b-instruct" {
		t.Errorf("Expected override to be set, got %s/%s", agent.Provider, agent.Model)
	}
}

func TestSetAgentModelOverride_ClearingResetsToDefault(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	if _, err := o.SetAgentModelOverride("agent-backend", "nvidia", "meta/llama-3.1-70b-instruct"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	agent, err := o.SetAgentModelOverride("agent-backend", "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := o.EffectiveModelFor(agent)
	if got.Provider != o.modelCatalog.GetDefault().Provider {
		t.Errorf("Expected cleared override to resolve to global default")
	}
}

func TestSetAgentModelOverride_UnknownAgentErrors(t *testing.T) {
	hub := NewHub()
	o := NewOrchestrator(hub, nil)
	if _, err := o.SetAgentModelOverride("agent-does-not-exist", "gemini", "x"); err == nil {
		t.Error("Expected error for unknown agent, got nil")
	}
}

func TestSetGlobalDefaultModel_PersistsToDisk(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "catalog.json")
	contents := `{
		"default": {"provider": "gemini", "model": "gemini-2.5-flash"},
		"available_models": [
			{"provider": "gemini", "model": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"}
		]
	}`
	if err := os.WriteFile(path, []byte(contents), 0644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	cfg := LoadModelCatalog(path)
	if err := cfg.SetDefault(ModelRef{Provider: "nvidia", Model: "meta/llama-3.1-70b-instruct"}); err != nil {
		t.Fatalf("unexpected error persisting default: %v", err)
	}

	reloaded := LoadModelCatalog(path)
	if reloaded.Default.Provider != "nvidia" || reloaded.Default.Model != "meta/llama-3.1-70b-instruct" {
		t.Errorf("Expected persisted default nvidia/meta/llama-3.1-70b-instruct after reload, got %s/%s",
			reloaded.Default.Provider, reloaded.Default.Model)
	}
}
