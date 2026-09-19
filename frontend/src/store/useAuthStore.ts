import { create } from 'zustand';
import { apiFetch, apiFetchJSON, setAccessToken, getAccessToken, clearSession, refreshSession, BACKEND_URL } from '../lib/api';

export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  githubLogin?: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  projectAccess?: 'all' | 'custom';
  allowedProjects?: string[];
  invitedBy: string;
  joinedAt: string;
  // Joined from user record
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
}

export interface PendingInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  projectId?: string;
  userId: string;
  userName: string;
  action: string;
  resourceId?: string;
  detail: string;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL' | 'SECURITY' | string;
  metadata?: string;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  role: WorkspaceRole | null;
  projectAccess: 'all' | 'custom';
  allowedProjects: string[];
  members: WorkspaceMember[];
  invites: PendingInvite[];
  activityLogs: ActivityLog[];
  isAuthenticated: boolean;
  isLoading: boolean;
  bootstrapRequired: boolean;  // true when 0 users exist

  checkBootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGitHub: () => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  updateProfile: (name?: string, avatarUrl?: string) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchInvites: () => Promise<void>;
  fetchActivity: (filters?: { severity?: string; action?: string; search?: string; status?: string }) => Promise<void>;
  exportActivityCSV: (filters?: { severity?: string; action?: string; search?: string; status?: string }) => Promise<void>;
  inviteMember: (email: string, role: WorkspaceRole, projectAccess?: 'all' | 'custom', allowedProjects?: string[]) => Promise<string>;
  revokeInvite: (inviteId: string) => Promise<void>;
  changeMemberRole: (memberId: string, role: WorkspaceRole) => Promise<void>;
  updateMemberAccess: (memberId: string, updates: { role?: WorkspaceRole; projectAccess?: 'all' | 'custom'; allowedProjects?: string[] }) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  customPermissions: Record<string, any> | null;
  fetchRBACPermissions: () => Promise<void>;
  updateRBACPermissions: (permissions: Record<string, any>) => Promise<void>;
  resetRBACPermissions: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspace: null,
  role: null,
  projectAccess: 'all',
  allowedProjects: [],
  members: [],
  invites: [],
  activityLogs: [],
  customPermissions: null,
  isAuthenticated: false,
  isLoading: true,
  bootstrapRequired: false,

  checkBootstrap: async () => {
    try {
      // Try to login with dummy creds — if 503 it's not DB ready, if 409/conflict bootstrap complete
      const res = await fetch(`${BACKEND_URL}/api/auth/bootstrap`, { method: 'GET' });
      // We detect bootstrap needed by fetching /api/auth/login with empty — but easier:
      // just try a quick bootstrap call with a known-to-fail body
      // Actually, we check by calling /api/health which is always public
      // The backend returns 409 if users exist, so we just probe
      const probe = await fetch(`${BACKEND_URL}/api/auth/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email: '', password: '', workspaceName: '' }),
      });
      // If 400 (validation fail) → means backend is up and bootstrap endpoint is live
      // If 409 → bootstrap already done (users exist)
      set({ bootstrapRequired: probe.status !== 409, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const data = await apiFetchJSON<{ accessToken: string; user: AuthUser; workspace: AuthWorkspace; role: WorkspaceRole }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    setAccessToken(data.accessToken);
    const me = await apiFetchJSON<{
      user: AuthUser;
      workspace: AuthWorkspace;
      role: WorkspaceRole;
      projectAccess?: 'all' | 'custom';
      allowedProjects?: string[];
    }>('/api/auth/me').catch(() => null);
    set({
      user: data.user,
      workspace: data.workspace,
      role: data.role,
      projectAccess: me?.projectAccess || 'all',
      allowedProjects: me?.allowedProjects || [],
      isAuthenticated: true,
      bootstrapRequired: false,
    });
  },

  loginWithGitHub: () => {
    window.location.href = `${BACKEND_URL}/api/auth/github`;
  },

  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    clearSession();
    set({ user: null, workspace: null, role: null, projectAccess: 'all', allowedProjects: [], isAuthenticated: false, members: [], invites: [] });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    // First try with current token (from memory or localStorage)
    if (getAccessToken()) {
      try {
        const data = await apiFetchJSON<{
          user: AuthUser;
          workspace: AuthWorkspace;
          role: WorkspaceRole;
          projectAccess?: 'all' | 'custom';
          allowedProjects?: string[];
        }>('/api/auth/me');
        set({
          user: data.user,
          workspace: data.workspace,
          role: data.role,
          projectAccess: data.projectAccess || 'all',
          allowedProjects: data.allowedProjects || [],
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      } catch {
        // Stored token was expired or invalid, fall through to refresh
      }
    }

    const ok = await refreshSession();
    if (!ok) {
      clearSession();
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }
    try {
      const data = await apiFetchJSON<{
        user: AuthUser;
        workspace: AuthWorkspace;
        role: WorkspaceRole;
        projectAccess?: 'all' | 'custom';
        allowedProjects?: string[];
      }>('/api/auth/me');
      set({
        user: data.user,
        workspace: data.workspace,
        role: data.role,
        projectAccess: data.projectAccess || 'all',
        allowedProjects: data.allowedProjects || [],
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      clearSession();
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }
  },

  updateProfile: async (name, avatarUrl) => {
    const body: Record<string, string> = {};
    if (name !== undefined) body.name = name;
    if (avatarUrl !== undefined) body.avatarUrl = avatarUrl;
    const user = await apiFetchJSON<AuthUser>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    set({ user });
  },

  fetchMembers: async () => {
    const members = await apiFetchJSON<WorkspaceMember[]>('/api/workspace/members');
    set({ members });
  },

  fetchInvites: async () => {
    try {
      const invites = await apiFetchJSON<PendingInvite[]>('/api/workspace/invites');
      set({ invites });
    } catch { /* viewer role — no access */ }
  },

  fetchActivity: async (filters) => {
    try {
      const params = new URLSearchParams();
      if (filters?.severity && filters.severity !== 'ALL') params.set('severity', filters.severity);
      if (filters?.action) params.set('action', filters.action);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      const query = params.toString() ? `?${params.toString()}` : '';
      const activityLogs = await apiFetchJSON<ActivityLog[]>(`/api/workspace/activity${query}`);
      set({ activityLogs });
    } catch { /* ignore */ }
  },

  exportActivityCSV: async (filters) => {
    try {
      const params = new URLSearchParams();
      if (filters?.severity && filters.severity !== 'ALL') params.set('severity', filters.severity);
      if (filters?.action) params.set('action', filters.action);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`/api/workspace/activity/export${query}`);
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentforge-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit CSV', err);
    }
  },

  inviteMember: async (email, role, projectAccess, allowedProjects) => {
    const data = await apiFetchJSON<{ invite: PendingInvite; inviteLink: string }>(
      '/api/workspace/members',
      { method: 'POST', body: JSON.stringify({ email, role, projectAccess, allowedProjects }) }
    );
    set(s => ({ invites: [...s.invites, data.invite] }));
    return data.inviteLink;
  },

  revokeInvite: async (inviteId) => {
    await apiFetch(`/api/workspace/invites/${inviteId}`, { method: 'DELETE' });
    set(s => ({ invites: s.invites.filter(i => i.id !== inviteId) }));
  },

  updateMemberAccess: async (memberId, updates) => {
    const res = await apiFetch(`/api/workspace/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update member access' }));
      throw new Error(err.error || `HTTP ${res.status}: Failed to update member access`);
    }
    set(s => ({
      members: s.members.map(m => {
        if (m.id === memberId || m.userId === memberId) {
          return {
            ...m,
            role: updates.role || m.role,
            projectAccess: updates.projectAccess !== undefined ? updates.projectAccess : m.projectAccess,
            allowedProjects: updates.allowedProjects !== undefined ? updates.allowedProjects : m.allowedProjects,
          };
        }
        return m;
      }),
    }));
  },

  changeMemberRole: async (memberId, role) => {
    await get().updateMemberAccess(memberId, { role });
  },

  removeMember: async (memberId) => {
    const res = await apiFetch(`/api/workspace/members/${memberId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove member' }));
      throw new Error(err.error || `HTTP ${res.status}: Failed to remove member`);
    }
    set(s => ({ members: s.members.filter(m => m.id !== memberId && m.userId !== memberId) }));
  },

  fetchRBACPermissions: async () => {
    try {
      const data = await apiFetchJSON<{ customPermissions: any }>('/api/workspace/rbac/permissions');
      set({ customPermissions: data.customPermissions });
    } catch { /* ignore */ }
  },

  updateRBACPermissions: async (permissions) => {
    const res = await apiFetch('/api/workspace/rbac/permissions', {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update permissions' }));
      throw new Error(err.error || 'Failed to update permissions');
    }
    set({ customPermissions: permissions });
  },

  resetRBACPermissions: async () => {
    const res = await apiFetch('/api/workspace/rbac/permissions/reset', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reset permissions' }));
      throw new Error(err.error || 'Failed to reset permissions');
    }
    set({ customPermissions: null });
  },
}));

// Listen for session expiry events from api.ts
if (typeof window !== 'undefined') {
  window.addEventListener('af:session:expired', () => {
    useAuthStore.setState({ user: null, workspace: null, role: null, isAuthenticated: false });
  });
}
