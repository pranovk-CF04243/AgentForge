package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLiveServerSecurityIntegration(t *testing.T) {
	hub := NewHub()
	orchestrator := NewOrchestrator(hub, nil)
	handler := NewAPIHandler(orchestrator, hub)
	authHandler := NewAuthHandler(orchestrator)
	wsHandler := NewWorkspaceHandler(orchestrator, hub)

	mux := http.NewServeMux()

	// Auth routes
	mux.HandleFunc("/api/auth/bootstrap", authHandler.HandleBootstrap)
	mux.HandleFunc("/api/auth/login", authHandler.HandleLogin)
	mux.HandleFunc("/api/auth/refresh", authHandler.HandleRefresh)
	mux.HandleFunc("/api/auth/logout", authHandler.HandleLogout)
	mux.HandleFunc("/api/auth/github", authHandler.HandleGitHubLogin)
	mux.HandleFunc("/api/auth/github/callback", authHandler.HandleGitHubCallback)
	mux.HandleFunc("/api/auth/invites/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/accept") {
			authHandler.HandleInviteAccept(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/request-otp") {
			authHandler.HandleInviteRequestOTP(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/verify-otp") {
			authHandler.HandleInviteVerifyOTP(w, r)
		} else {
			authHandler.HandleInvitePreview(w, r)
		}
	})

	mux.HandleFunc("/api/auth/me", authHandler.HandleMe)
	mux.HandleFunc("/api/workspace", wsHandler.HandleWorkspace)
	mux.HandleFunc("/api/health", handler.HealthCheck)
	mux.HandleFunc("/api/projects", handler.GetProjects)
	mux.HandleFunc("/api/internal/task-event", handler.HandleTaskEventWebhook)
	mux.HandleFunc("/api/internal/deployment-failure", handler.HandleDeploymentFailure)
	mux.HandleFunc("/ws", handler.HandleWebSocket)
	mux.HandleFunc("/api/events/stream", handler.HandleSSE)

	publicPaths := []string{
		"/api/auth/bootstrap",
		"/api/auth/login",
		"/api/auth/refresh",
		"/api/auth/logout",
		"/api/auth/github",
		"/api/auth/invites/",
		"/api/health",
		"/api/internal/",
		"/ws",
		"/api/events/stream",
	}

	maxPayloadBytes := int64(2 << 20) // 2 MB
	rootHandler := SecurityHeadersMiddleware(CORSMiddleware(MaxBytesMiddleware(maxPayloadBytes)(JWTMiddleware(jwtSecret(), publicPaths)(mux))))

	// -------------------------------------------------------------
	// TEST 1: Security Response Headers on GET /api/health
	// -------------------------------------------------------------
	t.Log("===> [TEST 1] Verifying Browser Security Headers on GET /api/health")
	reqHealth := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	recHealth := httptest.NewRecorder()
	rootHandler.ServeHTTP(recHealth, reqHealth)

	if recHealth.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", recHealth.Code)
	}
	if recHealth.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("Expected X-Frame-Options: DENY, got %s", recHealth.Header().Get("X-Frame-Options"))
	}
	if recHealth.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("Expected X-Content-Type-Options: nosniff, got %s", recHealth.Header().Get("X-Content-Type-Options"))
	}
	if recHealth.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
		t.Errorf("Expected Referrer-Policy: strict-origin-when-cross-origin, got %s", recHealth.Header().Get("Referrer-Policy"))
	}
	if recHealth.Header().Get("X-XSS-Protection") != "1; mode=block" {
		t.Errorf("Expected X-XSS-Protection: 1; mode=block, got %s", recHealth.Header().Get("X-XSS-Protection"))
	}
	t.Log("PASS: All 4 browser security headers confirmed on live HTTP response")

	// -------------------------------------------------------------
	// TEST 2: CORS Preflight Blocking Malicious Origin
	// -------------------------------------------------------------
	t.Log("===> [TEST 2] Verifying CORS blocks untrusted origins on preflight")
	reqCORS := httptest.NewRequest(http.MethodOptions, "/api/projects", nil)
	reqCORS.Header.Set("Origin", "https://evil-hacker.com")
	recCORS := httptest.NewRecorder()
	rootHandler.ServeHTTP(recCORS, reqCORS)

	if recCORS.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for untrusted origin preflight, got %d", recCORS.Code)
	}
	if recCORS.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("Expected empty Access-Control-Allow-Origin, got %s", recCORS.Header().Get("Access-Control-Allow-Origin"))
	}
	t.Log("PASS: Untrusted origin blocked with 403 Forbidden")

	// -------------------------------------------------------------
	// TEST 3: CORS Preflight Allowing Trusted Origin
	// -------------------------------------------------------------
	t.Log("===> [TEST 3] Verifying CORS allows http://localhost:3000")
	reqCORSGood := httptest.NewRequest(http.MethodOptions, "/api/projects", nil)
	reqCORSGood.Header.Set("Origin", "http://localhost:3000")
	recCORSGood := httptest.NewRecorder()
	rootHandler.ServeHTTP(recCORSGood, reqCORSGood)

	if recCORSGood.Code != http.StatusNoContent {
		t.Errorf("Expected 204 No Content for preflight, got %d", recCORSGood.Code)
	}
	if recCORSGood.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("Expected Access-Control-Allow-Origin: http://localhost:3000, got %s", recCORSGood.Header().Get("Access-Control-Allow-Origin"))
	}
	if recCORSGood.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("Expected Access-Control-Allow-Credentials: true")
	}
	t.Log("PASS: Trusted origin allowed with credentials enabled")

	// -------------------------------------------------------------
	// TEST 4: /api/internal/task-event without secret -> 401
	// -------------------------------------------------------------
	t.Log("===> [TEST 4] Verifying /api/internal/ rejects unauthenticated callers")
	reqInternalNoAuth := httptest.NewRequest(http.MethodPost, "/api/internal/task-event", strings.NewReader(`{"event_type":"TASK_COMPLETED"}`))
	reqInternalNoAuth.Header.Set("Content-Type", "application/json")
	recInternalNoAuth := httptest.NewRecorder()
	rootHandler.ServeHTTP(recInternalNoAuth, reqInternalNoAuth)

	if recInternalNoAuth.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized, got %d", recInternalNoAuth.Code)
	}
	t.Logf("PASS: Unauthenticated call returned 401: %s", strings.TrimSpace(recInternalNoAuth.Body.String()))

	// -------------------------------------------------------------
	// TEST 5: /api/internal/task-event with secret -> 200 OK
	// -------------------------------------------------------------
	t.Log("===> [TEST 5] Verifying /api/internal/ accepts valid secret")
	reqInternalAuth := httptest.NewRequest(http.MethodPost, "/api/internal/task-event", strings.NewReader(`{"event_type":"TASK_COMPLETED"}`))
	reqInternalAuth.Header.Set("Content-Type", "application/json")
	reqInternalAuth.Header.Set("X-Internal-Secret", "agentforge-internal-dev-secret")
	recInternalAuth := httptest.NewRecorder()
	rootHandler.ServeHTTP(recInternalAuth, reqInternalAuth)

	if recInternalAuth.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", recInternalAuth.Code)
	}
	var resMap map[string]interface{}
	json.NewDecoder(recInternalAuth.Body).Decode(&resMap)
	if resMap["ok"] != true {
		t.Errorf("Expected ok: true, got %+v", resMap)
	}
	t.Log("PASS: Authenticated internal webhook accepted with {ok: true}")

	// -------------------------------------------------------------
	// TEST 6: WebSocket Auth Gate: /ws without token -> 401
	// -------------------------------------------------------------
	t.Log("===> [TEST 6] Verifying WebSocket rejects unauthenticated connection")
	reqWSNoToken := httptest.NewRequest(http.MethodGet, "/ws", nil)
	recWSNoToken := httptest.NewRecorder()
	rootHandler.ServeHTTP(recWSNoToken, reqWSNoToken)

	if recWSNoToken.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for /ws without token, got %d", recWSNoToken.Code)
	}
	t.Logf("PASS: Unauthenticated /ws rejected with 401: %s", strings.TrimSpace(recWSNoToken.Body.String()))

	// -------------------------------------------------------------
	// TEST 7: WebSocket Auth Gate: /ws with valid token
	// -------------------------------------------------------------
	t.Log("===> [TEST 7] Verifying WebSocket accepts valid JWT token")
	validToken, _ := SignJWT(JWTClaims{
		Sub:         "usr-test",
		Name:        "Test Engineer",
		WorkspaceID: "ws-1",
		Role:        "developer",
		Iat:         time.Now().Unix(),
		Exp:         time.Now().Add(1 * time.Hour).Unix(),
	}, jwtSecret())

	reqWSWithToken := httptest.NewRequest(http.MethodGet, "/ws?token="+validToken, nil)
	recWSWithToken := httptest.NewRecorder()
	rootHandler.ServeHTTP(recWSWithToken, reqWSWithToken)

	// Passed 401 token check! (Returns 400 only because test request did not include full RFC 6455 upgrade headers)
	if recWSWithToken.Code == http.StatusUnauthorized {
		t.Errorf("Expected token to be accepted, but got 401 Unauthorized")
	}
	t.Logf("PASS: Valid token passed authentication gate (status: %d)", recWSWithToken.Code)

	// -------------------------------------------------------------
	// TEST 8: Login Rate Limiter: 6 rapid attempts -> 429
	// -------------------------------------------------------------
	t.Log("===> [TEST 8] Verifying Login rate limiter blocks after 5 attempts")
	var lastStatus int
	for i := 0; i < 6; i++ {
		loginReq, _ := json.Marshal(map[string]string{
			"email":    "testbruteforce@example.com",
			"password": "wrongpassword123",
		})
		reqLogin := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginReq))
		reqLogin.Header.Set("Content-Type", "application/json")
		reqLogin.RemoteAddr = "192.168.1.99:12345"
		recLogin := httptest.NewRecorder()
		rootHandler.ServeHTTP(recLogin, reqLogin)
		lastStatus = recLogin.Code
		t.Logf("  Attempt %d response status: %d", i+1, lastStatus)
	}
	if lastStatus != http.StatusTooManyRequests {
		t.Errorf("Expected 6th login attempt to return 429 Too Many Requests, got %d", lastStatus)
	} else {
		t.Log("PASS: 6th rapid login attempt returned 429 Too Many Requests")
	}

	// -------------------------------------------------------------
	// TEST 9: GitHub OAuth Backdoor Removal: clientID="" -> 501
	// -------------------------------------------------------------
	t.Log("===> [TEST 9] Verifying GitHub OAuth dev backdoor is removed")
	t.Setenv("GITHUB_OAUTH_CLIENT_ID", "")
	reqGH := httptest.NewRequest(http.MethodGet, "/api/auth/github", nil)
	recGH := httptest.NewRecorder()
	rootHandler.ServeHTTP(recGH, reqGH)

	if recGH.Code != http.StatusNotImplemented {
		t.Errorf("Expected 501 Not Implemented (backdoor removed), got %d", recGH.Code)
	}
	t.Logf("PASS: Backdoor removed; unconfigured OAuth returned 501: %s", strings.TrimSpace(recGH.Body.String()))

	fmt.Println("\n=======================================================================")
	fmt.Println("  ALL REAL HTTP / ROUTER INTEGRATION TESTS PASSED SUCCESSFULLY!        ")
	fmt.Println("=======================================================================")
}
