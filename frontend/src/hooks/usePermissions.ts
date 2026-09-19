import { useAuthStore, WorkspaceRole } from '../store/useAuthStore';

// Role hierarchy: owner=4, admin=3, developer=2, viewer=1
const roleRank: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  developer: 2,
  viewer: 1,
};

function atLeast(required: WorkspaceRole, actual: WorkspaceRole | null): boolean {
  if (!actual) return false;
  return roleRank[actual] >= roleRank[required];
}

export interface AgentPermissionTarget {
  allowedRoles?: string[];
}

/**
 * usePermissions — returns a typed set of permission checks based on the current user's role.
 * All backend endpoints enforce the same rules — this is for UX gating only.
 */
export function usePermissions() {
  const role = useAuthStore(s => s.role);

  return {
    // Project management
    canCreateProject:        atLeast('admin', role),
    canDeleteProject:        role === 'owner',

    // Task management
    canLaunchPlan:           atLeast('developer', role),
    canCreateTask:           atLeast('developer', role),
    canRetryTask:            atLeast('developer', role),

    // Approvals
    canApproveTask:          atLeast('admin', role),

    // Agent control
    canInstructAgent: (agent: AgentPermissionTarget) => {
      if (atLeast('admin', role)) return true;
      if (role === 'developer' && agent.allowedRoles?.includes('developer')) return true;
      return false;
    },
    canChangeAgentModel:     atLeast('admin', role),
    canEditAgentPrompt:      atLeast('admin', role),

    // Workspace & member management
    canInviteMembers:        atLeast('admin', role),
    canRemoveMember:         role === 'owner',
    canChangeRoles:          atLeast('admin', role),
    canViewActivityFeed:     atLeast('viewer', role),

    // Raw role for custom checks
    role,
    isOwner:                 role === 'owner',
    isAdmin:                 atLeast('admin', role),
    isDeveloper:             atLeast('developer', role),
    isViewer:                role === 'viewer',
  };
}
