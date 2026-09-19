package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestCheckProjectAccessRoles tests that owners, admins, and unauthenticated/internal callers
// are always granted access to any project.
func TestCheckProjectAccessRoles(t *testing.T) {
	roles := []string{"owner", "admin", ""}
	for _, role := range roles {
		req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
		ctx := context.WithValue(req.Context(), ctxRole, role)
		ctx = context.WithValue(ctx, ctxUserID, "user-test-1")
		ctx = context.WithValue(ctx, ctxWorkspaceID, "ws-test-1")
		req = req.WithContext(ctx)

		if !checkProjectAccess(req, "proj-restricted-99") {
			t.Errorf("Role '%s' should always have access to projects, got false", role)
		}
	}
}

// TestFilterSnapshotForUser_AdminOwnerBypass verifies that snapshots are not altered
// for owners or admins.
func TestFilterSnapshotForUser_AdminOwnerBypass(t *testing.T) {
	testProjects := map[string]*Project{
		"proj-1": {ID: "proj-1", Name: "Project 1"},
		"proj-2": {ID: "proj-2", Name: "Project 2"},
	}
	testTasks := map[string]*Task{
		"task-1": {ID: "task-1", ProjectID: "proj-1", Title: "Task 1"},
		"task-2": {ID: "task-2", ProjectID: "proj-2", Title: "Task 2"},
	}

	for _, role := range []string{"owner", "admin"} {
		pFiltered, tFiltered := filterSnapshotForUser("user-1", "ws-1", role, testProjects, testTasks)
		if len(pFiltered) != 2 {
			t.Errorf("Role '%s' should receive all 2 projects, got %d", role, len(pFiltered))
		}
		if len(tFiltered) != 2 {
			t.Errorf("Role '%s' should receive all 2 tasks, got %d", role, len(tFiltered))
		}
	}
}

// TestHandleMemberProjectAccessGating tests that only workspace admins and owners
// can configure projectAccess and allowedProjects on members.
func TestHandleMemberProjectAccessGating(t *testing.T) {
	hub := NewHub()
	orchestrator := NewOrchestrator(hub, nil)
	wsHandler := NewWorkspaceHandler(orchestrator, hub)

	payload := map[string]interface{}{
		"projectAccess":   "custom",
		"allowedProjects": []string{"proj-alpha", "proj-beta"},
	}
	body, _ := json.Marshal(payload)

	// 1. Developer caller attempting to modify project access must be rejected with 403
	{
		req := httptest.NewRequest(http.MethodPatch, "/api/workspace/members/member-target-1", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "developer")
		ctx = context.WithValue(ctx, ctxUserID, "dev-caller-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleMember(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for developer PATCH member project access, got %d", w.Code)
		}
	}

	// 2. Viewer caller attempting to modify project access must be rejected with 403
	{
		req := httptest.NewRequest(http.MethodPatch, "/api/workspace/members/member-target-1", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "viewer")
		ctx = context.WithValue(ctx, ctxUserID, "view-caller-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleMember(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for viewer PATCH member project access, got %d", w.Code)
		}
	}

	// 3. Admin caller passes the RBAC authorization gate (w.Code is not 403)
	{
		req := httptest.NewRequest(http.MethodPatch, "/api/workspace/members/member-target-1", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "admin")
		ctx = context.WithValue(ctx, ctxUserID, "admin-caller-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleMember(w, req)

		if w.Code == http.StatusForbidden {
			t.Errorf("Admin caller should NOT be blocked with 403 Forbidden on PATCH member")
		}
	}
}
