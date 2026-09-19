import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Shield,
  Crown,
  Code2,
  Eye,
  UserPlus,
  Copy,
  Check,
  Clock,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  Activity,
  ChevronRight,
  Sparkles,
  Lock,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  Layers,
  FileText,
  Radio,
  Filter,
  Download,
  Globe,
  Edit3,
  Save,
  RotateCcw,
  Sliders,
  UserCheck,
  Info,
  FolderGit2,
  CheckSquare,
  Square
} from 'lucide-react';
import { useAuthStore, WorkspaceRole } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { usePermissions } from '../../hooks/usePermissions';

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; color: string; bgLight: string; bgDark: string; icon: React.ReactNode; desc: string }> = {
  owner: {
    label: 'Owner',
    color: 'text-amber-600 dark:text-amber-400 border-amber-500/30',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-700',
    bgDark: 'dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400',
    icon: <Crown className="w-3.5 h-3.5" />,
    desc: 'Full administrative control, workspace settings, role assignments & billing'
  },
  admin: {
    label: 'Admin',
    color: 'text-blue-600 dark:text-blue-400 border-blue-500/30',
    bgLight: 'bg-blue-50 border-blue-200 text-blue-700',
    bgDark: 'dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400',
    icon: <Shield className="w-3.5 h-3.5" />,
    desc: 'Member invitations, role management, and human-in-the-loop task approvals'
  },
  developer: {
    label: 'Developer',
    color: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    bgDark: 'dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400',
    icon: <Code2 className="w-3.5 h-3.5" />,
    desc: 'Autonomous agent instruction, project creation, pipeline execution & task retries'
  },
  viewer: {
    label: 'Viewer',
    color: 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
    bgLight: 'bg-slate-100 border-slate-200 text-slate-700',
    bgDark: 'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
    icon: <Eye className="w-3.5 h-3.5" />,
    desc: 'Read-only access to 3D office, live DAG kanban, APM telemetry & metrics'
  },
};

function getInitials(name: string): string {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Matrix of Capabilities
interface RBACFeature {
  id: string;
  category: string;
  name: string;
  description: string;
  owner: boolean;
  admin: boolean;
  developer: boolean;
  viewer: boolean;
}

const RBAC_CAPABILITIES: RBACFeature[] = [
  {
    id: 'invite_members',
    category: 'Workspace & Team Governance',
    name: 'Invite New Team Members',
    description: 'Generate secure single-use 72-hour invitation links',
    owner: true,
    admin: true,
    developer: false,
    viewer: false,
  },
  {
    id: 'change_roles',
    category: 'Workspace & Team Governance',
    name: 'Change Member Roles',
    description: 'Promote or reassign roles across the workspace',
    owner: true,
    admin: true,
    developer: false,
    viewer: false,
  },
  {
    id: 'remove_members',
    category: 'Workspace & Team Governance',
    name: 'Revoke Invites & Remove Members',
    description: 'Expel users or cancel pending invitation tokens',
    owner: true,
    admin: false,
    developer: false,
    viewer: false,
  },
  {
    id: 'instruct_agents',
    category: 'AI Agent Orchestration',
    name: 'Instruct Autonomous Agents',
    description: 'Send custom prompts, instructions, and task delegations to agents',
    owner: true,
    admin: true,
    developer: true,
    viewer: false,
  },
  {
    id: 'reconfigure_llm',
    category: 'AI Agent Orchestration',
    name: 'Reconfigure Agent LLM Models',
    description: 'Switch underlying LLM providers (Gemini Pro, Claude Sonnet, GPT-4o)',
    owner: true,
    admin: true,
    developer: true,
    viewer: false,
  },
  {
    id: 'decompose_brd',
    category: 'Autonomous Engineering Pipelines',
    name: 'Initialize Projects & Decompose BRD',
    description: 'Convert high-level requirements into autonomous task DAGs',
    owner: true,
    admin: true,
    developer: true,
    viewer: false,
  },
  {
    id: 'launch_pipeline',
    category: 'Autonomous Engineering Pipelines',
    name: 'Launch & Execute Staged Pipeline',
    description: 'Dispatch orchestrated task batches to digital employees',
    owner: true,
    admin: true,
    developer: true,
    viewer: false,
  },
  {
    id: 'approve_hazardous',
    category: 'Human-in-the-Loop Governance',
    name: 'Approve / Reject Hazardous Actions',
    description: 'Approve sensitive Bash shell runs, git commits, or file overwrites',
    owner: true,
    admin: true,
    developer: false,
    viewer: false,
  },
  {
    id: 'retry_tasks',
    category: 'SRE & Incident Management',
    name: 'Retry Failed Agent Tasks',
    description: 'Rerun failed tasks with updated parameters or error recovery',
    owner: true,
    admin: true,
    developer: true,
    viewer: false,
  },
  {
    id: 'simulate_incidents',
    category: 'SRE & Incident Management',
    name: 'Simulate War Room Incidents',
    description: 'Inject mock chaos/outage scenarios for autonomous SRE testing',
    owner: true,
    admin: true,
    developer: true,
    viewer: false,
  },
  {
    id: 'observe_3d',
    category: 'Observability & Live Systems',
    name: '3D Office & Task DAG Observation',
    description: 'Real-time 3D isometric view, Kanban state, and Kafka event logs',
    owner: true,
    admin: true,
    developer: true,
    viewer: true,
  },
  {
    id: 'k8s_apm',
    category: 'Observability & Live Systems',
    name: 'Kubernetes Workloads & APM Telemetry',
    description: 'Inspect live cluster pods, deployments, memory, and CPU metrics',
    owner: true,
    admin: true,
    developer: true,
    viewer: true,
  },
];

export const TeamManagementDashboard: React.FC = () => {
  const setViewMode = useStore((state) => state.setViewMode);
  const onlineUsers = useStore((state) => state.onlineUsers);
  const {
    user,
    workspace,
    members,
    invites,
    activityLogs,
    customPermissions,
    fetchMembers,
    fetchInvites,
    fetchActivity,
    fetchRBACPermissions,
    updateRBACPermissions,
    resetRBACPermissions,
    exportActivityCSV,
    inviteMember,
    revokeInvite,
    changeMemberRole,
    updateMemberAccess,
    removeMember,
  } = useAuthStore();

  const projects = useStore((state) => state.projects);
  const projectList = useMemo(() => Object.values(projects), [projects]);

  const perms = usePermissions();

  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'matrix' | 'activity'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // RBAC Matrix customization state
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, { admin: boolean; developer: boolean; viewer: boolean }>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [matrixFeedback, setMatrixFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Member role & project access edit state & feedback
  const [memberRoleUpdating, setMemberRoleUpdating] = useState<string | null>(null);
  const [roleFeedback, setRoleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [roleModalMember, setRoleModalMember] = useState<{
    id: string;
    name: string;
    role: WorkspaceRole;
    projectAccess?: 'all' | 'custom';
    allowedProjects?: string[];
  } | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<WorkspaceRole>('developer');
  const [selectedProjectAccess, setSelectedProjectAccess] = useState<'all' | 'custom'>('all');
  const [selectedAllowedProjects, setSelectedAllowedProjects] = useState<string[]>([]);

  // Audit log filter & export state
  const [auditSeverity, setAuditSeverity] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [isExportingCSV, setIsExportingCSV] = useState<boolean>(false);

  // Pagination & Search state
  const ITEMS_PER_PAGE = 10;
  const [membersPage, setMembersPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [inviteProjectSearch, setInviteProjectSearch] = useState('');


  // New Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('developer');
  const [inviteProjectAccess, setInviteProjectAccess] = useState<'all' | 'custom'>('all');
  const [inviteAllowedProjects, setInviteAllowedProjects] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Removing member confirmation state
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchMembers();
    if (perms.canInviteMembers) {
      fetchInvites();
    }
    fetchRBACPermissions();
  }, [perms.canInviteMembers]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivity({ severity: auditSeverity, search: auditSearch });
    }
  }, [activeTab, auditSeverity, auditSearch]);

  const effectiveCapabilities = useMemo(() => {
    return RBAC_CAPABILITIES.map((feat) => {
      if (customPermissions && customPermissions[feat.id]) {
        return {
          ...feat,
          admin: customPermissions[feat.id].admin ?? feat.admin,
          developer: customPermissions[feat.id].developer ?? feat.developer,
          viewer: customPermissions[feat.id].viewer ?? feat.viewer,
        };
      }
      return feat;
    });
  }, [customPermissions]);

  const handleStartEditMatrix = () => {
    const draft: Record<string, { admin: boolean; developer: boolean; viewer: boolean }> = {};
    effectiveCapabilities.forEach((feat) => {
      draft[feat.id] = {
        admin: feat.admin,
        developer: feat.developer,
        viewer: feat.viewer,
      };
    });
    setMatrixDraft(draft);
    setIsEditingMatrix(true);
    setMatrixFeedback(null);
  };

  const handleTogglePermission = (capId: string, rRole: 'admin' | 'developer' | 'viewer') => {
    setMatrixDraft((prev) => {
      const current = prev[capId] || { admin: false, developer: false, viewer: false };
      return {
        ...prev,
        [capId]: {
          ...current,
          [rRole]: !current[rRole],
        },
      };
    });
  };

  const handleSaveMatrix = async () => {
    setIsSavingMatrix(true);
    setMatrixFeedback(null);
    try {
      await updateRBACPermissions(matrixDraft);
      setIsEditingMatrix(false);
      setMatrixFeedback({ type: 'success', message: 'RBAC permissions matrix successfully updated and broadcast across workspace.' });
      setTimeout(() => setMatrixFeedback(null), 5000);
    } catch (err: any) {
      setMatrixFeedback({ type: 'error', message: err.message || 'Failed to save RBAC permissions.' });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleResetMatrix = async () => {
    setIsSavingMatrix(true);
    setMatrixFeedback(null);
    try {
      await resetRBACPermissions();
      setIsEditingMatrix(false);
      setMatrixFeedback({ type: 'success', message: 'RBAC permissions matrix successfully reset to SOC 2 defaults.' });
      setTimeout(() => setMatrixFeedback(null), 5000);
    } catch (err: any) {
      setMatrixFeedback({ type: 'error', message: err.message || 'Failed to reset RBAC permissions.' });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleMemberRoleUpdate = async (memberId: string, newRole: WorkspaceRole, memberName: string) => {
    setMemberRoleUpdating(memberId);
    setRoleFeedback(null);
    try {
      await updateMemberAccess(memberId, { role: newRole });
      setRoleFeedback({
        type: 'success',
        message: `Successfully changed role of ${memberName} to ${ROLE_CONFIG[newRole].label}.`,
      });
      setTimeout(() => setRoleFeedback(null), 4000);
      setRoleModalMember(null);
    } catch (err: any) {
      setRoleFeedback({
        type: 'error',
        message: err.message || 'Failed to update member role.',
      });
    } finally {
      setMemberRoleUpdating(null);
    }
  };

  const handleMemberAccessSave = async () => {
    if (!roleModalMember) return;
    setMemberRoleUpdating(roleModalMember.id);
    setRoleFeedback(null);
    try {
      const isOwner = selectedNewRole === 'owner';
      await updateMemberAccess(roleModalMember.id, {
        role: selectedNewRole,
        projectAccess: isOwner ? 'all' : selectedProjectAccess,
        allowedProjects: isOwner ? [] : (selectedProjectAccess === 'custom' ? selectedAllowedProjects : []),
      });
      setRoleFeedback({
        type: 'success',
        message: `Successfully updated role and project scope for ${roleModalMember.name}.`,
      });
      setTimeout(() => setRoleFeedback(null), 4000);
      setRoleModalMember(null);
    } catch (err: any) {
      setRoleFeedback({
        type: 'error',
        message: err.message || 'Failed to update member permissions.',
      });
    } finally {
      setMemberRoleUpdating(null);
    }
  };

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      await exportActivityCSV({ severity: auditSeverity, search: auditSearch });
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setIsInviting(true);
    try {
      const link = await inviteMember(
        inviteEmail, 
        inviteRole, 
        inviteRole === 'owner' ? 'all' : inviteProjectAccess, 
        inviteRole === 'owner' ? [] : (inviteProjectAccess === 'custom' ? inviteAllowedProjects : [])
      );
      setGeneratedLink(link);
      setInviteEmail('');
      setInviteProjectAccess('all');
      setInviteAllowedProjects([]);
      fetchInvites();
      fetchActivity();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to generate invitation link');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = async (textToCopy: string) => {
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation? The recipient will not be able to join.')) return;
    try {
      await revokeInvite(inviteId);
      fetchActivity();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invite');
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    try {
      await removeMember(memberToDelete.id);
      setMemberToDelete(null);
      fetchActivity();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        (m.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  // Role distribution summary
  const roleCounts = useMemo(() => {
    const counts = { owner: 0, admin: 0, developer: 0, viewer: 0 };
    members.forEach((m) => {
      if (counts[m.role as WorkspaceRole] !== undefined) {
        counts[m.role as WorkspaceRole]++;
      }
    });
    return counts;
  }, [members]);

  const onlineCount = Object.keys(onlineUsers).length;
  const totalMembersPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const paginatedMembers = filteredMembers.slice((membersPage - 1) * ITEMS_PER_PAGE, membersPage * ITEMS_PER_PAGE);
  const totalAuditPages = Math.ceil(activityLogs.length / ITEMS_PER_PAGE);
  const paginatedAudit = activityLogs.slice((auditPage - 1) * ITEMS_PER_PAGE, auditPage * ITEMS_PER_PAGE);
  const filteredInviteProjects = projectList.filter(p => p.name.toLowerCase().includes(inviteProjectSearch.toLowerCase()));


  return (
    <div className="w-full h-full flex flex-col overflow-y-auto bg-slate-50 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Header & Breadcrumb Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('3D_OFFICE')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs font-medium transition cursor-pointer shadow-sm group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Command Center</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>AgentForge</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">{workspace?.name || 'Workspace'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-600 dark:text-blue-400 font-medium">Team & RBAC</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchMembers();
              if (perms.canInviteMembers) fetchInvites();
              fetchActivity();
            }}
            title="Refresh Directory"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {perms.canInviteMembers && (
            <button
              onClick={() => setActiveTab('invites')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Teammate</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6 flex-1">
        {/* Workspace Title & Hero Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Team & Access Control
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                    Enterprise RBAC
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage digital team access, role assignments, invitations, and autonomous governance policies.
                </p>
              </div>
              {totalMembersPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                  <span className="text-xs text-slate-500">Showing {((membersPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(membersPage * ITEMS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length} members</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMembersPage(p => Math.max(1, p - 1))} disabled={membersPage === 1} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Prev</button>
                    <span className="text-xs text-slate-700 dark:text-slate-300">Page {membersPage} of {totalMembersPages}</span>
                    <button onClick={() => setMembersPage(p => Math.min(totalMembersPages, p + 1))} disabled={membersPage === totalMembersPages} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{onlineCount > 0 ? onlineCount : 1} Active Online</span>
            <span className="text-slate-400">· Real-time Presence</span>
          </div>
        </div>

        {/* Telemetry Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Members */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Members</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{members.length}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Assigned to {workspace?.name}</p>
            </div>
          </div>

          {/* Card 2: Pending Invites */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Invites</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{invites.length}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">72-hour single-use token links</p>
            </div>
          </div>

          {/* Card 3: Security & Access */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Security Engine</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                Invite-Only Access
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">HS256 JWT + SameSite Cookie</p>
            </div>
          </div>

          {/* Card 4: Role Breakdown */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Role Distribution</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
                {roleCounts.owner} Owner
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400">
                {roleCounts.admin} Admin
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                {roleCounts.developer} Dev
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {roleCounts.viewer} Viewer
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'members'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Directory</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {members.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('invites')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'invites'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Pending Invites</span>
              {invites.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  {invites.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'matrix'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>RBAC Permissions Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Security Audit Log</span>
            </button>
          </div>
        </div>

        {/* TAB 1: MEMBERS DIRECTORY */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Role Update Feedback Alert */}
            {roleFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-sm ${
                  roleFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {roleFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  )}
                  <span>{roleFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Read-Only Notice for Non-Admins */}
            {!perms.canChangeRoles && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2.5">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  Signed in as <strong className="text-slate-800 dark:text-slate-200">{ROLE_CONFIG[perms.role || 'viewer']?.label || perms.role}</strong>. Modifying team roles and access levels requires Admin or Owner privileges.
                </span>
              </div>
            )}

            {/* Search & Role Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search team member by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] text-slate-500 font-medium mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filter:
                </span>
                {['ALL', 'owner', 'admin', 'developer', 'viewer'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer whitespace-nowrap ${
                      roleFilter === r
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {r === 'ALL' ? 'All Roles' : r}
                  </button>
                ))}
              </div>
            </div>

            {/* Members Table / List */}
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredMembers.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    No members match your search criteria.
                  </div>
                ) : (
                  paginatedMembers.map((m) => {
                    const cfg = ROLE_CONFIG[m.role as WorkspaceRole] || ROLE_CONFIG.viewer;
                    const isSelf = m.userId === user?.id;
                    const isOnline = Boolean(onlineUsers[m.userId]);
                    const isUpdating = memberRoleUpdating === m.id;
                    // Owner can modify non-self members, Admin can modify non-owner, non-self members
                    const canEditThisMember =
                      perms.canChangeRoles &&
                      !isSelf &&
                      (perms.isOwner || m.role !== 'owner');

                    return (
                      <div
                        key={m.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                      >
                        {/* Avatar & User Details */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                getInitials(m.userName || m.userId)
                              )}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-400'
                              }`}
                              title={isOnline ? 'Online now' : 'Offline'}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {m.userName || 'Teammate'}
                              </span>
                              {isSelf && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="truncate">{m.userEmail}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" /> Joined {timeAgo(m.joinedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Role Badge & Controls */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center flex-wrap">
                          {/* Role Badge Display */}
                          <div
                            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${cfg.bgLight} ${cfg.bgDark}`}
                          >
                            {cfg.icon}
                            <span>{cfg.label}</span>
                          </div>

                          {/* Project Scope Badge */}
                          {m.role === 'owner' ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-medium">
                              <FolderGit2 className="w-3 h-3 text-amber-500" />
                              <span>All Projects</span>
                            </span>
                          ) : m.projectAccess === 'custom' ? (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 font-medium"
                              title={
                                m.allowedProjects && m.allowedProjects.length > 0
                                  ? `Permitted: ${m.allowedProjects.map((pid) => projects[pid]?.name || pid).join(', ')}`
                                  : 'No projects permitted'
                              }
                            >
                              <FolderGit2 className="w-3 h-3 text-indigo-500" />
                              <span>{m.allowedProjects?.length || 0} Project{m.allowedProjects?.length === 1 ? '' : 's'}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-medium">
                              <FolderGit2 className="w-3 h-3 text-slate-400" />
                              <span>All Projects</span>
                            </span>
                          )}

                          {/* Protected Owner Badge for non-owners */}
                          {!perms.isOwner && m.role === 'owner' && !isSelf && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1 font-medium">
                              <Lock className="w-2.5 h-2.5" /> Owner Protected
                            </span>
                          )}

                          {/* Quick Role Selection Dropdown */}
                          {canEditThisMember && (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={m.role}
                                disabled={isUpdating}
                                onChange={(e) =>
                                  handleMemberRoleUpdate(
                                    m.id,
                                    e.target.value as WorkspaceRole,
                                    m.userName || m.userEmail || 'Member'
                                  )
                                }
                                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer font-medium disabled:opacity-50"
                              >
                                {perms.isOwner && <option value="owner">👑 Owner</option>}
                                <option value="admin">🛡️ Admin</option>
                                <option value="developer">💻 Developer</option>
                                <option value="viewer">👁️ Viewer</option>
                              </select>

                              {/* Edit Role & Access Modal Trigger */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRoleModalMember({
                                    id: m.id,
                                    name: m.userName || m.userEmail || 'Member',
                                    role: m.role as WorkspaceRole,
                                    projectAccess: m.projectAccess || 'all',
                                    allowedProjects: m.allowedProjects || [],
                                  });
                                  setSelectedNewRole(m.role as WorkspaceRole);
                                  setSelectedProjectAccess(m.projectAccess || 'all');
                                  setSelectedAllowedProjects(m.allowedProjects || []);
                                }}
                                disabled={isUpdating}
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                                title="Open Role & Project Access Configuration Modal"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {isUpdating && (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          )}

                          {/* Delete Member Button (Only Owner) */}
                          {perms.canRemoveMember && !isSelf && m.role !== 'owner' && (
                            <button
                              onClick={() => setMemberToDelete({ id: m.id, name: m.userName || m.userEmail || 'Member' })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                              title="Remove from Workspace"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {totalMembersPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                  <span className="text-xs text-slate-500">Showing {((membersPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(membersPage * ITEMS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length} members</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMembersPage(p => Math.max(1, p - 1))} disabled={membersPage === 1} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Prev</button>
                    <span className="text-xs text-slate-700 dark:text-slate-300">Page {membersPage} of {totalMembersPages}</span>
                    <button onClick={() => setMembersPage(p => Math.min(totalMembersPages, p + 1))} disabled={membersPage === totalMembersPages} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PENDING INVITES */}
        {activeTab === 'invites' && (
          <div className="space-y-6">
            {/* Invite Generator Box */}
            {perms.canInviteMembers && (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Invite a New Team Member
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Generates a secure, cryptographically signed 72-hour invitation link for your teammate.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateInvite} className="flex flex-col gap-3 pt-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="engineer@company.com"
                        required
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                      className="bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer font-medium"
                    >
                      <option value="admin">Admin (Can manage members & approve)</option>
                      <option value="developer">Developer (Can instruct agents & run tasks)</option>
                      <option value="viewer">Viewer (Read-only observation)</option>
                    </select>
                  </div>
                  
                  {inviteRole !== 'owner' && (
                    <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Project Access Scope
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="radio" checked={inviteProjectAccess === 'all'} onChange={() => setInviteProjectAccess('all')} className="cursor-pointer" />
                          All Projects
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="radio" checked={inviteProjectAccess === 'custom'} onChange={() => setInviteProjectAccess('custom')} className="cursor-pointer" />
                          Specific Projects
                        </label>
                      </div>
                      {inviteProjectAccess === 'custom' && (
                        <div className="mt-2">
                          <div className="relative mb-2">
                            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={inviteProjectSearch}
                              onChange={(e) => setInviteProjectSearch(e.target.value)}
                              placeholder="Search projects..."
                              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {filteredInviteProjects.map(p => (
                              <label key={p.id} className="flex items-center gap-2 text-[11px] p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <input 
                                  type="checkbox" 
                                  checked={inviteAllowedProjects.includes(p.id)} 
                                  onChange={(e) => {
                                    if (e.target.checked) setInviteAllowedProjects([...inviteAllowedProjects, p.id]);
                                    else setInviteAllowedProjects(inviteAllowedProjects.filter(id => id !== p.id));
                                  }}
                                />
                                {p.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isInviting || (inviteProjectAccess === 'custom' && inviteAllowedProjects.length === 0)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isInviting ? 'Generating...' : 'Generate Invite Link'}</span>
                  </button>
                </form>


                {inviteError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {/* Generated Invite Link Banner */}
                {generatedLink && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Invite Link Generated Successfully
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-500">Valid for 72 hours</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/60 rounded-lg p-2">
                      <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-300 truncate select-all">
                        {generatedLink}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(generatedLink)}
                        className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pending Invites List */}
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Active Pending Invitations
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tokens expire automatically after 72 hours if not accepted.
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">{invites.length} pending</span>
              </div>

              {invites.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No pending invitations currently active.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {invites.map((inv) => {
                    const cfg = ROLE_CONFIG[inv.role as WorkspaceRole] || ROLE_CONFIG.viewer;
                    const fullInviteLink = `${window.location.origin}/invite/${inv.token}`;

                    return (
                      <div
                        key={inv.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <Clock className="w-5 h-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {inv.email}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bgLight} ${cfg.bgDark}`}
                              >
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>Sent {timeAgo(inv.createdAt)}</span>
                              <span>·</span>
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Expires {timeAgo(inv.expiresAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => handleCopyLink(fullInviteLink)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Link</span>
                          </button>

                          {perms.canInviteMembers && (
                            <button
                              onClick={() => handleRevokeInvite(inv.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-medium transition cursor-pointer"
                              title="Revoke and cancel invite"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RBAC PERMISSIONS MATRIX */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            {/* Roles Legend Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(ROLE_CONFIG).map(([k, cfg]) => (
                <div
                  key={k}
                  className={`p-4 rounded-xl border ${cfg.bgLight} ${cfg.bgDark} flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-sm mb-1">
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>
                    <p className="text-[11px] opacity-80 leading-relaxed">{cfg.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Matrix Update Feedback Alert */}
            {matrixFeedback && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-sm ${
                  matrixFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {matrixFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  )}
                  <span>{matrixFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMatrixFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Matrix Table */}
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    AgentForge Role-Based Access Control Matrix
                    {isEditingMatrix && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                        Editing Mode
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEditingMatrix
                      ? 'Toggle permissions for Admin, Developer, and Viewer roles. Root Owner capabilities are locked for SOC 2 compliance.'
                      : 'Defines strict governance boundaries for autonomous digital engineers and human operators.'}
                  </p>
                </div>

                {perms.canChangeRoles && (
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditingMatrix ? (
                      <>
                        <button
                          type="button"
                          onClick={handleStartEditMatrix}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Customize Permissions</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetMatrix}
                          disabled={isSavingMatrix}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                          title="Reset to SOC 2 defaults"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                          <span>Reset Defaults</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveMatrix}
                          disabled={isSavingMatrix}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                          {isSavingMatrix ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>{isSavingMatrix ? 'Saving Changes...' : 'Save Matrix'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingMatrix(false)}
                          disabled={isSavingMatrix}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleResetMatrix}
                          disabled={isSavingMatrix}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Defaults</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3.5 px-6">Capability / Scope</th>
                      <th className="py-3.5 px-6 text-center text-amber-600 dark:text-amber-400">Owner</th>
                      <th className="py-3.5 px-6 text-center text-blue-600 dark:text-blue-400">Admin</th>
                      <th className="py-3.5 px-6 text-center text-emerald-600 dark:text-emerald-400">Developer</th>
                      <th className="py-3.5 px-6 text-center text-slate-600 dark:text-slate-400">Viewer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {effectiveCapabilities.map((feat) => (
                      <tr
                        key={feat.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                      >
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{feat.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="font-medium text-slate-400">{feat.category}</span> · {feat.description}
                          </div>
                        </td>

                        {/* Owner check: Always locked/root */}
                        <td className="py-3.5 px-6 text-center">
                          <div
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
                            title="Root administrative control cannot be revoked"
                          >
                            <Check className="w-3 h-3 text-amber-500" />
                            <span>Root</span>
                          </div>
                        </td>

                        {/* Admin, Developer, Viewer columns */}
                        {(['admin', 'developer', 'viewer'] as const).map((rRole) => {
                          if (isEditingMatrix) {
                            const isAllowed = matrixDraft[feat.id]?.[rRole] ?? feat[rRole];
                            return (
                              <td key={rRole} className="py-3.5 px-6 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePermission(feat.id, rRole)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer select-none ${
                                    isAllowed
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                  title={`Click to ${isAllowed ? 'deny' : 'grant'} ${feat.name} for ${rRole}`}
                                >
                                  {isAllowed ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span>{isAllowed ? 'Allowed' : 'Denied'}</span>
                                </button>
                              </td>
                            );
                          }

                          const isAllowed = feat[rRole];
                          return (
                            <td key={rRole} className="py-3.5 px-6 text-center">
                              {isAllowed ? (
                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                                  <XCircle className="w-4 h-4" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalMembersPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                  <span className="text-xs text-slate-500">Showing {((membersPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(membersPage * ITEMS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length} members</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMembersPage(p => Math.max(1, p - 1))} disabled={membersPage === 1} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Prev</button>
                    <span className="text-xs text-slate-700 dark:text-slate-300">Page {membersPage} of {totalMembersPages}</span>
                    <button onClick={() => setMembersPage(p => Math.min(totalMembersPages, p + 1))} disabled={membersPage === totalMembersPages} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY AUDIT LOG */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Security & Compliance Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Immutable enterprise audit log for SOC 2 Type II & ISO 27001 tracking authentication, IAM, cluster operations, and secrets access.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleExportCSV}
                    disabled={isExportingCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700/60 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    <span>{isExportingCSV ? 'Exporting...' : 'Export CSV Report'}</span>
                  </button>
                  <button
                    onClick={() => fetchActivity({ severity: auditSeverity, search: auditSearch })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filters Bar: Severity pills & search */}
              <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                  <span className="text-[11px] font-medium text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Severity:
                  </span>
                  {(['ALL', 'SECURITY', 'CRITICAL', 'WARN', 'INFO'] as const).map((sev) => {
                    const isActive = auditSeverity === sev;
                    return (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setAuditSeverity(sev)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                          isActive
                            ? sev === 'SECURITY' || sev === 'CRITICAL'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : sev === 'WARN'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {sev === 'ALL' ? 'All Events' : sev}
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search actor, action, IP..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {activityLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <p>No audit events match the selected criteria.</p>
                  {(auditSeverity !== 'ALL' || auditSearch) && (
                    <button
                      onClick={() => { setAuditSeverity('ALL'); setAuditSearch(''); }}
                      className="mt-2 text-blue-500 hover:underline text-xs cursor-pointer"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedAudit.map((log) => {
                    const isSecurity = log.severity === 'SECURITY' || log.severity === 'CRITICAL';
                    const isWarn = log.severity === 'WARN';
                    const isFailure = log.status === 'FAILURE';

                    return (
                      <div
                        key={log.id}
                        className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition text-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isSecurity
                                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : isWarn
                                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isSecurity ? (
                              <Shield className="w-4 h-4" />
                            ) : isWarn ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : (
                              <Activity className="w-4 h-4" />
                            )}
                          </div>

                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap font-medium text-slate-900 dark:text-slate-100">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {log.userName || 'System'}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {log.action}
                              </span>

                              {/* Severity Badge */}
                              <span
                                className={`text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${
                                  isSecurity
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                                    : isWarn
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50'
                                }`}
                              >
                                {log.severity || 'INFO'}
                              </span>

                              {/* Status Badge */}
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  isFailure
                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                }`}
                              >
                                {log.status || 'SUCCESS'}
                              </span>
                            </div>

                            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed break-words">
                              {log.detail}
                            </p>

                            {/* Client telemetry chips: IP & User Agent */}
                            {(log.ipAddress || log.userAgent) && (
                              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                {log.ipAddress && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                                    <Globe className="w-2.5 h-2.5" />
                                    {log.ipAddress}
                                  </span>
                                )}
                                {log.userAgent && (
                                  <span
                                    title={log.userAgent}
                                    className="text-[10px] text-slate-400 max-w-xs truncate"
                                  >
                                    {log.userAgent}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <span
                          title={new Date(log.createdAt).toUTCString()}
                          className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap pt-1"
                        >
                          {timeAgo(log.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {totalAuditPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
                  <span className="text-xs text-slate-500">Showing {((auditPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(auditPage * ITEMS_PER_PAGE, activityLogs.length)} of {activityLogs.length} events</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage === 1} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Prev</button>
                    <span className="text-xs text-slate-700 dark:text-slate-300">Page {auditPage} of {totalAuditPages}</span>
                    <button onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))} disabled={auditPage === totalAuditPages} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      {/* Remove Member Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Remove Member</h3>
                <p className="text-xs text-slate-500">Revoke workspace membership</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{memberToDelete.name}</strong> from this workspace? They will lose access to all projects, agent tasks, and telemetry immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmRemoveMember}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role & Access Modal */}
      {roleModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Configure Member Access</h3>
                  <p className="text-xs text-slate-500">Update role permissions and project scope for {roleModalMember.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalMember(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Section 1: Role Assignment */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                1. Select Role Assignment:
              </label>

              <div className="space-y-2">
                {(['owner', 'admin', 'developer', 'viewer'] as WorkspaceRole[]).map((r) => {
                  if (r === 'owner' && !perms.isOwner) return null;
                  const cfg = ROLE_CONFIG[r];
                  const isSelected = selectedNewRole === r;

                  return (
                    <div
                      key={r}
                      onClick={() => setSelectedNewRole(r)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="memberRole"
                        value={r}
                        checked={isSelected}
                        onChange={() => setSelectedNewRole(r)}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${cfg.color}`}>
                            {cfg.icon}
                            <span>{cfg.label}</span>
                          </span>
                          {r === 'owner' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-semibold">
                              Co-Owner / Transfer
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {cfg.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Project Access Scope */}
            {selectedNewRole === 'owner' ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
                <Crown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Workspace Owners retain unrestricted project access.</span>
                  <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                    Owners have root governance across all current and future projects in the workspace.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    2. Project Access Scope:
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {selectedProjectAccess === 'all'
                      ? 'Unrestricted'
                      : `${selectedAllowedProjects.length} of ${projectList.length} selected`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    onClick={() => setSelectedProjectAccess('all')}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                      selectedProjectAccess === 'all'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="projectAccess"
                      value="all"
                      checked={selectedProjectAccess === 'all'}
                      onChange={() => setSelectedProjectAccess('all')}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span>All Projects</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Access to all current and future projects in workspace
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedProjectAccess('custom')}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                      selectedProjectAccess === 'custom'
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="projectAccess"
                      value="custom"
                      checked={selectedProjectAccess === 'custom'}
                      onChange={() => setSelectedProjectAccess('custom')}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Restricted</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Restrict access strictly to selected projects
                      </p>
                    </div>
                  </div>
                </div>

                {selectedProjectAccess === 'custom' && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Permitted Projects:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAllowedProjects(projectList.map((p) => p.id))}
                          className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 dark:text-slate-700 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAllowedProjects([])}
                          className="text-[10px] font-medium text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {projectList.length === 0 ? (
                      <div className="py-3 text-center text-xs text-slate-400">
                        No projects exist in workspace yet.
                      </div>
                    ) : (
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                        {projectList.map((p) => {
                          const isChecked = selectedAllowedProjects.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedAllowedProjects((prev) =>
                                  isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                );
                              }}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                                isChecked
                                  ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-medium truncate">{p.name || p.id}</span>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono shrink-0">
                                {p.id.slice(0, 8)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRoleModalMember(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={memberRoleUpdating === roleModalMember.id}
                onClick={handleMemberAccessSave}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                {memberRoleUpdating === roleModalMember.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Access Settings</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
