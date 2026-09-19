package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// WorkspaceHandler handles workspace and member management routes.
type WorkspaceHandler struct {
	orch *Orchestrator
	hub  *Hub
}

func NewWorkspaceHandler(orch *Orchestrator, hub *Hub) *WorkspaceHandler {
	return &WorkspaceHandler{orch: orch, hub: hub}
}

// ─── GET /api/workspace ──────────────────────────────────────────────────

func (wh *WorkspaceHandler) HandleWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsID := ctxGetWorkspaceID(r)
	if wsID == "" || DB == nil {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var ws Workspace
	if err := DB.First(&ws, "id = ?", wsID).Error; err != nil {
		writeJSONError(w, "Workspace not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ws)
}

// ─── GET /api/workspace/members ──────────────────────────────────────────
// ─── POST /api/workspace/members  (min: admin) — create invite

func (wh *WorkspaceHandler) HandleMembers(w http.ResponseWriter, r *http.Request) {
	wsID := ctxGetWorkspaceID(r)
	if wsID == "" || DB == nil {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method == http.MethodGet {
		type MemberView struct {
			WorkspaceMember
			UserName        string   `json:"userName"`
			UserEmail       string   `json:"userEmail"`
			AvatarURL       string   `json:"avatarUrl"`
			AllowedProjects []string `json:"allowedProjects"`
		}
		var members []WorkspaceMember
		DB.Where("workspace_id = ?", wsID).Find(&members)
		var result []MemberView
		for _, m := range members {
			var u User
			DB.First(&u, "id = ?", m.UserID)
			var projList []string
			if m.AllowedProjects != "" {
				_ = json.Unmarshal([]byte(m.AllowedProjects), &projList)
			}
			if projList == nil {
				projList = []string{}
			}
			result = append(result, MemberView{
				WorkspaceMember: m,
				UserName:        u.Name,
				UserEmail:       u.Email,
				AvatarURL:       u.AvatarURL,
				AllowedProjects: projList,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	if r.Method == http.MethodPost {
		// Require admin or owner to invite
		role := ctxGetRole(r)
		if !AtLeastRole(role, "admin") {
			writeJSONError(w, "Forbidden: requires admin role", http.StatusForbidden)
			return
		}

		var req struct {
			Email           string   `json:"email"`
			Role            string   `json:"role"`
			ProjectAccess   string   `json:"projectAccess"`
			AllowedProjects []string `json:"allowedProjects"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		if req.Email == "" || req.Role == "" {
			writeJSONError(w, "email and role are required", http.StatusBadRequest)
			return
		}
		validRoles := map[string]bool{"admin": true, "developer": true, "viewer": true}
		if !validRoles[req.Role] {
			writeJSONError(w, "role must be admin, developer, or viewer", http.StatusBadRequest)
			return
		}

		// Check not already a member
		var existing WorkspaceMember
		var existingUser User
		if err := DB.Where("email = ?", strings.ToLower(req.Email)).First(&existingUser).Error; err == nil {
			if err2 := DB.Where("workspace_id = ? AND user_id = ?", wsID, existingUser.ID).First(&existing).Error; err2 == nil {
				writeJSONError(w, "User is already a member of this workspace", http.StatusConflict)
				return
			}
		}

		token := generateToken(24)
		now := time.Now()
		
		projBytes, _ := json.Marshal(req.AllowedProjects)
		pAccess := req.ProjectAccess
		if pAccess == "" {
			pAccess = "all"
		}
		
		invite := Invite{
			ID:              generateID(),
			WorkspaceID:     wsID,
			Email:           strings.ToLower(req.Email),
			Role:            req.Role,
			ProjectAccess:   pAccess,
			AllowedProjects: string(projBytes),
			Token:           token,
			TokenHash:       hashToken(token),
			InvitedBy:       ctxGetUserID(r),
			ExpiresAt:       now.Add(inviteTTL),
			CreatedAt:   now,
		}
		if err := DB.Create(&invite).Error; err != nil {
			writeJSONError(w, "Failed to create invite", http.StatusInternalServerError)
			return
		}

		frontendBase := "http://localhost:3000"
		inviteLink := fmt.Sprintf("%s/invite/%s", frontendBase, token)

		LogAudit(AuditEntry{
			WorkspaceID: wsID,
			UserID:      ctxGetUserID(r),
			UserName:    ctxGetUserName(r),
			Action:      "member.invited",
			ResourceID:  invite.ID,
			Detail:      fmt.Sprintf("Invited %s as %s", req.Email, req.Role),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "INFO",
			Metadata:    map[string]interface{}{"email": req.Email, "role": req.Role},
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"invite":     invite,
			"inviteLink": inviteLink,
		})
		log.Printf("[Workspace] Invite created for %s (%s) in workspace %s", req.Email, req.Role, wsID)
		return
	}

	writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ─── PATCH /api/workspace/members/{id}   (min: admin) — change role
// ─── DELETE /api/workspace/members/{id}  (min: owner) — remove member

func (wh *WorkspaceHandler) HandleMember(w http.ResponseWriter, r *http.Request) {
	wsID := ctxGetWorkspaceID(r)
	callerRole := ctxGetRole(r)
	callerID := ctxGetUserID(r)
	if wsID == "" {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method == http.MethodPatch {
		if !AtLeastRole(callerRole, "admin") {
			writeJSONError(w, "Forbidden: requires admin role", http.StatusForbidden)
			return
		}
	} else if r.Method == http.MethodDelete {
		if callerRole != "owner" {
			writeJSONError(w, "Forbidden: only owner can remove members", http.StatusForbidden)
			return
		}
	} else {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if DB == nil {
		writeJSONError(w, "Database unavailable", http.StatusServiceUnavailable)
		return
	}

	memberID := strings.TrimPrefix(r.URL.Path, "/api/workspace/members/")
	if memberID == "" {
		writeJSONError(w, "Member ID required", http.StatusBadRequest)
		return
	}

	var member WorkspaceMember
	if err := DB.Where("(id = ? OR user_id = ?) AND workspace_id = ?", memberID, memberID, wsID).First(&member).Error; err != nil {
		writeJSONError(w, "Member not found", http.StatusNotFound)
		return
	}

	if r.Method == http.MethodPatch {
		// Prevent modifying owner role or access by non-owner
		if member.Role == "owner" && callerRole != "owner" {
			writeJSONError(w, "Forbidden: only the workspace owner can modify an owner's access or role", http.StatusForbidden)
			return
		}
		var req struct {
			Role            string   `json:"role"`
			ProjectAccess   string   `json:"projectAccess"`   // "all" | "custom"
			AllowedProjects []string `json:"allowedProjects"` // list of project IDs e.g. ["proj-1"]
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}

		updates := make(map[string]interface{})
		var actionDetails []string

		if req.Role != "" {
			validRoles := map[string]bool{"owner": true, "admin": true, "developer": true, "viewer": true}
			if !validRoles[req.Role] {
				writeJSONError(w, "Invalid role. Role must be owner, admin, developer, or viewer", http.StatusBadRequest)
				return
			}
			if req.Role == "owner" && callerRole != "owner" {
				writeJSONError(w, "Forbidden: only the owner can assign the owner role", http.StatusForbidden)
				return
			}
			updates["role"] = req.Role
			actionDetails = append(actionDetails, fmt.Sprintf("role to %s", req.Role))
		}

		if req.ProjectAccess != "" {
			if req.ProjectAccess != "all" && req.ProjectAccess != "custom" {
				writeJSONError(w, "projectAccess must be 'all' or 'custom'", http.StatusBadRequest)
				return
			}
			updates["project_access"] = req.ProjectAccess
			actionDetails = append(actionDetails, fmt.Sprintf("project access mode to %s", req.ProjectAccess))
		}

		if req.AllowedProjects != nil {
			projBytes, _ := json.Marshal(req.AllowedProjects)
			updates["allowed_projects"] = string(projBytes)
			actionDetails = append(actionDetails, fmt.Sprintf("allowed projects to %v", req.AllowedProjects))
		}

		if len(updates) == 0 {
			writeJSONError(w, "No valid updates provided", http.StatusBadRequest)
			return
		}

		DB.Model(&member).Updates(updates)

		// Re-fetch updated member record
		DB.First(&member, "id = ?", member.ID)

		LogAudit(AuditEntry{
			WorkspaceID: wsID,
			UserID:      callerID,
			UserName:    ctxGetUserName(r),
			Action:      "member.access_updated",
			ResourceID:  memberID,
			Detail:      fmt.Sprintf("Updated member %s: %s", memberID, strings.Join(actionDetails, ", ")),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "WARN",
			Metadata: map[string]interface{}{
				"memberId":        memberID,
				"role":            member.Role,
				"projectAccess":   member.ProjectAccess,
				"allowedProjects": req.AllowedProjects,
			},
		})

		// Broadcast member update to workspace peers
		if wh.hub != nil {
			msg, _ := json.Marshal(map[string]interface{}{
				"action":          "MEMBER_UPDATED",
				"workspaceId":     wsID,
				"memberId":        member.ID,
				"userId":          member.UserID,
				"role":            member.Role,
				"projectAccess":   member.ProjectAccess,
				"allowedProjects": req.AllowedProjects,
			})
			wh.hub.BroadcastToWorkspace(wsID, msg)
		}

		var projList []string
		if member.AllowedProjects != "" {
			_ = json.Unmarshal([]byte(member.AllowedProjects), &projList)
		}
		if projList == nil {
			projList = []string{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":              member.ID,
			"workspaceId":     member.WorkspaceID,
			"userId":          member.UserID,
			"role":            member.Role,
			"projectAccess":   member.ProjectAccess,
			"allowedProjects": projList,
			"invitedBy":       member.InvitedBy,
			"joinedAt":        member.JoinedAt,
		})
		return
	}

	if r.Method == http.MethodDelete {
		if callerRole != "owner" {
			writeJSONError(w, "Forbidden: only owner can remove members", http.StatusForbidden)
			return
		}
		if member.UserID == callerID {
			writeJSONError(w, "Cannot remove yourself", http.StatusBadRequest)
			return
		}
		DB.Delete(&member)
		LogAudit(AuditEntry{
			WorkspaceID: wsID,
			UserID:      callerID,
			UserName:    ctxGetUserName(r),
			Action:      "member.removed",
			ResourceID:  memberID,
			Detail:      fmt.Sprintf("Member %s removed from workspace", memberID),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "WARN",
			Metadata:    map[string]interface{}{"memberId": memberID},
		})
		w.WriteHeader(http.StatusNoContent)
		return
	}

	writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ─── GET /api/workspace/invites ──────────────────────────────────────────

func (wh *WorkspaceHandler) HandleInvites(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsID := ctxGetWorkspaceID(r)
	if !AtLeastRole(ctxGetRole(r), "admin") {
		writeJSONError(w, "Forbidden: requires admin role", http.StatusForbidden)
		return
	}
	var invites []Invite
	DB.Where("workspace_id = ? AND expires_at > ? AND used_at IS NULL", wsID, time.Now()).Find(&invites)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invites)
}

// ─── DELETE /api/workspace/invites/{id} ──────────────────────────────────

func (wh *WorkspaceHandler) HandleInviteDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsID := ctxGetWorkspaceID(r)
	callerRole := ctxGetRole(r)
	callerID := ctxGetUserID(r)
	if wsID == "" || DB == nil {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !AtLeastRole(callerRole, "admin") {
		writeJSONError(w, "Forbidden: requires admin role", http.StatusForbidden)
		return
	}

	inviteID := strings.TrimPrefix(r.URL.Path, "/api/workspace/invites/")
	if inviteID == "" {
		writeJSONError(w, "Invite ID required", http.StatusBadRequest)
		return
	}

	var invite Invite
	if err := DB.Where("id = ? AND workspace_id = ?", inviteID, wsID).First(&invite).Error; err != nil {
		writeJSONError(w, "Invite not found", http.StatusNotFound)
		return
	}

	DB.Delete(&invite)
	LogAudit(AuditEntry{
		WorkspaceID: wsID,
		UserID:      callerID,
		UserName:    ctxGetUserName(r),
		Action:      "member.invite_revoked",
		ResourceID:  inviteID,
		Detail:      fmt.Sprintf("Revoked invite for %s (%s)", invite.Email, invite.Role),
		IPAddress:   ExtractClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "INFO",
		Metadata:    map[string]interface{}{"inviteId": inviteID, "email": invite.Email, "role": invite.Role},
	})

	w.WriteHeader(http.StatusNoContent)
}

// ─── GET /api/workspace/activity ─────────────────────────────────────────

func (wh *WorkspaceHandler) HandleActivity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsID := ctxGetWorkspaceID(r)
	if wsID == "" || DB == nil {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	query := DB.Where("workspace_id = ?", wsID)

	if severity := r.URL.Query().Get("severity"); severity != "" && severity != "ALL" {
		query = query.Where("severity = ?", strings.ToUpper(severity))
	}
	if action := r.URL.Query().Get("action"); action != "" {
		query = query.Where("action LIKE ?", action+"%")
	}
	if status := r.URL.Query().Get("status"); status != "" {
		query = query.Where("status = ?", strings.ToUpper(status))
	}
	if search := r.URL.Query().Get("search"); search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("user_name ILIKE ? OR action ILIKE ? OR detail ILIKE ? OR ip_address ILIKE ?", searchPattern, searchPattern, searchPattern, searchPattern)
	}

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil && val > 0 {
			limit = val
			if limit > 500 {
				limit = 500
			}
		}
	}

	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if val, err := strconv.Atoi(o); err == nil && val >= 0 {
			offset = val
		}
	}

	var logs []ActivityLog
	query.Order("created_at desc").Limit(limit).Offset(offset).Find(&logs)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// ─── GET /api/workspace/activity/export (CSV export) ─────────────────────

func (wh *WorkspaceHandler) HandleActivityExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsID := ctxGetWorkspaceID(r)
	if wsID == "" || DB == nil {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	query := DB.Where("workspace_id = ?", wsID)

	if severity := r.URL.Query().Get("severity"); severity != "" && severity != "ALL" {
		query = query.Where("severity = ?", strings.ToUpper(severity))
	}
	if action := r.URL.Query().Get("action"); action != "" {
		query = query.Where("action LIKE ?", action+"%")
	}
	if status := r.URL.Query().Get("status"); status != "" {
		query = query.Where("status = ?", strings.ToUpper(status))
	}
	if search := r.URL.Query().Get("search"); search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("user_name ILIKE ? OR action ILIKE ? OR detail ILIKE ? OR ip_address ILIKE ?", searchPattern, searchPattern, searchPattern, searchPattern)
	}

	var logs []ActivityLog
	query.Order("created_at desc").Limit(5000).Find(&logs)

	filename := fmt.Sprintf("audit-log-%s-%s.csv", wsID, time.Now().UTC().Format("20060102-150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	_ = csvWriter.Write([]string{
		"ID",
		"Timestamp (UTC)",
		"Actor Name",
		"Actor ID",
		"Action",
		"Severity",
		"Status",
		"Resource ID",
		"IP Address",
		"User Agent",
		"Detail",
		"Metadata",
	})

	for _, l := range logs {
		_ = csvWriter.Write([]string{
			l.ID,
			l.CreatedAt.Format(time.RFC3339),
			l.UserName,
			l.UserID,
			l.Action,
			l.Severity,
			l.Status,
			l.ResourceID,
			l.IPAddress,
			l.UserAgent,
			l.Detail,
			l.Metadata,
		})
	}
}

// ─── Internal: Write activity log + broadcast via WS ─────────────────────

func (wh *WorkspaceHandler) logActivity(workspaceID, projectID, userID, userName, action, resourceID, detail string) {
	LogAudit(AuditEntry{
		WorkspaceID: workspaceID,
		ProjectID:   projectID,
		UserID:      userID,
		UserName:    userName,
		Action:      action,
		ResourceID:  resourceID,
		Detail:      detail,
		Status:      "SUCCESS",
		Severity:    "INFO",
	})
}

// ─── GET/PUT /api/workspace/rbac/permissions ─────────────────────────────

func (wh *WorkspaceHandler) HandleRBACPermissions(w http.ResponseWriter, r *http.Request) {
	wsID := ctxGetWorkspaceID(r)
	if wsID == "" {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method == http.MethodPut || r.Method == http.MethodPost {
		callerRole := ctxGetRole(r)
		if !AtLeastRole(callerRole, "admin") {
			writeJSONError(w, "Forbidden: requires admin or owner role to modify RBAC permissions", http.StatusForbidden)
			return
		}
	}

	if DB == nil {
		writeJSONError(w, "Database unavailable", http.StatusServiceUnavailable)
		return
	}

	var ws Workspace
	if err := DB.First(&ws, "id = ?", wsID).Error; err != nil {
		writeJSONError(w, "Workspace not found", http.StatusNotFound)
		return
	}

	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		var perms interface{}
		if ws.CustomPermissions != "" {
			_ = json.Unmarshal([]byte(ws.CustomPermissions), &perms)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"workspaceId":       wsID,
			"customPermissions": perms,
		})
		return
	}

	if r.Method == http.MethodPut || r.Method == http.MethodPost {
		callerRole := ctxGetRole(r)
		callerID := ctxGetUserID(r)

		var req struct {
			Permissions json.RawMessage `json:"permissions"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Permissions) == 0 {
			writeJSONError(w, "Invalid permissions payload", http.StatusBadRequest)
			return
		}

		permStr := string(req.Permissions)
		if err := DB.Model(&ws).Update("custom_permissions", permStr).Error; err != nil {
			writeJSONError(w, "Failed to save custom permissions", http.StatusInternalServerError)
			return
		}

		LogAudit(AuditEntry{
			WorkspaceID: wsID,
			UserID:      callerID,
			UserName:    ctxGetUserName(r),
			Action:      "rbac.permissions_updated",
			ResourceID:  wsID,
			Detail:      fmt.Sprintf("Updated custom RBAC permissions matrix by %s (%s)", ctxGetUserName(r), callerRole),
			IPAddress:   ExtractClientIP(r),
			UserAgent:   r.UserAgent(),
			Status:      "SUCCESS",
			Severity:    "SECURITY",
		})

		// Broadcast real-time RBAC update to all connected clients in this workspace
		if wh.hub != nil {
			msg, _ := json.Marshal(map[string]interface{}{
				"action":            "RBAC_PERMISSIONS_UPDATED",
				"workspaceId":       wsID,
				"customPermissions": req.Permissions,
			})
			wh.hub.BroadcastToWorkspace(wsID, msg)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":           true,
			"customPermissions": req.Permissions,
		})
		return
	}

	writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ─── POST /api/workspace/rbac/permissions/reset ──────────────────────────

func (wh *WorkspaceHandler) HandleRBACPermissionsReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsID := ctxGetWorkspaceID(r)
	callerRole := ctxGetRole(r)
	callerID := ctxGetUserID(r)
	if wsID == "" {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !AtLeastRole(callerRole, "admin") {
		writeJSONError(w, "Forbidden: requires admin or owner role", http.StatusForbidden)
		return
	}
	if DB == nil {
		writeJSONError(w, "Database unavailable", http.StatusServiceUnavailable)
		return
	}

	var ws Workspace
	if err := DB.First(&ws, "id = ?", wsID).Error; err != nil {
		writeJSONError(w, "Workspace not found", http.StatusNotFound)
		return
	}

	DB.Model(&ws).Update("custom_permissions", "")

	LogAudit(AuditEntry{
		WorkspaceID: wsID,
		UserID:      callerID,
		UserName:    ctxGetUserName(r),
		Action:      "rbac.permissions_reset",
		ResourceID:  wsID,
		Detail:      fmt.Sprintf("Reset RBAC permissions to default policy by %s", ctxGetUserName(r)),
		IPAddress:   ExtractClientIP(r),
		UserAgent:   r.UserAgent(),
		Status:      "SUCCESS",
		Severity:    "SECURITY",
	})

	if wh.hub != nil {
		msg, _ := json.Marshal(map[string]interface{}{
			"action":            "RBAC_PERMISSIONS_UPDATED",
			"workspaceId":       wsID,
			"customPermissions": nil,
		})
		wh.hub.BroadcastToWorkspace(wsID, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "RBAC permissions reset to defaults",
	})
}
