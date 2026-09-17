package kafka_producer

import (
	"context"
	"testing"
	"time"
)

func TestAsyncChannelAuditProducer(t *testing.T) {
	producer := NewAsyncChannelAuditProducer(10)
	defer producer.Close()

	ctx := context.Background()
	event := AuditEvent{
		EventID:   "evt-123",
		EventType: "TEST_EVENT",
		Actor:     "developer@agentforge.ai",
		Resource:  "/api/v1/test",
		Action:    "POST",
		Timestamp: time.Now(),
	}

	err := producer.Publish(ctx, event)
	if err != nil {
		t.Fatalf("Failed to publish audit event: %v", err)
	}
}
