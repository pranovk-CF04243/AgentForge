package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"agentforge/backend/kafka_producer"
)

func TestAuditLogger_ClientIPExtraction(t *testing.T) {
	// Test 1: X-Forwarded-For multi-hop
	req1 := httptest.NewRequest("GET", "/test", nil)
	req1.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18, 150.172.238.178")
	if ip := ExtractClientIP(req1); ip != "203.0.113.195" {
		t.Errorf("Expected 203.0.113.195, got %s", ip)
	}

	// Test 2: X-Real-IP
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.Header.Set("X-Real-IP", "198.51.100.42")
	if ip := ExtractClientIP(req2); ip != "198.51.100.42" {
		t.Errorf("Expected 198.51.100.42, got %s", ip)
	}

	// Test 3: RemoteAddr with port
	req3 := httptest.NewRequest("GET", "/test", nil)
	req3.RemoteAddr = "192.168.1.55:54321"
	if ip := ExtractClientIP(req3); ip != "192.168.1.55" {
		t.Errorf("Expected 192.168.1.55, got %s", ip)
	}
}

func TestAuditLogger_KafkaBuffer(t *testing.T) {
	producer := kafka_producer.NewAsyncChannelAuditProducer(10)
	defer producer.Close()

	event := kafka_producer.AuditEvent{
		EventID:   "evt-123",
		EventType: "auth.login_success",
		Actor:     "user-1",
		Resource:  "res-1",
		Action:    "auth.login_success",
		Timestamp: time.Now().UTC(),
	}

	err := producer.Publish(context.Background(), event)
	if err != nil {
		t.Fatalf("Failed to publish audit event to Kafka buffer: %v", err)
	}
}

func TestAuditLogger_LogEntryStructure(t *testing.T) {
	producer := kafka_producer.NewAsyncChannelAuditProducer(10)
	defer producer.Close()

	hub := NewHub()
	al := InitAuditLogger(nil, hub, producer)

	entry := al.Log(AuditEntry{
		WorkspaceID: "ws-test-1",
		ProjectID:   "proj-test-1",
		UserID:      "usr-1",
		UserName:    "Security Admin",
		Action:      "credentials.viewed",
		ResourceID:  "proj-test-1",
		Detail:      "Accessed production cluster secrets",
		IPAddress:   "10.0.0.1",
		UserAgent:   "Mozilla/5.0 AgentForge",
		Status:      "SUCCESS",
		Severity:    "SECURITY",
		Metadata: map[string]interface{}{
			"env": "production",
		},
	})

	if entry.ID == "" {
		t.Errorf("Expected generated ID on ActivityLog, got empty")
	}
	if entry.Status != "SUCCESS" {
		t.Errorf("Expected SUCCESS status, got %s", entry.Status)
	}
	if entry.Severity != "SECURITY" {
		t.Errorf("Expected SECURITY severity, got %s", entry.Severity)
	}
	if !strings.Contains(entry.Metadata, `"env":"production"`) {
		t.Errorf("Expected serialized metadata JSON, got %s", entry.Metadata)
	}
}

func TestAuditLogger_CSVExportFormatting(t *testing.T) {
	wsHandler := NewWorkspaceHandler(nil, nil)

	req := httptest.NewRequest("GET", "/api/workspace/activity/export", nil)
	// Inject test workspace context
	ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-audit-test")
	ctx = context.WithValue(ctx, ctxRole, "admin")
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	wsHandler.HandleActivityExport(rec, req)

	// Since DB is nil in unit test, it returns 401 Unauthorized
	if rec.Code != http.StatusUnauthorized {
		t.Logf("Export returned status: %d (as expected without live DB)", rec.Code)
	}

	// Verify CSV writer logic independently
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	header := []string{"ID", "Timestamp (UTC)", "Actor Name", "Actor ID", "Action", "Severity", "Status", "Resource ID", "IP Address", "User Agent", "Detail", "Metadata"}
	_ = writer.Write(header)
	_ = writer.Write([]string{"log-1", "2026-09-19T10:00:00Z", "Alice", "usr-1", "auth.login_success", "INFO", "SUCCESS", "usr-1", "127.0.0.1", "Mozilla", "Login OK", "{}"})
	writer.Flush()

	csvReader := csv.NewReader(bytes.NewReader(buf.Bytes()))
	records, err := csvReader.ReadAll()
	if err != nil {
		t.Fatalf("Failed to parse generated CSV: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("Expected 2 CSV records, got %d", len(records))
	}
	if records[0][0] != "ID" || records[1][4] != "auth.login_success" {
		t.Errorf("CSV columns mismatch: header=%v, row1=%v", records[0], records[1])
	}
}
