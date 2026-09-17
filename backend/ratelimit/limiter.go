package ratelimit

import (
	"context"
	"sync"
	"time"
)

// Limiter defines the interface for token bucket rate limiting
type Limiter interface {
	Allow(ctx context.Context, key string) (bool, int, time.Duration, error)
}

// InMemoryTokenBucket implements an in-memory token bucket rate limiter as fallback or test double
type InMemoryTokenBucket struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	capacity int
	rate     float64 // tokens per second
}

type bucket struct {
	tokens     float64
	lastUpdate time.Time
}

func NewInMemoryTokenBucket(capacity int, ratePerMinute float64) *InMemoryTokenBucket {
	return &InMemoryTokenBucket{
		buckets:  make(map[string]*bucket),
		capacity: capacity,
		rate:     ratePerMinute / 60.0,
	}
}

func (l *InMemoryTokenBucket) Allow(ctx context.Context, key string) (bool, int, time.Duration, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	b, exists := l.buckets[key]
	if !exists {
		b = &bucket{
			tokens:     float64(l.capacity),
			lastUpdate: now,
		}
		l.buckets[key] = b
	}

	elapsed := now.Sub(b.lastUpdate).Seconds()
	b.tokens += elapsed * l.rate
	if b.tokens > float64(l.capacity) {
		b.tokens = float64(l.capacity)
	}
	b.lastUpdate = now

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		remaining := int(b.tokens)
		return true, remaining, 0, nil
	}

	// Calculate reset duration for 1 token
	missing := 1.0 - b.tokens
	retryAfter := time.Duration(missing/l.rate) * time.Second
	return false, 0, retryAfter, nil
}
