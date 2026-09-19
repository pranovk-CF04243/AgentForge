package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSignAndVerifyJWT(t *testing.T) {
	secret := "test-secret-key-12345"
	claims := JWTClaims{
		Sub:         "user-1",
		Name:        "Test User",
		WorkspaceID: "ws-1",
		Role:        "admin",
		Iat:         time.Now().Unix(),
		Exp:         time.Now().Add(1 * time.Hour).Unix(),
	}

	token, err := SignJWT(claims, secret)
	if err != nil {
		t.Fatalf("SignJWT failed: %v", err)
	}
	if token == "" {
		t.Fatal("Expected non-empty token")
	}

	parsed, err := VerifyJWT(token, secret)
	if err != nil {
		t.Fatalf("VerifyJWT failed: %v", err)
	}
	if parsed.Sub != "user-1" {
		t.Errorf("Expected sub 'user-1', got '%s'", parsed.Sub)
	}
	if parsed.Role != "admin" {
		t.Errorf("Expected role 'admin', got '%s'", parsed.Role)
	}
	if parsed.WorkspaceID != "ws-1" {
		t.Errorf("Expected workspace_id 'ws-1', got '%s'", parsed.WorkspaceID)
	}
}

func TestVerifyJWTExpired(t *testing.T) {
	secret := "test-secret-key-12345"
	claims := JWTClaims{
		Sub:         "user-2",
		Name:        "Expired User",
		WorkspaceID: "ws-1",
		Role:        "developer",
		Iat:         time.Now().Add(-2 * time.Hour).Unix(),
		Exp:         time.Now().Add(-1 * time.Hour).Unix(),
	}

	token, err := SignJWT(claims, secret)
	if err != nil {
		t.Fatalf("SignJWT failed: %v", err)
	}

	_, err = VerifyJWT(token, secret)
	if err == nil {
		t.Fatal("Expected error for expired token, got nil")
	}
}

func TestVerifyJWTWrongSecret(t *testing.T) {
	claims := JWTClaims{
		Sub:         "user-3",
		Name:        "User 3",
		WorkspaceID: "ws-1",
		Role:        "viewer",
		Iat:         time.Now().Unix(),
		Exp:         time.Now().Add(1 * time.Hour).Unix(),
	}

	token, err := SignJWT(claims, "correct-secret")
	if err != nil {
		t.Fatalf("SignJWT failed: %v", err)
	}

	_, err = VerifyJWT(token, "wrong-secret")
	if err == nil {
		t.Fatal("Expected signature verification failure, got nil")
	}
}

func TestRoleHierarchy(t *testing.T) {
	cases := []struct {
		actual   string
		required string
		expected bool
	}{
		{"owner", "owner", true},
		{"owner", "admin", true},
		{"owner", "developer", true},
		{"owner", "viewer", true},

		{"admin", "owner", false},
		{"admin", "admin", true},
		{"admin", "developer", true},
		{"admin", "viewer", true},

		{"developer", "owner", false},
		{"developer", "admin", false},
		{"developer", "developer", true},
		{"developer", "viewer", true},

		{"viewer", "owner", false},
		{"viewer", "admin", false},
		{"viewer", "developer", false},
		{"viewer", "viewer", true},

		{"unknown", "viewer", false},
	}

	for _, c := range cases {
		got := AtLeastRole(c.actual, c.required)
		if got != c.expected {
			t.Errorf("AtLeastRole(%q, %q) = %v; want %v", c.actual, c.required, got, c.expected)
		}
	}
}

func TestJWTMiddlewareAndRequireRole(t *testing.T) {
	secret := "test-secret"
	publicPaths := []string{"/public"}

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	protectedHandler := JWTMiddleware(secret, publicPaths)(testHandler)

	// 1. Missing token on protected path -> 401
	req := httptest.NewRequest("GET", "/api/protected", nil)
	rec := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rec.Code)
	}

	// 2. Public path -> passes through
	reqPublic := httptest.NewRequest("GET", "/public/resource", nil)
	recPublic := httptest.NewRecorder()
	protectedHandler.ServeHTTP(recPublic, reqPublic)
	if recPublic.Code != http.StatusOK {
		t.Errorf("Expected 200 on public path, got %d", recPublic.Code)
	}

	// 3. Valid Bearer token -> passes through and injects context
	validToken, _ := SignJWT(JWTClaims{
		Sub:         "user-ok",
		Name:        "Test",
		WorkspaceID: "ws-test",
		Role:        "admin",
		Iat:         time.Now().Unix(),
		Exp:         time.Now().Add(time.Hour).Unix(),
	}, secret)

	reqAuth := httptest.NewRequest("GET", "/api/protected", nil)
	reqAuth.Header.Set("Authorization", "Bearer "+validToken)
	recAuth := httptest.NewRecorder()
	protectedHandler.ServeHTTP(recAuth, reqAuth)
	if recAuth.Code != http.StatusOK {
		t.Errorf("Expected 200 with valid token, got %d", recAuth.Code)
	}
}
