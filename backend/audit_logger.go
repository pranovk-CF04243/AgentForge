package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"agentforge/backend/kafka_producer"
	"gorm.io/gorm"
)

// AuditEntry encapsulates all contextual data for a security or operational event.
type AuditEntry struct {
	WorkspaceID string                 `json:"workspaceId"`
	ProjectID   string                 `json:"projectId,omitempty"`
	UserID      string                 `json:"userId"`
	UserName    string                 `json:"userName"`
	Action      string                 `json:"action"` // e.g. "auth.login_success", "credentials.viewed"
	ResourceID  string                 `json:"resourceId,omitempty"`
	Detail      string                 `json:"detail,omitempty"`
	IPAddress   string                 `json:"ipAddress,omitempty"`
	UserAgent   string                 `json:"userAgent,omitempty"`
	Status      string                 `json:"status,omitempty"`   // "SUCCESS" | "FAILURE"
	Severity    string                 `json:"severity,omitempty"` // "INFO" | "WARN" | "CRITICAL" | "SECURITY"
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AuditLogger manages persistent storage, real-time dispatch, and streaming of audit records.
type AuditLogger struct {
	db       *gorm.DB
	hub      *Hub
	producer kafka_producer.AuditProducer
}

var globalAuditLogger *AuditLogger

// InitAuditLogger initializes the global audit logging subsystem.
func InitAuditLogger(db *gorm.DB, hub *Hub, producer kafka_producer.AuditProducer) *AuditLogger {
	al := &AuditLogger{
		db:       db,
		hub:      hub,
		producer: producer,
	}
	globalAuditLogger = al
	return al
}

// GetAuditLogger returns the current global AuditLogger instance.
func GetAuditLogger() *AuditLogger {
	return globalAuditLogger
}

// ExtractClientIP extracts the originating client IP address from proxy headers or remote socket.
func ExtractClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	// Check X-Forwarded-For (take the first hop)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	// Check X-Real-IP
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		ip := strings.TrimSpace(xrip)
		if ip != "" {
			return ip
		}
	}
	// RemoteAddr fallback
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

// Log records an audit event to DB, broadcasts to WebSocket clients, and emits to Kafka.
func (al *AuditLogger) Log(entry AuditEntry) *ActivityLog {
	status := entry.Status
	if status == "" {
		status = "SUCCESS"
	}
	severity := entry.Severity
	if severity == "" {
		severity = "INFO"
	}

	var metadataStr string
	if len(entry.Metadata) > 0 {
		if b, err := json.Marshal(entry.Metadata); err == nil {
			metadataStr = string(b)
		}
	}

	dbInstance := al.db
	if dbInstance == nil {
		dbInstance = DB
	}

	logRecord := ActivityLog{
		ID:          generateID(),
		WorkspaceID: entry.WorkspaceID,
		ProjectID:   entry.ProjectID,
		UserID:      entry.UserID,
		UserName:    entry.UserName,
		Action:      entry.Action,
		ResourceID:  entry.ResourceID,
		Detail:      entry.Detail,
		IPAddress:   entry.IPAddress,
		UserAgent:   entry.UserAgent,
		Status:      status,
		Severity:    severity,
		Metadata:    metadataStr,
		CreatedAt:   time.Now().UTC(),
	}

	if dbInstance != nil {
		if err := dbInstance.Create(&logRecord).Error; err != nil {
			log.Printf("[AuditLog] Warning: failed to persist audit log: %v", err)
		}
	}

	// Real-time broadcast to connected workspace clients
	if al.hub != nil && entry.WorkspaceID != "" {
		msg, err := json.Marshal(map[string]interface{}{
			"action": "ACTIVITY_FEED",
			"entry":  logRecord,
		})
		if err == nil {
			al.hub.BroadcastToWorkspace(entry.WorkspaceID, msg)
		}
	}

	// Non-blocking asynchronous Kafka event publication
	if al.producer != nil {
		_ = al.producer.Publish(context.Background(), kafka_producer.AuditEvent{
			EventID:   logRecord.ID,
			EventType: entry.Action,
			Actor:     entry.UserID,
			Resource:  entry.ResourceID,
			Action:    entry.Action,
			Metadata:  entry.Metadata,
			Timestamp: logRecord.CreatedAt,
		})
	}

	return &logRecord
}

// LogAudit is the public package helper for recording audit events.
func LogAudit(entry AuditEntry) *ActivityLog {
	if globalAuditLogger != nil {
		return globalAuditLogger.Log(entry)
	}
	al := &AuditLogger{db: DB}
	return al.Log(entry)
}
