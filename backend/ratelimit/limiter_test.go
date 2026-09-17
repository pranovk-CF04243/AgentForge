package ratelimit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInMemoryTokenBucketRateLimit(t *testing.T) {
	limiter := NewInMemoryTokenBucket(2, 60) // capacity 2, 60 per minute (1 per sec)
	ctx := context.Background()

	// 1st request should be allowed
	allowed, _, _, err := limiter.Allow(ctx, "client-1")
	if err != nil || !allowed {
		t.Fatalf("Expected allowed=true, got allowed=%v, err=%v", allowed, err)
	}

	// 2nd request should be allowed
	allowed, _, _, _ = limiter.Allow(ctx, "client-1")
	if !allowed {
		t.Errorf("Expected 2nd request to be allowed")
	}

	// 3rd request should be rate limited (exceeds capacity 2)
	allowed, _, _, _ = limiter.Allow(ctx, "client-1")
	if allowed {
		t.Errorf("Expected 3rd request to be rate limited")
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	limiter := NewInMemoryTokenBucket(1, 60)
	handler := RateLimitMiddleware(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	req1.Header.Set("X-API-Key", "af_live_test")
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.Header.Set("X-API-Key", "af_live_test")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429 Too Many Requests, got %d", rec2.Code)
	}
}
