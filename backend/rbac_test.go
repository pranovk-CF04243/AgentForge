package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRBACRoleHierarchyPermissions(t *testing.T) {
	// Verifies the RBAC role requirements for modifying permissions
	if !AtLeastRole("owner", "admin") {
		t.Error("Owner should be at least admin")
	}
	if !AtLeastRole("admin", "admin") {
		t.Error("Admin should be at least admin")
	}
	if AtLeastRole("developer", "admin") {
		t.Error("Developer should NOT be at least admin")
	}
	if AtLeastRole("viewer", "admin") {
		t.Error("Viewer should NOT be at least admin")
	}
}

func TestRBACEndpointsGating(t *testing.T) {
	hub := NewHub()
	orchestrator := NewOrchestrator(hub, nil)
	wsHandler := NewWorkspaceHandler(orchestrator, hub)

	// 1. RBAC permissions GET by developer should be allowed (read access)
	{
		req := httptest.NewRequest(http.MethodGet, "/api/workspace/rbac/permissions", nil)
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "developer")
		ctx = context.WithValue(ctx, ctxUserID, "dev-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleRBACPermissions(w, req)

		// DB is nil in unit tests, so expect 401 Unauthorized / DB unavailable, NOT 403 Forbidden
		if w.Code == http.StatusForbidden {
			t.Errorf("Developer GET on RBAC permissions should not be 403 Forbidden")
		}
	}

	// 2. RBAC permissions PUT by developer should be 403 Forbidden
	{
		body, _ := json.Marshal(map[string]interface{}{
			"invite_members": map[string]bool{"admin": true, "developer": true, "viewer": false},
		})
		req := httptest.NewRequest(http.MethodPut, "/api/workspace/rbac/permissions", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "developer")
		ctx = context.WithValue(ctx, ctxUserID, "dev-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleRBACPermissions(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for developer PUT on RBAC permissions, got %d", w.Code)
		}
	}

	// 3. RBAC permissions PUT by viewer should be 403 Forbidden
	{
		body, _ := json.Marshal(map[string]interface{}{})
		req := httptest.NewRequest(http.MethodPut, "/api/workspace/rbac/permissions", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "viewer")
		ctx = context.WithValue(ctx, ctxUserID, "view-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleRBACPermissions(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for viewer PUT on RBAC permissions, got %d", w.Code)
		}
	}

	// 4. RBAC permissions Reset by developer should be 403 Forbidden
	{
		req := httptest.NewRequest(http.MethodPost, "/api/workspace/rbac/permissions/reset", nil)
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "developer")
		ctx = context.WithValue(ctx, ctxUserID, "dev-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleRBACPermissionsReset(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for developer POST on RBAC reset, got %d", w.Code)
		}
	}
}

func TestHandleMemberRolePermissions(t *testing.T) {
	hub := NewHub()
	orchestrator := NewOrchestrator(hub, nil)
	wsHandler := NewWorkspaceHandler(orchestrator, hub)

	// 1. Non-admin (developer) attempting to modify member role should get 403
	{
		body, _ := json.Marshal(map[string]string{"role": "admin"})
		req := httptest.NewRequest(http.MethodPatch, "/api/workspace/members/member-999", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "developer")
		ctx = context.WithValue(ctx, ctxUserID, "dev-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleMember(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for developer PATCH member role, got %d", w.Code)
		}
	}

	// 2. Non-admin (viewer) attempting to modify member role should get 403
	{
		body, _ := json.Marshal(map[string]string{"role": "developer"})
		req := httptest.NewRequest(http.MethodPatch, "/api/workspace/members/member-999", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "viewer")
		ctx = context.WithValue(ctx, ctxUserID, "viewer-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleMember(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for viewer PATCH member role, got %d", w.Code)
		}
	}

	// 3. Admin attempting to delete a member should get 403 (only owner can delete members)
	{
		req := httptest.NewRequest(http.MethodDelete, "/api/workspace/members/member-999", nil)
		ctx := context.WithValue(req.Context(), ctxWorkspaceID, "ws-123")
		ctx = context.WithValue(ctx, ctxRole, "admin")
		ctx = context.WithValue(ctx, ctxUserID, "admin-1")
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		wsHandler.HandleMember(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for admin DELETE member, got %d", w.Code)
		}
	}
}
