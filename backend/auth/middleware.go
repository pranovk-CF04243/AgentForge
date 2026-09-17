package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const (
	ContextKeyAPIKeyInfo contextKey = "apiKeyInfo"
)

type APIKeyInfo struct {
	ID        string   `json:"id"`
	KeyHash   string   `json:"keyHash"`
	Owner     string   `json:"owner"`
	Roles     []string `json:"roles"`
	IsActive  bool     `json:"isActive"`
}

type APIKeyStore interface {
	GetByHash(ctx context.Context, keyHash string) (*APIKeyInfo, error)
}

// ZeroTrustAuthMiddleware verifies Bearer token or X-API-Key header against the APIKeyStore
func ZeroTrustAuthMiddleware(store APIKeyStore, salt string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header or X-API-Key header
			var rawKey string
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
					rawKey = parts[1]
				}
			}
			if rawKey == "" {
				rawKey = r.Header.Get("X-API-Key")
			}

			if rawKey == "" {
				http.Error(w, `{"error": "Unauthorized: Missing API key or Bearer token"}`, http.StatusUnauthorized)
				return
			}

			if !ValidateKeyFormat(rawKey) {
				http.Error(w, `{"error": "Unauthorized: Invalid API key format"}`, http.StatusUnauthorized)
				return
			}

			keyHash := HashAPIKey(rawKey, salt)
			info, err := store.GetByHash(r.Context(), keyHash)
			if err != nil || info == nil || !info.IsActive {
				http.Error(w, `{"error": "Unauthorized: Invalid or revoked API key"}`, http.StatusUnauthorized)
				return
			}

			// Attach key info to request context
			ctx := context.WithValue(r.Context(), ContextKeyAPIKeyInfo, info)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetAPIKeyInfo extracts APIKeyInfo from context
func GetAPIKeyInfo(ctx context.Context) (*APIKeyInfo, bool) {
	info, ok := ctx.Value(ContextKeyAPIKeyInfo).(*APIKeyInfo)
	return info, ok
}
