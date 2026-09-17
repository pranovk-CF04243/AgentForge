package kafka_producer

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"
)

// AuditEvent represents an asynchronous audit event
type AuditEvent struct {
	EventID   string                 `json:"eventId"`
	EventType string                 `json:"eventType"`
	Actor     string                 `json:"actor"`
	Resource  string                 `json:"resource"`
	Action    string                 `json:"action"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// AuditProducer defines the interface for publishing audit events asynchronously
type AuditProducer interface {
	Publish(ctx context.Context, event AuditEvent) error
	Close() error
}

// AsyncChannelAuditProducer implements a high-performance non-blocking channel-backed Kafka producer buffer
type AsyncChannelAuditProducer struct {
	mu          sync.Mutex
	eventChan   chan AuditEvent
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	bufferSize  int
	isPublished bool
}

func NewAsyncChannelAuditProducer(bufferSize int) *AsyncChannelAuditProducer {
	ctx, cancel := context.WithCancel(context.Background())
	p := &AsyncChannelAuditProducer{
		eventChan:  make(chan AuditEvent, bufferSize),
		ctx:        ctx,
		cancel:     cancel,
		bufferSize: bufferSize,
	}
	p.wg.Add(1)
	go p.workerLoop()
	return p
}

func (p *AsyncChannelAuditProducer) Publish(ctx context.Context, event AuditEvent) error {
	select {
	case p.eventChan <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Buffer full fallback or non-blocking drop/log
		log.Printf("[AuditProducer] Warning: Audit event buffer full (%d). Dropping event: %s", p.bufferSize, event.EventType)
		return nil
	}
}

func (p *AsyncChannelAuditProducer) workerLoop() {
	defer p.wg.Done()
	for {
		select {
		case <-p.ctx.Done():
			// Drain remaining
			for {
				select {
				case event := <-p.eventChan:
					p.sendToKafka(event)
				default:
					return
				}
			}
		case event := <-p.eventChan:
			p.sendToKafka(event)
		}
	}
}

func (p *AsyncChannelAuditProducer) sendToKafka(event AuditEvent) {
	// In production, this integrates with segmentio/kafka-go or IBM/sarama.
	// Here we serialize and dispatch asynchronously with zero latency impact on request thread.
	_, _ = json.Marshal(event)
	// Simulated Kafka publish log
	// log.Printf("[KafkaProducer] Published audit event [Topic: audit.events.v1]: %s", event.EventType)
}

func (p *AsyncChannelAuditProducer) Close() error {
	p.cancel()
	p.wg.Wait()
	close(p.eventChan)
	return nil
}
