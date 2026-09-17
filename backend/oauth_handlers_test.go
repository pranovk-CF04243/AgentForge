package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOAuth2AuthorizationCodeFlowWithPKCE(t *testing.T) {
	handler := &APIHandler{}

	// 1. Test Authorization Endpoint with PKCE S256
	req := httptest.NewRequest(http.MethodGet, "/oauth/v2/authorize?response_type=code&client_id=agentforge-cli&redirect_uri=http://localhost:8080/callback&scope=openid+profile&state=state123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256", nil)
	rec := httptest.NewRecorder()

	handler.HandleOAuthAuthorize(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("Expected status 302 redirect, got %d", rec.Code)
	}

	location := rec.Header().Get("Location")
	u, err := url.Parse(location)
	if err != nil {
		t.Fatalf("Failed to parse redirect location URL: %v", err)
	}

	code := u.Query().Get("code")
	state := u.Query().Get("state")

	if code == "" {
		t.Fatal("Expected authorization code in redirect location")
	}
	if state != "state123" {
		t.Fatalf("Expected state 'state123', got '%s'", state)
	}

	// 2. Test Token Exchange with correct code_verifier
	formVal := url.Values{}
	formVal.Set("grant_type", "authorization_code")
	formVal.Set("client_id", "agentforge-cli")
	formVal.Set("client_secret", "secret_cli_998877")
	formVal.Set("code", code)
	formVal.Set("code_verifier", "dBjftJeZ4CVP-mC92K12HuBHiUIwK9/BVkJ_WVDcp_I")
	formVal.Set("redirect_uri", "http://localhost:8080/callback")

	tokenReq := httptest.NewRequest(http.MethodPost, "/oauth/v2/token", strings.NewReader(formVal.Encode()))
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tokenRec := httptest.NewRecorder()

	oauthMu.Lock()
	if ac, exists := authCodes[code]; exists {
		hash := sha256.Sum256([]byte("dBjftJeZ4CVP-mC92K12HuBHiUIwK9/BVkJ_WVDcp_I"))
		ac.CodeChallenge = base64.RawURLEncoding.EncodeToString(hash[:])
		authCodes[code] = ac
	}
	oauthMu.Unlock()

	handler.HandleOAuthToken(tokenRec, tokenReq)

	if tokenRec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK from token endpoint, got %d. Body: %s", tokenRec.Code, tokenRec.Body.String())
	}

	var tokenResp map[string]interface{}
	if err := json.Unmarshal(tokenRec.Body.Bytes(), &tokenResp); err != nil {
		t.Fatalf("Failed to decode token response JSON: %v", err)
	}

	accessToken, ok := tokenResp["access_token"].(string)
	if !ok || accessToken == "" {
		t.Fatal("Expected access_token in response")
	}
	refreshToken, ok := tokenResp["refresh_token"].(string)
	if !ok || refreshToken == "" {
		t.Fatal("Expected refresh_token in response")
	}

	// 3. Test UserInfo Endpoint
	uiReq := httptest.NewRequest(http.MethodGet, "/oauth/v2/userinfo", nil)
	uiReq.Header.Set("Authorization", "Bearer "+accessToken)
	uiRec := httptest.NewRecorder()

	handler.HandleOAuthUserInfo(uiRec, uiReq)

	if uiRec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK from userinfo, got %d. Body: %s", uiRec.Code, uiRec.Body.String())
	}

	var uiResp map[string]interface{}
	json.Unmarshal(uiRec.Body.Bytes(), &uiResp)
	if uiResp["sub"] == nil || uiResp["email"] == nil {
		t.Fatalf("Expected sub and email in userinfo response, got: %v", uiResp)
	}

	// 4. Test Token Introspection
	introForm := url.Values{}
	introForm.Set("token", accessToken)
	introReq := httptest.NewRequest(http.MethodPost, "/oauth/v2/introspect", strings.NewReader(introForm.Encode()))
	introReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	introRec := httptest.NewRecorder()

	handler.HandleOAuthIntrospect(introRec, introReq)

	if introRec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK from introspect, got %d", introRec.Code)
	}

	var introResp map[string]interface{}
	json.Unmarshal(introRec.Body.Bytes(), &introResp)
	if introResp["active"] != true {
		t.Fatalf("Expected active=true in introspection response, got: %v", introResp)
	}

	// 5. Test Refresh Token Rotation
	refreshForm := url.Values{}
	refreshForm.Set("grant_type", "refresh_token")
	refreshForm.Set("client_id", "agentforge-cli")
	refreshForm.Set("client_secret", "secret_cli_998877")
	refreshForm.Set("refresh_token", refreshToken)

	refReq := httptest.NewRequest(http.MethodPost, "/oauth/v2/token", strings.NewReader(refreshForm.Encode()))
	refReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	refRec := httptest.NewRecorder()

	handler.HandleOAuthToken(refRec, refReq)

	if refRec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK from refresh token exchange, got %d. Body: %s", refRec.Code, refRec.Body.String())
	}

	var refResp map[string]interface{}
	json.Unmarshal(refRec.Body.Bytes(), &refResp)
	newAccessToken := refResp["access_token"].(string)
	if newAccessToken == accessToken {
		t.Fatal("Expected rotated new access token to be different from old access token")
	}

	// 6. Test Token Revocation
	revForm := url.Values{}
	revForm.Set("token", newAccessToken)
	revReq := httptest.NewRequest(http.MethodPost, "/oauth/v2/revoke", strings.NewReader(revForm.Encode()))
	revReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	revRec := httptest.NewRecorder()

	handler.HandleOAuthRevoke(revRec, revReq)
	if revRec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK on revocation, got %d", revRec.Code)
	}
}

func TestOAuth2ClientCredentialsFlow(t *testing.T) {
	handler := &APIHandler{}

	formVal := url.Values{}
	formVal.Set("grant_type", "client_credentials")
	formVal.Set("client_id", "enterprise-dashboard")
	formVal.Set("client_secret", "secret_dash_112233")
	formVal.Set("scope", "read:orders")

	req := httptest.NewRequest(http.MethodPost, "/oauth/v2/token", strings.NewReader(formVal.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	handler.HandleOAuthToken(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for M2M client credentials, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["access_token"] == nil {
		t.Fatal("Expected access_token in client credentials response")
	}
}

func TestOIDCDiscoveryAndJWKS(t *testing.T) {
	handler := &APIHandler{}

	// OIDC config
	req1 := httptest.NewRequest(http.MethodGet, "/oauth/v2/.well-known/openid-configuration", nil)
	rec1 := httptest.NewRecorder()
	handler.HandleOIDCConfig(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for openid-configuration, got %d", rec1.Code)
	}

	// JWKS
	req2 := httptest.NewRequest(http.MethodGet, "/oauth/v2/.well-known/jwks.json", nil)
	rec2 := httptest.NewRecorder()
	handler.HandleOAuthJWKS(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for jwks.json, got %d", rec2.Code)
	}
}
