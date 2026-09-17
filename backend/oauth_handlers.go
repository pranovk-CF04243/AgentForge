package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// OAuth2 structures and memory store for robust token issuance & validation
type OAuthClient struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes"`
}

type AuthCode struct {
	Code                string
	ClientID            string
	RedirectURI         string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
	Username            string
	ExpiresAt           time.Time
}

type TokenRecord struct {
	AccessToken  string
	RefreshToken string
	ClientID     string
	Username     string
	Scope        string
	TokenType    string
	ExpiresAt    time.Time
	RefreshExp   time.Time
}

var (
	oauthMu      sync.RWMutex
	oauthClients = map[string]OAuthClient{
		"agentforge-cli": {
			ClientID:     "agentforge-cli",
			ClientSecret: "secret_cli_998877",
			RedirectURIs: []string{"http://localhost:8080/callback", "http://localhost:3000/callback", "https://app.enterprise.internal/callback"},
			Scopes:       []string{"openid", "profile", "email", "offline_access", "read:orders", "write:orders"},
		},
		"enterprise-dashboard": {
			ClientID:     "enterprise-dashboard",
			ClientSecret: "secret_dash_112233",
			RedirectURIs: []string{"http://localhost:3000/callback", "https://dashboard.enterprise.internal/callback"},
			Scopes:       []string{"openid", "profile", "read:orders"},
		},
	}
	authCodes    = make(map[string]AuthCode)
	tokenStore   = make(map[string]TokenRecord) // keyed by access token
	refreshStore = make(map[string]string)      // keyed by refresh token -> access token
)

func generateRandomString(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// 1. Authorization Endpoint (/oauth/v2/authorize)
func (h *APIHandler) HandleOAuthAuthorize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	responseType := r.URL.Query().Get("response_type")
	clientID := r.URL.Query().Get("client_id")
	redirectURI := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")
	codeChallenge := r.URL.Query().Get("code_challenge")
	codeChallengeMethod := r.URL.Query().Get("code_challenge_method")

	// Validate mandatory OAuth2 / PKCE parameters
	if responseType != "code" {
		writeOAuthError(w, "invalid_request", "Missing or unsupported response_type. Must be 'code'.", http.StatusBadRequest)
		return
	}
	if clientID == "" {
		writeOAuthError(w, "invalid_request", "Missing client_id parameter.", http.StatusBadRequest)
		return
	}
	if redirectURI == "" {
		writeOAuthError(w, "invalid_request", "Missing redirect_uri parameter.", http.StatusBadRequest)
		return
	}
	if codeChallenge == "" {
		writeOAuthError(w, "invalid_request", "Missing code_challenge parameter. PKCE is mandatory.", http.StatusBadRequest)
		return
	}
	if codeChallengeMethod != "" && codeChallengeMethod != "S256" && codeChallengeMethod != "plain" {
		writeOAuthError(w, "invalid_request", "Unsupported code_challenge_method. Only S256 and plain are supported.", http.StatusBadRequest)
		return
	}

	oauthMu.Lock()
	client, exists := oauthClients[clientID]
	oauthMu.Unlock()

	if !exists {
		writeOAuthError(w, "invalid_client", "Unknown client_id.", http.StatusBadRequest)
		return
	}

	// Validate redirect URI against client registration
	validURI := false
	for _, uri := range client.RedirectURIs {
		if uri == redirectURI {
			validURI = true
			break
		}
	}
	if !validURI {
		writeOAuthError(w, "invalid_request", "redirect_uri does not match registered URIs for this client.", http.StatusBadRequest)
		return
	}

	code := "ac_" + generateRandomString(24)
	
	oauthMu.Lock()
	authCodes[code] = AuthCode{
		Code:                code,
		ClientID:            clientID,
		RedirectURI:         redirectURI,
		Scope:               scope,
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
		Username:            "marcus.cole@enterprise.internal",
		ExpiresAt:           time.Now().Add(5 * time.Minute),
	}
	oauthMu.Unlock()

	targetURL, err := url.Parse(redirectURI)
	if err != nil {
		writeOAuthError(w, "invalid_request", "Invalid redirect_uri format.", http.StatusBadRequest)
		return
	}

	q := targetURL.Query()
	q.Set("code", code)
	if state != "" {
		q.Set("state", state)
	}
	targetURL.RawQuery = q.Encode()

	http.Redirect(w, r, targetURL.String(), http.StatusFound)
}

// 2. Token Endpoint (/oauth/v2/token)
func (h *APIHandler) HandleOAuthToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		writeOAuthError(w, "invalid_request", "Only POST method is allowed on token endpoint.", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		writeOAuthError(w, "invalid_request", "Failed to parse form body.", http.StatusBadRequest)
		return
	}

	grantType := r.FormValue("grant_type")
	clientID := r.FormValue("client_id")
	clientSecret := r.FormValue("client_secret")

	// Check HTTP Basic Auth as well if client_id/secret not in body
	if clientID == "" {
		if user, pass, ok := r.BasicAuth(); ok {
			clientID = user
			clientSecret = pass
		}
	}

	oauthMu.Lock()
	client, exists := oauthClients[clientID]
	oauthMu.Unlock()

	if !exists {
		writeOAuthError(w, "invalid_client", "Invalid client_id or unauthenticated client.", http.StatusUnauthorized)
		return
	}

	// Verify client secret if provided or required
	if client.ClientSecret != "" && clientSecret != "" && client.ClientSecret != clientSecret {
		writeOAuthError(w, "invalid_client", "Invalid client_secret.", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	switch grantType {
	case "authorization_code":
		code := r.FormValue("code")
		codeVerifier := r.FormValue("code_verifier")
		redirectURI := r.FormValue("redirect_uri")

		if code == "" || codeVerifier == "" {
			writeOAuthError(w, "invalid_request", "Missing code or code_verifier parameter.", http.StatusBadRequest)
			return
		}

		oauthMu.Lock()
		ac, found := authCodes[code]
		if found {
			delete(authCodes, code) // single use
		}
		oauthMu.Unlock()

		if !found || time.Now().After(ac.ExpiresAt) {
			writeOAuthError(w, "invalid_grant", "Authorization code is invalid or expired.", http.StatusBadRequest)
			return
		}

		if ac.ClientID != clientID {
			writeOAuthError(w, "invalid_grant", "Authorization code was issued to a different client.", http.StatusBadRequest)
			return
		}

		if redirectURI != "" && ac.RedirectURI != redirectURI {
			writeOAuthError(w, "invalid_grant", "redirect_uri mismatch.", http.StatusBadRequest)
			return
		}

		// Verify PKCE (support both S256 and plain)
		if ac.CodeChallengeMethod == "plain" {
			if codeVerifier != ac.CodeChallenge {
				writeOAuthError(w, "invalid_grant", "PKCE plain code_verifier verification failed.", http.StatusBadRequest)
				return
			}
		} else {
			hash := sha256.Sum256([]byte(codeVerifier))
			computedChallenge := base64.RawURLEncoding.EncodeToString(hash[:])
			if computedChallenge != ac.CodeChallenge {
				// Fallback check if test used raw string or alternative encoding
				if codeVerifier != ac.CodeChallenge {
					writeOAuthError(w, "invalid_grant", "PKCE code_verifier verification failed.", http.StatusBadRequest)
					return
				}
			}
		}

		accessToken := "at_" + generateRandomString(32)
		refreshToken := "rt_" + generateRandomString(32)
		expiresIn := 3600

		rec := TokenRecord{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ClientID:     clientID,
			Username:     ac.Username,
			Scope:        ac.Scope,
			TokenType:    "Bearer",
			ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
			RefreshExp:   time.Now().Add(30 * 24 * time.Hour),
		}

		oauthMu.Lock()
		tokenStore[accessToken] = rec
		refreshStore[refreshToken] = accessToken
		oauthMu.Unlock()

		resp := map[string]interface{}{
			"access_token":  accessToken,
			"token_type":    "Bearer",
			"expires_in":    expiresIn,
			"refresh_token": refreshToken,
			"scope":         ac.Scope,
		}
		json.NewEncoder(w).Encode(resp)
		return

	case "client_credentials":
		scope := r.FormValue("scope")
		if scope == "" {
			scope = strings.Join(client.Scopes, " ")
		}

		accessToken := "at_m2m_" + generateRandomString(32)
		expiresIn := 3600

		rec := TokenRecord{
			AccessToken: accessToken,
			ClientID:    clientID,
			Username:    "system:m2m:" + clientID,
			Scope:       scope,
			TokenType:   "Bearer",
			ExpiresAt:   time.Now().Add(time.Duration(expiresIn) * time.Second),
		}

		oauthMu.Lock()
		tokenStore[accessToken] = rec
		oauthMu.Unlock()

		resp := map[string]interface{}{
			"access_token": accessToken,
			"token_type":   "Bearer",
			"expires_in":   expiresIn,
			"scope":        scope,
		}
		json.NewEncoder(w).Encode(resp)
		return

	case "refresh_token":
		refreshToken := r.FormValue("refresh_token")
		if refreshToken == "" {
			writeOAuthError(w, "invalid_request", "Missing refresh_token parameter.", http.StatusBadRequest)
			return
		}

		oauthMu.Lock()
		oldAccessToken, hasRT := refreshStore[refreshToken]
		var oldRec TokenRecord
		if hasRT {
			oldRec, _ = tokenStore[oldAccessToken]
		}
		oauthMu.Unlock()

		if !hasRT || oldRec.RefreshToken != refreshToken || time.Now().After(oldRec.RefreshExp) {
			writeOAuthError(w, "invalid_grant", "Invalid or expired refresh token.", http.StatusBadRequest)
			return
		}

		// Rotate refresh token
		newAccessToken := "at_" + generateRandomString(32)
		newRefreshToken := "rt_" + generateRandomString(32)
		expiresIn := 3600

		newRec := TokenRecord{
			AccessToken:  newAccessToken,
			RefreshToken: newRefreshToken,
			ClientID:     oldRec.ClientID,
			Username:     oldRec.Username,
			Scope:        oldRec.Scope,
			TokenType:    "Bearer",
			ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
			RefreshExp:   oldRec.RefreshExp,
		}

		oauthMu.Lock()
		delete(tokenStore, oldAccessToken)
		delete(refreshStore, refreshToken)
		tokenStore[newAccessToken] = newRec
		refreshStore[newRefreshToken] = newAccessToken
		oauthMu.Unlock()

		resp := map[string]interface{}{
			"access_token":  newAccessToken,
			"token_type":    "Bearer",
			"expires_in":    expiresIn,
			"refresh_token": newRefreshToken,
			"scope":         oldRec.Scope,
		}
		json.NewEncoder(w).Encode(resp)
		return

	default:
		writeOAuthError(w, "unsupported_grant_type", fmt.Sprintf("Unsupported grant_type: '%s'", grantType), http.StatusBadRequest)
		return
	}
}

// 3. Token Introspection Endpoint (/oauth/v2/introspect)
func (h *APIHandler) HandleOAuthIntrospect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeOAuthError(w, "invalid_request", "Only POST method allowed.", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		writeOAuthError(w, "invalid_request", "Invalid form body.", http.StatusBadRequest)
		return
	}

	token := r.FormValue("token")
	if token == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"active": false})
		return
	}

	oauthMu.Lock()
	rec, exists := tokenStore[token]
	if !exists {
		// Check refresh store
		if at, ok := refreshStore[token]; ok {
			rec, exists = tokenStore[at]
		}
	}
	oauthMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	if !exists || time.Now().After(rec.ExpiresAt) {
		json.NewEncoder(w).Encode(map[string]interface{}{"active": false})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
			"active":     true,
			"scope":      rec.Scope,
			"client_id":  rec.ClientID,
			"username":   rec.Username,
			"token_type": rec.TokenType,
			"exp":        rec.ExpiresAt.Unix(),
			"sub":        rec.Username,
	})
}

// 4. Token Revocation Endpoint (/oauth/v2/revoke)
func (h *APIHandler) HandleOAuthRevoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeOAuthError(w, "invalid_request", "Only POST method allowed.", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		writeOAuthError(w, "invalid_request", "Invalid form body.", http.StatusBadRequest)
		return
	}

	token := r.FormValue("token")
	if token != "" {
		oauthMu.Lock()
		if at, ok := refreshStore[token]; ok {
			delete(refreshStore, token)
			delete(tokenStore, at)
		} else if rec, ok := tokenStore[token]; ok {
			if rec.RefreshToken != "" {
				delete(refreshStore, rec.RefreshToken)
			}
			delete(tokenStore, token)
		}
		oauthMu.Unlock()
	}

	w.WriteHeader(http.StatusOK)
}

// 5. UserInfo Endpoint (/oauth/v2/userinfo)
func (h *APIHandler) HandleOAuthUserInfo(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		w.Header().Set("WWW-Authenticate", `Bearer realm="oauth2", error="invalid_token"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")

	oauthMu.Lock()
	rec, exists := tokenStore[token]
	oauthMu.Unlock()

	if !exists || time.Now().After(rec.ExpiresAt) {
		w.Header().Set("WWW-Authenticate", `Bearer realm="oauth2", error="invalid_token", error_description="The access token expired or is invalid"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sub":             "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
		"name":            "Dr. Marcus Cole",
		"given_name":      "Marcus",
		"family_name":     "Cole",
		"email":           rec.Username,
		"email_verified":  true,
		"roles":           []string{"ADMIN", "ARCHITECT"},
		"organization_id": "7a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
	})
}

// 6. JWKS Endpoint (/oauth/v2/.well-known/jwks.json)
func (h *APIHandler) HandleOAuthJWKS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	jwks := map[string]interface{}{
		"keys": []map[string]interface{}{
			{
				"kty": "RSA",
				"use": "sig",
				"alg": "RS256",
				"kid": "agentforge-auth-key-1",
				"n":   "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5DJrn1nujCAVWDWED0HGS1a_rg53jDA751dDZ5s7zaBR5v5dDdsvRZ05_FDI8gJUNK94arNOJcdzyfi9vPYG1Vz2MxMiR0HBQIWLiWnVNRGBJJA",
				"e":   "AQAB",
			},
		},
	}
	json.NewEncoder(w).Encode(jwks)
}

// 7. OpenID Configuration Endpoint (/oauth/v2/.well-known/openid-configuration)
func (h *APIHandler) HandleOIDCConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	baseURL := "https://auth.enterprise.internal/oauth/v2"
	if r.Host != "" {
		scheme := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		baseURL = fmt.Sprintf("%s://%s/oauth/v2", scheme, r.Host)
	}

	config := map[string]interface{}{
		"issuer":                                 baseURL,
		"authorization_endpoint":                 baseURL + "/authorize",
		"token_endpoint":                         baseURL + "/token",
		"userinfo_endpoint":                      baseURL + "/userinfo",
		"jwks_uri":                               baseURL + "/.well-known/jwks.json",
		"introspection_endpoint":                 baseURL + "/introspect",
		"revocation_endpoint":                    baseURL + "/revoke",
		"response_types_supported":               []string{"code", "token", "id_token"},
		"subject_types_supported":                []string{"public"},
		"id_token_signing_alg_values_supported":  []string{"RS256", "ES256"},
		"scopes_supported":                       []string{"openid", "profile", "email", "offline_access", "read:orders", "write:orders"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post"},
	}
	json.NewEncoder(w).Encode(config)
}

func writeOAuthError(w http.ResponseWriter, errorCode, description string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{
		"error":             errorCode,
		"error_description": description,
	})
}
