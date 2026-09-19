package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSecurityHeadersMiddleware(t *testing.T) {
	handler := SecurityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("Expected X-Frame-Options: DENY, got %s", rec.Header().Get("X-Frame-Options"))
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("Expected X-Content-Type-Options: nosniff, got %s", rec.Header().Get("X-Content-Type-Options"))
	}
	if rec.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
		t.Errorf("Expected Referrer-Policy: strict-origin-when-cross-origin, got %s", rec.Header().Get("Referrer-Policy"))
	}
	if rec.Header().Get("X-XSS-Protection") != "1; mode=block" {
		t.Errorf("Expected X-XSS-Protection: 1; mode=block, got %s", rec.Header().Get("X-XSS-Protection"))
	}
}

func TestCORSOriginAllowlist(t *testing.T) {
	handler := CORSMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// 1. Trusted Origin
	reqTrusted := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	reqTrusted.Header.Set("Origin", "http://localhost:3000")
	recTrusted := httptest.NewRecorder()
	handler.ServeHTTP(recTrusted, reqTrusted)

	if recTrusted.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("Expected Access-Control-Allow-Origin for localhost:3000, got %s", recTrusted.Header().Get("Access-Control-Allow-Origin"))
	}
	if recTrusted.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("Expected Access-Control-Allow-Credentials: true")
	}

	// 2. Untrusted Origin OPTIONS Preflight -> Must be 403 Forbidden
	reqUntrusted := httptest.NewRequest(http.MethodOptions, "/api/projects", nil)
	reqUntrusted.Header.Set("Origin", "https://malicious-site.com")
	recUntrusted := httptest.NewRecorder()
	handler.ServeHTTP(recUntrusted, reqUntrusted)

	if recUntrusted.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for untrusted origin preflight, got %d", recUntrusted.Code)
	}

	// 3. Untrusted Origin GET -> Must NOT reflect origin
	reqUntrustedGet := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	reqUntrustedGet.Header.Set("Origin", "https://malicious-site.com")
	recUntrustedGet := httptest.NewRecorder()
	handler.ServeHTTP(recUntrustedGet, reqUntrustedGet)

	if recUntrustedGet.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("Untrusted origin should not have Access-Control-Allow-Origin header set, got %s", recUntrustedGet.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestMaxBytesMiddleware(t *testing.T) {
	maxBytes := int64(64) // Small 64-byte limit for test
	handler := MaxBytesMiddleware(maxBytes)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, 128)
		_, err := r.Body.Read(buf)
		if err != nil {
			http.Error(w, "Payload too large: "+err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Payload exceeds 64 bytes
	largeBody := bytes.Repeat([]byte("A"), 120)
	req := httptest.NewRequest(http.MethodPost, "/api/test", bytes.NewReader(largeBody))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("Expected 413 Request Entity Too Large for oversized payload, got %d", rec.Code)
	}
}

func TestVerifyInternalSecret(t *testing.T) {
	// Without header -> false
	reqNoHeader := httptest.NewRequest(http.MethodPost, "/api/internal/task-event", nil)
	if verifyInternalSecret(reqNoHeader) {
		t.Errorf("verifyInternalSecret should return false when header is missing")
	}

	// With wrong header -> false
	reqWrong := httptest.NewRequest(http.MethodPost, "/api/internal/task-event", nil)
	reqWrong.Header.Set("X-Internal-Secret", "wrong-secret")
	if verifyInternalSecret(reqWrong) {
		t.Errorf("verifyInternalSecret should return false for invalid secret")
	}

	// With valid dev secret -> true
	reqValid := httptest.NewRequest(http.MethodPost, "/api/internal/task-event", nil)
	reqValid.Header.Set("X-Internal-Secret", "agentforge-internal-dev-secret")
	if !verifyInternalSecret(reqValid) {
		t.Errorf("verifyInternalSecret should return true for valid secret")
	}
}

func TestOTPHashAndConstantTimeComparison(t *testing.T) {
	otp := generateOTP()
	if len(otp) != 6 {
		t.Errorf("Expected 6-digit OTP, got %s", otp)
	}

	hash1 := hashToken(otp)
	hash2 := hashToken(otp)

	if subtle.ConstantTimeCompare([]byte(hash1), []byte(hash2)) != 1 {
		t.Errorf("Constant-time comparison failed for identical OTP hashes")
	}

	wrongHash := hashToken("000000")
	if subtle.ConstantTimeCompare([]byte(hash1), []byte(wrongHash)) == 1 && otp != "000000" {
		t.Errorf("Constant-time comparison falsely matched different OTP hashes")
	}
}

func TestLoginRateLimiting(t *testing.T) {
	authHandler := NewAuthHandler(nil)
	ctx := context.Background()
	key := "login:192.168.1.50:test@example.com"

	// 5 burst attempts should all be allowed
	for i := 0; i < 5; i++ {
		allowed, remaining, _, _ := authHandler.loginLimiter.Allow(ctx, key)
		if !allowed {
			t.Fatalf("Attempt %d should have been allowed (remaining: %d)", i+1, remaining)
		}
	}

	// 6th immediate attempt must be blocked by the rate limiter
	allowed, _, retryAfter, _ := authHandler.loginLimiter.Allow(ctx, key)
	if allowed {
		t.Errorf("6th attempt should be blocked by login rate limiter")
	}
	if retryAfter <= 0 {
		t.Errorf("Expected positive retryAfter duration, got %v", retryAfter)
	}
}

func TestOTPRequestRateLimiting(t *testing.T) {
	authHandler := NewAuthHandler(nil)
	ctx := context.Background()
	key := "otp-req:192.168.1.60:test-invite-token"

	// 3 burst attempts allowed
	for i := 0; i < 3; i++ {
		allowed, _, _, _ := authHandler.otpReqLimiter.Allow(ctx, key)
		if !allowed {
			t.Fatalf("OTP request %d should have been allowed", i+1)
		}
	}

	// 4th attempt must be blocked
	allowed, _, _, _ := authHandler.otpReqLimiter.Allow(ctx, key)
	if allowed {
		t.Errorf("4th OTP request should be blocked by rate limiter")
	}
}

func TestOTPVerificationRateLimiting(t *testing.T) {
	authHandler := NewAuthHandler(nil)
	ctx := context.Background()
	key := "otp-verify:test-invite-token"

	// 5 burst verification attempts allowed
	for i := 0; i < 5; i++ {
		allowed, _, _, _ := authHandler.otpVerifyLimiter.Allow(ctx, key)
		if !allowed {
			t.Fatalf("OTP verification attempt %d should have been allowed", i+1)
		}
	}

	// 6th attempt must be blocked
	allowed, _, _, _ := authHandler.otpVerifyLimiter.Allow(ctx, key)
	if allowed {
		t.Errorf("6th OTP verification attempt should be blocked by rate limiter")
	}
}

func TestAuthenticateRequestToken(t *testing.T) {
	secret := "agentforge-dev-secret-change-in-production"
	claims := JWTClaims{
		Sub:         "u-123",
		Name:        "Alice Vance",
		WorkspaceID: "ws-456",
		Role:        "developer",
		Iat:         time.Now().Unix(),
		Exp:         time.Now().Add(1 * time.Hour).Unix(),
	}
	validToken, err := SignJWT(claims, secret)
	if err != nil {
		t.Fatalf("SignJWT failed: %v", err)
	}

	// 1. Missing token -> should fail
	reqNoToken := httptest.NewRequest(http.MethodGet, "/ws", nil)
	_, err = authenticateRequestToken(reqNoToken)
	if err == nil {
		t.Errorf("authenticateRequestToken should fail when token is missing")
	}

	// 2. Token in query param -> should succeed
	reqQuery := httptest.NewRequest(http.MethodGet, "/ws?token="+validToken, nil)
	claimsOut, err := authenticateRequestToken(reqQuery)
	if err != nil {
		t.Fatalf("authenticateRequestToken failed for query param token: %v", err)
	}
	if claimsOut.Sub != "u-123" || claimsOut.Role != "developer" {
		t.Errorf("Claims mismatch: %+v", claimsOut)
	}

	// 3. Token in Bearer header -> should succeed
	reqHeader := httptest.NewRequest(http.MethodGet, "/api/events/stream", nil)
	reqHeader.Header.Set("Authorization", "Bearer "+validToken)
	claimsOut2, err := authenticateRequestToken(reqHeader)
	if err != nil {
		t.Fatalf("authenticateRequestToken failed for Authorization header: %v", err)
	}
	if claimsOut2.WorkspaceID != "ws-456" {
		t.Errorf("WorkspaceID mismatch: %s", claimsOut2.WorkspaceID)
	}

	// 4. Invalid token -> should fail
	reqInvalid := httptest.NewRequest(http.MethodGet, "/ws?token=invalid.jwt.signature", nil)
	_, err = authenticateRequestToken(reqInvalid)
	if err == nil {
		t.Errorf("authenticateRequestToken should fail for malformed/invalid token")
	}
}

func TestUserPublicDTOLeakage(t *testing.T) {
	user := &User{
		ID:           "usr-secret-id",
		Email:        "user@agentforge.ai",
		Name:         "Secret Agent",
		PasswordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890",
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	dto := toUserDTO(user)

	if dto.ID != user.ID {
		t.Errorf("DTO ID mismatch")
	}
	if dto.Email != user.Email {
		t.Errorf("DTO Email mismatch")
	}
	if dto.Name != user.Name {
		t.Errorf("DTO Name mismatch")
	}

	// Verify that UserPublicDTO struct does not contain PasswordHash field
	// (verified at compile-time as dto has no PasswordHash field)
	dtoStr := fmt.Sprintf("%+v", dto)
	if bytes.Contains([]byte(dtoStr), []byte("$2a$10$")) {
		t.Errorf("UserPublicDTO leaked password hash!")
	}
}
