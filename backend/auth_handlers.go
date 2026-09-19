package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode"

	"agentforge/backend/ratelimit"
	"golang.org/x/crypto/bcrypt"
)

// ─── Constants ───────────────────────────────────────────────────────────────

const (
	accessTokenTTL  = 1 * time.Hour
	refreshTokenTTL = 7 * 24 * time.Hour
	inviteTTL       = 72 * time.Hour
)

// ─── Auth Handler Struct ─────────────────────────────────────────────────────

// AuthHandler holds references needed by all auth routes.
type AuthHandler struct {
	orch             *Orchestrator
	loginLimiter     *ratelimit.InMemoryTokenBucket
	otpReqLimiter    *ratelimit.InMemoryTokenBucket
	otpVerifyLimiter *ratelimit.InMemoryTokenBucket
}

func NewAuthHandler(orch *Orchestrator) *AuthHandler {
	return &AuthHandler{
		orch:             orch,
		loginLimiter:     ratelimit.NewInMemoryTokenBucket(5, 5), // 5 login attempts per min burst, 5/min
		otpReqLimiter:    ratelimit.NewInMemoryTokenBucket(3, 1), // 3 OTP requests burst, 1/min
		otpVerifyLimiter: ratelimit.NewInMemoryTokenBucket(5, 2), // 5 OTP verification attempts burst, 2/min
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func slugify(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

func getClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func generateOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

func jwtSecret() string {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		if os.Getenv("ENV") == "production" {
			log.Fatal("CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set in production mode")
		}
		log.Printf("[SECURITY WARNING] JWT_SECRET not set. Using default development secret.")
		return "agentforge-dev-secret-change-in-production"
	}
	return s
}

// UserPublicDTO sanitises the User model so sensitive internal fields are never leaked.
type UserPublicDTO struct {
	ID          string     `json:"id"`
	Email       string     `json:"email"`
	Name        string     `json:"name"`
	AvatarURL   string     `json:"avatarUrl,omitempty"`
	GitHubLogin string     `json:"githubLogin,omitempty"`
	IsActive    bool       `json:"isActive"`
	LastSeenAt  *time.Time `json:"lastSeenAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

func toUserDTO(u *User) UserPublicDTO {
	if u == nil {
		return UserPublicDTO{}
	}
	return UserPublicDTO{
		ID:          u.ID,
		Email:       u.Email,
		Name:        u.Name,
		AvatarURL:   u.AvatarURL,
		GitHubLogin: u.GitHubLogin,
		IsActive:    u.IsActive,
		LastSeenAt:  u.LastSeenAt,
		CreatedAt:   u.CreatedAt,
	}
}

func issueTokenPair(w http.ResponseWriter, user *User, workspaceID, role string) (string, error) {
	now := time.Now()
	accessClaims := JWTClaims{
		Sub:         user.ID,
		Name:        user.Name,
		WorkspaceID: workspaceID,
		Role:        role,
		Iat:         now.Unix(),
		Exp:         now.Add(accessTokenTTL).Unix(),
	}
	accessToken, err := SignJWT(accessClaims, jwtSecret())
	if err != nil {
		return "", err
	}

	// Refresh token: random opaque string, store hash in DB
	rawRefresh := generateToken(32)
	refreshHash := hashToken(rawRefresh)

	if DB != nil {
		rt := RefreshToken{
			ID:        generateID(),
			UserID:    user.ID,
			TokenHash: refreshHash,
			ExpiresAt: now.Add(refreshTokenTTL),
			CreatedAt: now,
		}
		DB.Create(&rt)
	}

	secureCookie := os.Getenv("COOKIE_SECURE") == "true"
	// Set refresh token as HttpOnly cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "af_refresh",
		Value:    rawRefresh,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
		Expires:  now.Add(refreshTokenTTL),
	})

	return accessToken, nil
}

func (h *AuthHandler) logAuthFailure(action, email, ip, userAgent, reason string) {
	log.Printf("[Security Audit] %s - Email: %s, IP: %s, Reason: %s", action, email, ip, reason)
	var wsID string
	if DB != nil {
		var ws Workspace
		if err := DB.First(&ws).Error; err == nil {
			wsID = ws.ID
		}
	}
	LogAudit(AuditEntry{
		WorkspaceID: wsID,
		UserID:      email,
		UserName:    email,
		Action:      action,
		ResourceID:  email,
		Detail:      fmt.Sprintf("Failed authentication attempt: %s", reason),
		IPAddress:   ip,
		UserAgent:   userAgent,
		Status:      "FAILURE",
		Severity:    "WARN",
		Metadata:    map[string]interface{}{"email": email, "reason": reason},
	})
}

// ─── POST /api/auth/bootstrap ─────────────────────────────────────────────
// Creates the first Owner account + Workspace. Only works when user table is empty.

func (h *AuthHandler) HandleBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	// Reject if any user already exists
	var count int64
	DB.Model(&User{}).Count(&count)
	if count > 0 {
		writeJSONError(w, "Bootstrap already complete — use invite flow to add members", http.StatusConflict)
		return
	}

	var req struct {
		Name          string `json:"name"`
		Email         string `json:"email"`
		Password      string `json:"password"`
		WorkspaceName string `json:"workspaceName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.Email == "" || req.Password == "" || req.WorkspaceName == "" {
		writeJSONError(w, "name, email, password, workspaceName are required", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		writeJSONError(w, "Password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSONError(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	now := time.Now()
	userID := generateID()
	workspaceID := generateID()

	user := User{
		ID:           userID,
		Email:        strings.ToLower(req.Email),
		Name:         req.Name,
		PasswordHash: string(hash),
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	workspace := Workspace{
		ID:        workspaceID,
		Name:      req.WorkspaceName,
		Slug:      slugify(req.WorkspaceName),
		OwnerID:   userID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	member := WorkspaceMember{
		ID:          generateID(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Role:        "owner",
		InvitedBy:   userID,
		JoinedAt:    now,
	}

	if err := DB.Create(&user).Error; err != nil {
		writeJSONError(w, "Failed to create user: "+err.Error(), http.StatusInternalServerError)
		return
	}
	DB.Create(&workspace)
	DB.Create(&member)

	accessToken, err := issueTokenPair(w, &user, workspaceID, "owner")
	if err != nil {
		writeJSONError(w, "Failed to issue token", http.StatusInternalServerError)
		return
	}

	h.writeAuthResponse(w, &user, &workspace, "owner", accessToken)
	log.Printf("[Auth] Bootstrap complete — owner: %s, workspace: %s", user.Email, workspace.Name)
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────

func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	ip := getClientIP(r)
	rateKey := fmt.Sprintf("login:%s:%s", ip, strings.ToLower(req.Email))
	if allowed, _, retryAfter, _ := h.loginLimiter.Allow(r.Context(), rateKey); !allowed {
		log.Printf("[Security] Rate limit triggered for login attempt on %s from IP %s", req.Email, ip)
		writeJSONError(w, fmt.Sprintf("Too many login attempts. Please wait %d seconds before trying again", int(retryAfter.Seconds())), http.StatusTooManyRequests)
		return
	}

	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	var user User
	if err := DB.Where("email = ? AND is_active = true", strings.ToLower(req.Email)).First(&user).Error; err != nil {
		h.logAuthFailure("auth.login_failed", req.Email, ip, r.UserAgent(), "User not found or inactive account")
		writeJSONError(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		h.logAuthFailure("auth.login_failed", req.Email, ip, r.UserAgent(), "Invalid credentials")
		writeJSONError(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Get workspace membership
	var member WorkspaceMember
	if err := DB.Where("user_id = ?", user.ID).First(&member).Error; err != nil {
		writeJSONError(w, "No workspace found for this account", http.StatusForbidden)
		return
	}
	var workspace Workspace
	DB.First(&workspace, "id = ?", member.WorkspaceID)

	// Update last seen
	now := time.Now()
	DB.Model(&user).Update("last_seen_at", now)

	accessToken, err := issueTokenPair(w, &user, member.WorkspaceID, member.Role)
	if err != nil {
		writeJSONError(w, "Failed to issue token", http.StatusInternalServerError)
		return
	}

	LogAudit(AuditEntry{
		WorkspaceID: workspace.ID,
		UserID:      user.ID,
		UserName:    user.Name,
		Action:      "auth.login_success",
		ResourceID:  user.ID,
		Detail:      fmt.Sprintf("User %s logged in successfully", user.Email),
		IPAddress:   ip,
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"email": user.Email, "role": member.Role},
	})

	h.writeAuthResponse(w, &user, &workspace, member.Role, accessToken)
}

// ─── POST /api/auth/refresh ───────────────────────────────────────────────

func (h *AuthHandler) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("af_refresh")
	if err != nil {
		writeJSONError(w, "No refresh token", http.StatusUnauthorized)
		return
	}

	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	tokenHash := hashToken(cookie.Value)
	var rt RefreshToken
	if err := DB.Where("token_hash = ? AND expires_at > ?", tokenHash, time.Now()).First(&rt).Error; err != nil {
		writeJSONError(w, "Invalid or expired refresh token", http.StatusUnauthorized)
		return
	}

	var user User
	if err := DB.First(&user, "id = ? AND is_active = true", rt.UserID).Error; err != nil {
		writeJSONError(w, "User not found", http.StatusUnauthorized)
		return
	}

	var member WorkspaceMember
	if err := DB.Where("user_id = ?", user.ID).First(&member).Error; err != nil {
		writeJSONError(w, "No workspace membership", http.StatusForbidden)
		return
	}
	var workspace Workspace
	DB.First(&workspace, "id = ?", member.WorkspaceID)

	// Rotate: delete old refresh token
	DB.Delete(&rt)

	accessToken, err := issueTokenPair(w, &user, member.WorkspaceID, member.Role)
	if err != nil {
		writeJSONError(w, "Failed to issue token", http.StatusInternalServerError)
		return
	}

	LogAudit(AuditEntry{
		WorkspaceID: member.WorkspaceID,
		UserID:      user.ID,
		UserName:    user.Name,
		Action:      "auth.token_refreshed",
		ResourceID:  user.ID,
		Detail:      "Access token refreshed via valid session",
		IPAddress:   getClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
	})

	h.writeAuthResponse(w, &user, &workspace, member.Role, accessToken)
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────

func (h *AuthHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	callerID := ctxGetUserID(r)
	callerName := ctxGetUserName(r)
	wsID := ctxGetWorkspaceID(r)

	if cookie, err := r.Cookie("af_refresh"); err == nil && DB != nil {
		tokenHash := hashToken(cookie.Value)
		DB.Where("token_hash = ?", tokenHash).Delete(&RefreshToken{})
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "af_refresh",
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})

	LogAudit(AuditEntry{
		WorkspaceID: wsID,
		UserID:      callerID,
		UserName:    callerName,
		Action:      "auth.logout",
		ResourceID:  callerID,
		Detail:      "User session terminated and refresh token revoked",
		IPAddress:   getClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"status":"logged out"}`)
}

// ─── GET /api/auth/me ────────────────────────────────────────────────────

func (h *AuthHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		userID := ctxGetUserID(r)
		if userID == "" || DB == nil {
			writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		var user User
		if err := DB.First(&user, "id = ?", userID).Error; err != nil {
			writeJSONError(w, "User not found", http.StatusNotFound)
			return
		}
		var member WorkspaceMember
		DB.Where("user_id = ?", userID).First(&member)
		var workspace Workspace
		DB.First(&workspace, "id = ?", member.WorkspaceID)

		var allowedProjects []string
		if member.AllowedProjects != "" {
			_ = json.Unmarshal([]byte(member.AllowedProjects), &allowedProjects)
		}
		if allowedProjects == nil {
			allowedProjects = []string{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user":            toUserDTO(&user),
			"workspace":       workspace,
			"role":            member.Role,
			"projectAccess":   member.ProjectAccess,
			"allowedProjects": allowedProjects,
		})
		return
	}

	if r.Method == http.MethodPatch {
		userID := ctxGetUserID(r)
		if userID == "" || DB == nil {
			writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name      *string `json:"name"`
			AvatarURL *string `json:"avatarUrl"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		updates := map[string]interface{}{"updated_at": time.Now()}
		if req.Name != nil {
			updates["name"] = *req.Name
		}
		if req.AvatarURL != nil {
			updates["avatar_url"] = *req.AvatarURL
		}
		DB.Model(&User{}).Where("id = ?", userID).Updates(updates)

		var user User
		DB.First(&user, "id = ?", userID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user": toUserDTO(&user),
		})
		return
	}

	writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// findActiveInvite looks up a valid, non-expired, unused invite by token hash or legacy plaintext token.
func findActiveInvite(token string) (*Invite, error) {
	if DB == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	tokenHash := hashToken(token)
	var invite Invite
	err := DB.Where("(token_hash = ? OR token = ?) AND expires_at > ? AND used_at IS NULL", tokenHash, token, time.Now()).First(&invite).Error
	if err != nil {
		return nil, err
	}
	return &invite, nil
}

// ─── GET /api/auth/invites/{token} ───────────────────────────────────────
// Preview invite — public endpoint to retrieve invite metadata and verification state.

func (h *AuthHandler) HandleInvitePreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	token := extractPathParam(r.URL.Path, "/api/auth/invites/", "/")
	if token == "" {
		writeJSONError(w, "Token required", http.StatusBadRequest)
		return
	}
	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	invite, err := findActiveInvite(token)
	if err != nil {
		writeJSONError(w, "Invite not found or expired", http.StatusNotFound)
		return
	}

	var workspace Workspace
	DB.First(&workspace, "id = ?", invite.WorkspaceID)
	var inviter User
	DB.First(&inviter, "id = ?", invite.InvitedBy)

	isVerified := invite.OTPVerifiedAt != nil && time.Since(*invite.OTPVerifiedAt) < 30*time.Minute

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"workspaceName": workspace.Name,
		"workspaceSlug": workspace.Slug,
		"inviterName":   inviter.Name,
		"role":          invite.Role,
		"email":         invite.Email,
		"expiresAt":     invite.ExpiresAt,
		"otpVerified":   isVerified,
	})
}

// ─── POST /api/auth/invites/{token}/request-otp ───────────────────────────
// Dispatches a 6-digit OTP to the invited email address. Rate-limited to prevent email flooding.

func (h *AuthHandler) HandleInviteRequestOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/auth/invites/")
	token := strings.TrimSuffix(path, "/request-otp")
	if token == "" {
		writeJSONError(w, "Token required", http.StatusBadRequest)
		return
	}
	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	invite, err := findActiveInvite(token)
	if err != nil {
		writeJSONError(w, "Invite not found or expired", http.StatusNotFound)
		return
	}

	ip := getClientIP(r)
	rateKey := fmt.Sprintf("otp-req:%s:%s", ip, token)
	if allowed, _, retryAfter, _ := h.otpReqLimiter.Allow(r.Context(), rateKey); !allowed {
		log.Printf("[Security] Rate limit exceeded on OTP request for invite %s from IP %s", token, ip)
		writeJSONError(w, fmt.Sprintf("Too many OTP requests. Please wait %d seconds before requesting another code", int(retryAfter.Seconds())), http.StatusTooManyRequests)
		return
	}

	otpCode := generateOTP()
	otpHash := hashToken(otpCode)
	now := time.Now()
	expiresAt := now.Add(10 * time.Minute)

	DB.Model(invite).Updates(map[string]interface{}{
		"otp_code_hash":  otpHash,
		"otp_expires_at": expiresAt,
		"otp_tries":      0,
	})

	var workspace Workspace
	DB.First(&workspace, "id = ?", invite.WorkspaceID)

	_ = SendOTPEmail(invite.Email, otpCode, workspace.Name)

	LogAudit(AuditEntry{
		WorkspaceID: invite.WorkspaceID,
		UserID:      invite.Email,
		UserName:    invite.Email,
		Action:      "invite.otp_requested",
		ResourceID:  invite.ID,
		Detail:      fmt.Sprintf("Verification code dispatched to %s for workspace %s", invite.Email, workspace.Name),
		IPAddress:   ip,
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"email": invite.Email, "workspaceId": invite.WorkspaceID},
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("A 6-digit verification code has been dispatched to %s", invite.Email),
		"expiresIn": 600,
	})
}

// ─── POST /api/auth/invites/{token}/verify-otp ────────────────────────────
// Validates the 6-digit OTP code against the hashed OTP in the database.

func (h *AuthHandler) HandleInviteVerifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/auth/invites/")
	token := strings.TrimSuffix(path, "/verify-otp")
	if token == "" {
		writeJSONError(w, "Token required", http.StatusBadRequest)
		return
	}
	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	invite, err := findActiveInvite(token)
	if err != nil {
		writeJSONError(w, "Invite not found or expired", http.StatusNotFound)
		return
	}

	rateKey := fmt.Sprintf("otp-verify:%s", token)
	if allowed, _, retryAfter, _ := h.otpVerifyLimiter.Allow(r.Context(), rateKey); !allowed {
		writeJSONError(w, fmt.Sprintf("Too many verification attempts. Please wait %d seconds", int(retryAfter.Seconds())), http.StatusTooManyRequests)
		return
	}

	if invite.OTPTries >= 5 {
		writeJSONError(w, "Maximum verification attempts exceeded. Please request a new verification code.", http.StatusTooManyRequests)
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(strings.TrimSpace(req.Code)) != 6 {
		writeJSONError(w, "Valid 6-digit code required", http.StatusBadRequest)
		return
	}

	cleanCode := strings.TrimSpace(req.Code)
	now := time.Now()

	if invite.OTPExpiresAt == nil || now.After(*invite.OTPExpiresAt) {
		writeJSONError(w, "Verification code has expired. Please request a new code.", http.StatusBadRequest)
		return
	}

	inputHash := hashToken(cleanCode)
	if subtle.ConstantTimeCompare([]byte(inputHash), []byte(invite.OTPCodeHash)) != 1 {
		DB.Model(invite).Update("otp_tries", invite.OTPTries+1)
		log.Printf("[Security] Invalid OTP attempt for invite %s (attempt %d/5)", token, invite.OTPTries+1)
		LogAudit(AuditEntry{
			WorkspaceID: invite.WorkspaceID,
			UserID:      invite.Email,
			UserName:    invite.Email,
			Action:      "invite.otp_failed",
			ResourceID:  invite.ID,
			Detail:      fmt.Sprintf("Invalid OTP verification attempt (%d/5) from IP %s", invite.OTPTries+1, getClientIP(r)),
			IPAddress:   getClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "FAILURE",
			Severity:    "WARN",
			Metadata:    map[string]interface{}{"email": invite.Email, "attempts": invite.OTPTries + 1},
		})
		writeJSONError(w, "Invalid verification code. Please check your email and try again.", http.StatusBadRequest)
		return
	}

	// Code successfully verified
	DB.Model(invite).Updates(map[string]interface{}{
		"otp_verified_at": now,
		"otp_tries":       0,
	})

	LogAudit(AuditEntry{
		WorkspaceID: invite.WorkspaceID,
		UserID:      invite.Email,
		UserName:    invite.Email,
		Action:      "invite.otp_verified",
		ResourceID:  invite.ID,
		Detail:      fmt.Sprintf("OTP successfully verified for invite %s (%s)", invite.ID, invite.Email),
		IPAddress:   getClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"email": invite.Email},
	})

	log.Printf("[Security] OTP successfully verified for invite %s (%s)", token, invite.Email)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"verified": true,
		"email":    invite.Email,
	})
}

// ─── POST /api/auth/invites/{token}/accept ───────────────────────────────
// Accepts invitation. Strictly requires prior OTP verification.

func (h *AuthHandler) HandleInviteAccept(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/auth/invites/")
	token := strings.TrimSuffix(path, "/accept")
	if token == "" {
		writeJSONError(w, "Token required", http.StatusBadRequest)
		return
	}
	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	invite, err := findActiveInvite(token)
	if err != nil {
		writeJSONError(w, "Invite not found or expired", http.StatusNotFound)
		return
	}

	// Security Gate: Enforce that OTP was verified within the last 30 minutes
	if invite.OTPVerifiedAt == nil || time.Since(*invite.OTPVerifiedAt) > 30*time.Minute {
		log.Printf("[Security] Blocked unverified invite accept attempt for invite %s (%s)", token, invite.Email)
		writeJSONError(w, "Email verification required before accepting invitation. Please verify your OTP first.", http.StatusForbidden)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Name == "" || len(req.Password) < 8 {
		writeJSONError(w, "name and password (min 8 chars) are required", http.StatusBadRequest)
		return
	}

	// Check if user with this email already exists
	var existingUser User
	now := time.Now()
	var user *User

	if err := DB.Where("email = ?", strings.ToLower(invite.Email)).First(&existingUser).Error; err == nil {
		// Existing user — join new workspace
		user = &existingUser
	} else {
		// New user — create account
		hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		newUser := User{
			ID:           generateID(),
			Email:        strings.ToLower(invite.Email),
			Name:         req.Name,
			PasswordHash: string(hash),
			IsActive:     true,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := DB.Create(&newUser).Error; err != nil {
			writeJSONError(w, "Failed to create user: "+err.Error(), http.StatusInternalServerError)
			return
		}
		user = &newUser
	}

	// Add workspace membership
	member := WorkspaceMember{
		ID:              generateID(),
		WorkspaceID:     invite.WorkspaceID,
		UserID:          user.ID,
		Role:            invite.Role,
		ProjectAccess:   invite.ProjectAccess,
		AllowedProjects: invite.AllowedProjects,
		InvitedBy:       invite.InvitedBy,
		JoinedAt:        now,
	}
	DB.Create(&member)

	// Mark invite as used
	DB.Model(invite).Update("used_at", now)

	var workspace Workspace
	DB.First(&workspace, "id = ?", invite.WorkspaceID)

	accessToken, err := issueTokenPair(w, user, invite.WorkspaceID, invite.Role)
	if err != nil {
		writeJSONError(w, "Failed to issue token", http.StatusInternalServerError)
		return
	}

	ip := getClientIP(r)
	ua := r.UserAgent()
	log.Printf("[Auth] Invite accepted — user: %s joined workspace: %s as %s (IP: %s)", user.Email, workspace.Name, invite.Role, ip)

	// Record security audit trail
	LogAudit(AuditEntry{
		WorkspaceID: invite.WorkspaceID,
		UserID:      user.ID,
		UserName:    user.Name,
		Action:      "invite.accepted",
		ResourceID:  invite.ID,
		Detail:      fmt.Sprintf("Accepted invitation as %s", invite.Role),
		IPAddress:   ip,
		UserAgent:   ua,
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"email": user.Email, "role": invite.Role},
	})

	h.writeAuthResponse(w, user, &workspace, invite.Role, accessToken)
}

// ─── GitHub OAuth ─────────────────────────────────────────────────────────
// GET /api/auth/github  → redirect to GitHub with state token
// GET /api/auth/github/callback → exchange code, verify state, issue JWT

func (h *AuthHandler) HandleGitHubLogin(w http.ResponseWriter, r *http.Request) {
	clientID := os.Getenv("GITHUB_OAUTH_CLIENT_ID")
	if clientID == "" {
		writeJSONError(w, "GitHub OAuth is not configured on this instance. Please configure GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET in your environment.", http.StatusNotImplemented)
		return
	}

	state := generateToken(24)
	secureCookie := os.Getenv("COOKIE_SECURE") == "true"
	http.SetCookie(w, &http.Cookie{
		Name:     "gh_oauth_state",
		Value:    state,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(10 * time.Minute),
	})

	redirectURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&scope=user:email&state=%s",
		url.QueryEscape(clientID), state,
	)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (h *AuthHandler) HandleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	queryState := r.URL.Query().Get("state")
	if code == "" {
		writeJSONError(w, "Missing code parameter", http.StatusBadRequest)
		return
	}

	// Verify CSRF state parameter
	stateCookie, err := r.Cookie("gh_oauth_state")
	if err != nil || stateCookie.Value == "" || queryState == "" || subtle.ConstantTimeCompare([]byte(stateCookie.Value), []byte(queryState)) != 1 {
		writeJSONError(w, "Invalid or expired OAuth state parameter (potential CSRF attempt)", http.StatusForbidden)
		return
	}

	// Clear state cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "gh_oauth_state",
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})

	clientID := os.Getenv("GITHUB_OAUTH_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_OAUTH_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		writeJSONError(w, "GitHub OAuth not configured", http.StatusNotImplemented)
		return
	}

	// Exchange code for access token
	tokenResp, err := http.PostForm("https://github.com/login/oauth/access_token", url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
	})
	if err != nil {
		writeJSONError(w, "GitHub token exchange failed", http.StatusBadGateway)
		return
	}
	defer tokenResp.Body.Close()
	body, _ := io.ReadAll(tokenResp.Body)
	vals, _ := url.ParseQuery(string(body))
	ghAccessToken := vals.Get("access_token")
	if ghAccessToken == "" {
		writeJSONError(w, "Failed to get GitHub access token", http.StatusBadGateway)
		return
	}

	// Fetch GitHub user info
	req2, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	req2.Header.Set("Authorization", "Bearer "+ghAccessToken)
	req2.Header.Set("Accept", "application/json")
	ghResp, err := http.DefaultClient.Do(req2)
	if err != nil {
		writeJSONError(w, "Failed to fetch GitHub user", http.StatusBadGateway)
		return
	}
	defer ghResp.Body.Close()

	var ghUser struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	json.NewDecoder(ghResp.Body).Decode(&ghUser)

	if DB == nil {
		writeJSONError(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	ghIDStr := fmt.Sprintf("%d", ghUser.ID)
	now := time.Now()

	// Find or create user by GitHub ID
	var user User
	if err := DB.Where("git_hub_id = ?", ghIDStr).First(&user).Error; err != nil {
		// Check by email
		email := ghUser.Email
		if email == "" {
			email = fmt.Sprintf("%s@github.com", ghUser.Login)
		}
		if err2 := DB.Where("email = ?", email).First(&user).Error; err2 != nil {
			// Brand new GitHub user — check if bootstrap needed
			var count int64
			DB.Model(&User{}).Count(&count)
			if count == 0 {
				// Auto-bootstrap with GitHub info
				user = User{
					ID:          generateID(),
					Email:       email,
					Name:        ghUser.Name,
					GitHubLogin: ghUser.Login,
					GitHubID:    &ghIDStr,
					IsActive:    true,
					CreatedAt:   now,
					UpdatedAt:   now,
				}
				DB.Create(&user)
				wID := generateID()
				ws := Workspace{ID: wID, Name: ghUser.Login + "'s Workspace", Slug: slugify(ghUser.Login), OwnerID: user.ID, CreatedAt: now, UpdatedAt: now}
				DB.Create(&ws)
				DB.Create(&WorkspaceMember{ID: generateID(), WorkspaceID: wID, UserID: user.ID, Role: "owner", JoinedAt: now})
			} else {
				writeJSONError(w, "No invite found for this GitHub account — ask your workspace owner to invite you", http.StatusForbidden)
				return
			}
		} else {
			// Link GitHub ID to existing account
			DB.Model(&user).Updates(map[string]interface{}{"git_hub_id": ghIDStr, "git_hub_login": ghUser.Login})
		}
	}

	var member WorkspaceMember
	if err := DB.Where("user_id = ?", user.ID).First(&member).Error; err != nil {
		writeJSONError(w, "No workspace membership", http.StatusForbidden)
		return
	}
	var workspace Workspace
	DB.First(&workspace, "id = ?", member.WorkspaceID)

	DB.Model(&user).Update("last_seen_at", now)

	_, err = issueTokenPair(w, &user, member.WorkspaceID, member.Role)
	if err != nil {
		writeJSONError(w, "Failed to issue token", http.StatusInternalServerError)
		return
	}

	// Redirect to frontend safely without exposing token in query parameters
	frontendURL := os.Getenv("VITE_BACKEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	} else {
		frontendURL = strings.Replace(frontendURL, ":8080", ":3000", 1)
	}
	http.Redirect(w, r, frontendURL, http.StatusFound)
}

// ─── Shared Helpers ───────────────────────────────────────────────────────

type authResponse struct {
	AccessToken string        `json:"accessToken"`
	User        UserPublicDTO `json:"user"`
	Workspace   *Workspace    `json:"workspace"`
	Role        string        `json:"role"`
}

func (h *AuthHandler) writeAuthResponse(w http.ResponseWriter, user *User, workspace *Workspace, role, accessToken string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(authResponse{
		AccessToken: accessToken,
		User:        toUserDTO(user),
		Workspace:   workspace,
		Role:        role,
	})
}

// extractPathParam pulls a segment from a URL path between prefix and suffix.
func extractPathParam(path, prefix, suffix string) string {
	s := strings.TrimPrefix(path, prefix)
	if suffix != "" {
		s = strings.TrimSuffix(s, suffix)
	}
	return strings.Split(s, "/")[0]
}
