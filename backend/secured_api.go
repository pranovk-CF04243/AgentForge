package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"agentforge/backend/auth"
	"agentforge/backend/kafka_producer"
	"agentforge/backend/ratelimit"
)

// MockAPIKeyStore implements auth.APIKeyStore for testing and API integration
type MockAPIKeyStore struct {
	keys map[string]*auth.APIKeyInfo
}

func NewMockAPIKeyStore() *MockAPIKeyStore {
	store := &MockAPIKeyStore{keys: make(map[string]*auth.APIKeyInfo)}
	// Pre-register test key: af_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
	rawTestKey := "af_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	salt := "test-salt-secret"
	keyHash := auth.HashAPIKey(rawTestKey, salt)
	store.keys[keyHash] = &auth.APIKeyInfo{
		ID:       "key-1",
		KeyHash:  keyHash,
		Owner:    "admin@agentforge.ai",
		Roles:    []string{"admin", "developer"},
		IsActive: true,
	}
	return store
}

func (m *MockAPIKeyStore) GetByHash(ctx context.Context, keyHash string) (*auth.APIKeyInfo, error) {
	if info, ok := m.keys[keyHash]; ok {
		return info, nil
	}
	return nil, nil
}

// KeyGenHandler handles POST /api/v1/keys for secure key generation
func KeyGenHandler(salt string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		rawKey, err := auth.GenerateAPIKey()
		if err != nil {
			http.Error(w, "Failed to generate key", http.StatusInternalServerError)
			return
		}

		keyHash := auth.HashAPIKey(rawKey, salt)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"apiKey":    rawKey,
			"keyHash":   keyHash,
			"prefix":    "af_live_",
			"createdAt": time.Now(),
		})
	}
}

// SetupSecuredRouter wraps endpoints with Zero-Trust Auth, Rate Limiting, and Audit Logging
func SetupSecuredRouter(auditProducer kafka_producer.AuditProducer, salt string) http.Handler {
	mux := http.NewServeMux()
	store := NewMockAPIKeyStore()
	limiter := ratelimit.NewInMemoryTokenBucket(100, 100) // 100 req/min

	// Key Generation Endpoint (Public or secured by admin token)
	mux.HandleFunc("/api/v1/keys", KeyGenHandler(salt))

	// Secured Protected Endpoint Example
	mux.HandleFunc("/api/v1/protected/resource", func(w http.ResponseWriter, r *http.Request) {
		info, _ := auth.GetAPIKeyInfo(r.Context())
		
		// Publish asynchronous audit event via Kafka producer
		_ = auditProducer.Publish(r.Context(), kafka_producer.AuditEvent{
			EventID:   "evt-" + time.Now().Format("20060102150405"),
			EventType: "RESOURCE_ACCESSED",
			Actor:     info.Owner,
			Resource:  r.URL.Path,
			Action:    r.Method,
			Timestamp: time.Now(),
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"message": "Access granted to zero-trust protected resource",
			"owner": info.Owner,
			"roles": info.Roles,
		})
	})

	// Wrap with Rate Limiter and Auth Middleware
	var handler http.Handler = mux
	handler = ratelimit.RateLimitMiddleware(limiter)(handler)
	handler = auth.ZeroTrustAuthMiddleware(store, salt)(handler)

	// Exclude /api/v1/keys from mandatory auth middleware if desired, or handle via sub-router
	rootMux := http.NewServeMux()
	rootMux.HandleFunc("/api/v1/keys", KeyGenHandler(salt))
	rootMux.Handle("/api/v1/protected/", handler)

	return rootMux
}
