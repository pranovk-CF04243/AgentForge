package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockStore struct {
	info *APIKeyInfo
}

func (m *mockStore) GetByHash(ctx context.Context, keyHash string) (*APIKeyInfo, error) {
	if m.info != nil && m.info.KeyHash == keyHash {
		return m.info, nil
	}
	return nil, nil
}

func TestGenerateAndValidateAPIKey(t *testing.T) {
	rawKey, err := GenerateAPIKey()
	if err != nil {
		t.Fatalf("Failed to generate API key: %v", err)
	}

	if !ValidateKeyFormat(rawKey) {
		t.Errorf("Expected valid key format for %s", rawKey)
	}

	salt := "somesalt"
	hash := HashAPIKey(rawKey, salt)

	store := &mockStore{
		info: &APIKeyInfo{
			ID:       "1",
			KeyHash:  hash,
			Owner:    "test@agentforge.ai",
			Roles:    []string{"admin"},
			IsActive: true,
		},
	}

	handler := ZeroTrustAuthMiddleware(store, salt)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, ok := GetAPIKeyInfo(r.Context())
		if !ok || info.Owner != "test@agentforge.ai" {
			t.Errorf("Expected valid APIKeyInfo in context")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+rawKey)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}
}

func TestZeroTrustAuthUnauthorized(t *testing.T) {
	store := &mockStore{}
	salt := "somesalt"

	handler := ZeroTrustAuthMiddleware(store, salt)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", "af_live_invalidkey")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 unauthorized, got %d", rec.Code)
	}
}
