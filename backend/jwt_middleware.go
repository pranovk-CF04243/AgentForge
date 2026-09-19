package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// ─── Context Keys ───────────────────────────────────────────────────────────

type ctxKey string

const (
	ctxUserID      ctxKey = "userID"
	ctxUserName    ctxKey = "userName"
	ctxWorkspaceID ctxKey = "workspaceID"
	ctxRole        ctxKey = "role"
)

// ─── Role Hierarchy ─────────────────────────────────────────────────────────

var roleRank = map[string]int{
	"owner":     4,
	"admin":     3,
	"developer": 2,
	"viewer":    1,
}

// AtLeastRole returns true if actual >= required in the role hierarchy.
func AtLeastRole(actual, required string) bool {
	return roleRank[actual] >= roleRank[required]
}

// ─── JWT (stdlib HS256 — no external dependency) ────────────────────────────

type JWTClaims struct {
	Sub         string `json:"sub"`
	Name        string `json:"name"`
	WorkspaceID string `json:"workspace_id"`
	Role        string `json:"role"`
	Exp         int64  `json:"exp"`
	Iat         int64  `json:"iat"`
}

func jwtHeaderEncoded() string {
	h, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	return base64.RawURLEncoding.EncodeToString(h)
}

// SignJWT creates a signed HS256 JWT string.
func SignJWT(claims JWTClaims, secret string) (string, error) {
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	header := jwtHeaderEncoded()
	body := header + "." + base64.RawURLEncoding.EncodeToString(payload)
	sig := jwtHmacSHA256(body, secret)
	return body + "." + sig, nil
}

// VerifyJWT parses and validates a JWT string, returns claims or error.
func VerifyJWT(token, secret string) (*JWTClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed token")
	}
	body := parts[0] + "." + parts[1]
	expected := jwtHmacSHA256(body, secret)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return nil, fmt.Errorf("invalid signature")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}
	var claims JWTClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("claims error: %w", err)
	}
	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}
	return &claims, nil
}

func jwtHmacSHA256(data, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// ─── Middleware ──────────────────────────────────────────────────────────────

// JWTMiddleware validates Bearer token and injects user context.
// Routes matching any publicPrefixes pass through without validation.
func JWTMiddleware(secret string, publicPrefixes []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, prefix := range publicPrefixes {
				if strings.HasPrefix(r.URL.Path, prefix) {
					next.ServeHTTP(w, r)
					return
				}
			}
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeJSONError(w, "Unauthorized: missing Bearer token", http.StatusUnauthorized)
				return
			}
			rawToken := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := VerifyJWT(rawToken, secret)
			if err != nil {
				writeJSONError(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ctxUserID, claims.Sub)
			ctx = context.WithValue(ctx, ctxUserName, claims.Name)
			ctx = context.WithValue(ctx, ctxWorkspaceID, claims.WorkspaceID)
			ctx = context.WithValue(ctx, ctxRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns middleware that enforces a minimum role.
func RequireRole(minRole string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(ctxRole).(string)
			if !AtLeastRole(role, minRole) {
				writeJSONError(w, fmt.Sprintf("Forbidden: requires '%s' role or higher", minRole), http.StatusForbidden)
				return
			}
			next(w, r)
		}
	}
}

// ─── Context Helpers ────────────────────────────────────────────────────────

func ctxGetUserID(r *http.Request) string {
	v, _ := r.Context().Value(ctxUserID).(string)
	return v
}
func ctxGetUserName(r *http.Request) string {
	v, _ := r.Context().Value(ctxUserName).(string)
	return v
}
func ctxGetWorkspaceID(r *http.Request) string {
	v, _ := r.Context().Value(ctxWorkspaceID).(string)
	return v
}
func ctxGetRole(r *http.Request) string {
	v, _ := r.Context().Value(ctxRole).(string)
	return v
}

// writeJSONError writes a standard JSON error response.
func writeJSONError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	fmt.Fprintf(w, "{\"error\":%q}", msg)
}

// isOriginAllowed checks if the origin is in the trusted allowlist.
func isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	defaultAllowed := map[string]bool{
		"http://localhost:3000": true,
		"http://127.0.0.1:3000": true,
		"http://localhost:8080": true,
		"http://127.0.0.1:8080": true,
	}
	if defaultAllowed[origin] {
		return true
	}
	extra := os.Getenv("ALLOWED_ORIGINS")
	if extra != "" {
		for _, o := range strings.Split(extra, ",") {
			if strings.TrimSpace(o) == origin {
				return true
			}
		}
	}
	return false
}

// CORSMiddleware injects CORS headers against an explicit allowlist and responds to preflight OPTIONS requests.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Set("Vary", "Origin")

		if origin != "" {
			if isOriginAllowed(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Internal-Secret")
				w.Header().Set("Access-Control-Max-Age", "86400")
			} else if r.Method == http.MethodOptions {
				// Reject untrusted origin preflights
				w.WriteHeader(http.StatusForbidden)
				return
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// SecurityHeadersMiddleware injects defensive browser security headers.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:;")
		next.ServeHTTP(w, r)
	})
}

// MaxBytesMiddleware enforces a strict request body size limit to avoid memory exhaustion / DoS attacks.
func MaxBytesMiddleware(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}
