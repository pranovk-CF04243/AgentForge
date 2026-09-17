package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// MockRedisCacheWithExpiry simulates Redis cache with key invalidation and expiration testing
type MockRedisCacheWithExpiry struct {
	mu     sync.Mutex
	cache  map[string]cacheItem
	expiry map[string]time.Time
}

type cacheItem struct {
	value string
	roles []string
}

func NewMockRedisCache() *MockRedisCacheWithExpiry {
	return &MockRedisCacheWithExpiry{
		cache:  make(map[string]cacheItem),
		expiry: make(map[string]time.Time),
	}
}

func (m *MockRedisCacheWithExpiry) Set(key string, value string, roles []string, ttl time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache[key] = cacheItem{value: value, roles: roles}
	m.expiry[key] = time.Now().Add(ttl)
}

func (m *MockRedisCacheWithExpiry) Get(key string) (string, []string, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if exp, ok := m.expiry[key]; ok {
		if time.Now().After(exp) {
			delete(m.cache, key)
			delete(m.expiry, key)
			return "", nil, false
		}
	}
	item, ok := m.cache[key]
	if !ok {
		return "", nil, false
	}
	return item.value, item.roles, true
}

func (m *MockRedisCacheWithExpiry) Invalidate(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.cache, key)
	delete(m.expiry, key)
}

// MockStoreWithRoles for role escalation tests
type MockStoreWithRoles struct {
	mu    sync.Mutex
	users map[string]*APIKeyInfo
}

func NewMockStoreWithRoles() *MockStoreWithRoles {
	return &MockStoreWithRoles{
		users: make(map[string]*APIKeyInfo),
	}
}

func (m *MockStoreWithRoles) GetByHash(ctx context.Context, keyHash string) (*APIKeyInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if info, ok := m.users[keyHash]; ok {
		return info, nil
	}
	return nil, nil
}

// RoleAuthorizationMiddleware checks if the APIKeyInfo has required roles
func RoleAuthorizationMiddleware(requiredRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			info, ok := GetAPIKeyInfo(r.Context())
			if !ok {
				http.Error(w, `{"error": "Unauthorized: Missing identity"}`, http.StatusUnauthorized)
				return
			}

			hasRole := false
			for _, role := range info.Roles {
				if role == requiredRole || role == "admin" {
					hasRole = true
					break
				}
			}

			if !hasRole {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(`{"error": "Forbidden: Unauthorized role escalation attempt detected"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Test 1: Expired or Revoked API Key Testing
func TestExpiredAPIKeyHandling(t *testing.T) {
	store := NewMockStoreWithRoles()
	salt := "test-salt"

	handler := ZeroTrustAuthMiddleware(store, salt)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rawKey, _ := GenerateAPIKey()
	inactiveHash := HashAPIKey(rawKey, salt)
	store.users[inactiveHash] = &APIKeyInfo{
		ID:       "exp-2",
		KeyHash:  inactiveHash,
		Owner:    "revoked@agentforge.ai",
		Roles:    []string{"admin"},
		IsActive: false, // Expired / Revoked
	}

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+rawKey)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 Unauthorized for expired/revoked key, got %d", rec.Code)
	}
}

// Test 2: Unauthorized Role Escalation Testing
func TestUnauthorizedRoleEscalation(t *testing.T) {
	store := NewMockStoreWithRoles()
	salt := "test-salt"

	rawDevKey, _ := GenerateAPIKey()
	devHash := HashAPIKey(rawDevKey, salt)
	store.users[devHash] = &APIKeyInfo{
		ID:       "dev-2",
		KeyHash:  devHash,
		Owner:    "dev@agentforge.ai",
		Roles:    []string{"developer"}, // Lacks "admin" role
		IsActive: true,
	}

	targetHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	protectedHandler := ZeroTrustAuthMiddleware(store, salt)(RoleAuthorizationMiddleware("admin")(targetHandler))

	req := httptest.NewRequest(http.MethodDelete, "/admin/cluster", nil)
	req.Header.Set("X-API-Key", rawDevKey)
	rec := httptest.NewRecorder()

	protectedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("Expected status 403 Forbidden for role escalation attempt, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var errResp map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &errResp)
	if errResp["error"] == "" {
		t.Errorf("Expected error message in response body")
	}
}

// Test 3: Redis Cache Invalidation & Expiration Testing
func TestRedisCacheInvalidationAndExpiration(t *testing.T) {
	cache := NewMockRedisCache()
	key := "cache:key:hash_xyz"

	cache.Set(key, "dev@agentforge.ai", []string{"developer"}, 50*time.Millisecond)

	val, roles, found := cache.Get(key)
	if !found || val != "dev@agentforge.ai" || len(roles) != 1 {
		t.Fatalf("Expected cached item to be found")
	}

	cache.Invalidate(key)
	_, _, foundAfterInvalidate := cache.Get(key)
	if foundAfterInvalidate {
		t.Errorf("Expected cache item to be removed after Invalidate()")
	}

	cache.Set(key, "dev@agentforge.ai", []string{"developer"}, 10*time.Millisecond)
	time.Sleep(25 * time.Millisecond)

	_, _, foundAfterExpiry := cache.Get(key)
	if foundAfterExpiry {
		t.Errorf("Expected cache item to have expired after TTL")
	}
}
