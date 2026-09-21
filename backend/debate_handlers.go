package main

import (
	"encoding/json"
	"net/http"
	"time"
)

func (h *APIHandler) HandlePostDebateMessage(w http.ResponseWriter, r *http.Request) {
	if !verifyInternalSecret(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var msg DebateMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	msg.CreatedAt = time.Now()

	payload := map[string]interface{}{
		"id":        msg.ID,
		"sessionId": msg.SessionID,
		"agentId":   msg.AgentID,
		"content":   msg.Content,
		"createdAt": msg.CreatedAt,
	}
	data, _ := json.Marshal(map[string]interface{}{
		"action": "EVENT",
		"event": SystemEvent{
			ID:        generateID(),
			Type:      "debate.message",
			Source:    "orchestrator",
			Message:   "New debate message",
			Payload:   payload,
			Timestamp: time.Now(),
		},
	})
	h.orchestrator.hub.Broadcast(data)

	w.WriteHeader(http.StatusOK)
}

func (h *APIHandler) HandleStartDebate(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		ProjectID string `json:"projectId"`
		TaskID    string `json:"taskId"`
		Topic     string `json:"topic"`
		Proposer  string `json:"proposer"`
		Reviewer  string `json:"reviewer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	session := DebateSession{
		ID:              generateID(),
		ProjectID:       payload.ProjectID,
		TaskID:          payload.TaskID,
		ProposerAgentID: payload.Proposer,
		ReviewerAgentID: payload.Reviewer,
		Topic:           payload.Topic,
		Status:          "active",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	data, _ := json.Marshal(map[string]interface{}{
		"action": "EVENT",
		"event": SystemEvent{
			ID:        generateID(),
			Type:      "debate.started",
			Source:    "orchestrator",
			Message:   "Debate session started",
			Payload:   map[string]interface{}{"session": session},
			Timestamp: time.Now(),
		},
	})
	h.orchestrator.hub.Broadcast(data)

	go h.orchestrator.DispatchDebateToRuntime(session)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(session)
}
