import React, { useEffect, useState } from 'react';
import { X, UserPlus, Copy, CheckCircle2, Clock, Trash2, Shield, Loader2, AlertCircle, Crown, Code2, Eye } from 'lucide-react';
import { useAuthStore, WorkspaceRole } from '../../store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  owner:     { label: 'Owner',     color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',    icon: <Crown className="w-3 h-3" />,   desc: 'Full access, can delete workspace' },
  admin:     { label: 'Admin',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',       icon: <Shield className="w-3 h-3" />,  desc: 'Manage members, approve tasks' },
  developer: { label: 'Developer', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <Code2 className="w-3 h-3" />, desc: 'Create & run tasks, instruct agents' },
  viewer:    { label: 'Viewer',    color: 'text-slate-400 bg-slate-500/10 border-slate-500/30',    icon: <Eye className="w-3 h-3" />,    desc: 'Read-only access' },
};

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const TeamManagementModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, workspace, members, invites, fetchMembers, fetchInvites, inviteMember, changeMemberRole, removeMember } = useAuthStore();
  const perms = usePermissions();
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('developer');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    fetchMembers();
    if (perms.canInviteMembers) fetchInvites();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setIsInviting(true);
    try {
      const link = await inviteMember(inviteEmail, inviteRole);
      setInviteLink(link);
      setInviteEmail('');
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create invite');
    } finally {
      setIsInviting(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-100 text-base">Team Management</h2>
            <p className="text-xs text-slate-500">{workspace?.name} · {members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6">
          {(['members', 'invites'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-xs font-medium capitalize border-b-2 mr-6 transition cursor-pointer ${
                tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t} {t === 'invites' && invites.length > 0 && `(${invites.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === 'members' && (
            <>
              {/* Invite form */}
              {perms.canInviteMembers && (
                <form onSubmit={handleInvite} className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" /> Invite New Member</h3>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      required
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isInviting}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Send Invite
                    </button>
                  </div>
                  {inviteError && (
                    <div className="flex items-center gap-2 text-rose-400 text-xs"><AlertCircle className="w-3 h-3" />{inviteError}</div>
                  )}
                  {inviteLink && (
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                      <span className="flex-1 text-xs text-slate-400 truncate font-mono">{inviteLink}</span>
                      <button
                        type="button"
                        onClick={copyLink}
                        className="text-slate-400 hover:text-slate-200 transition cursor-pointer shrink-0"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* Members list */}
              <div className="space-y-2">
                {members.map(m => {
                  const cfg = ROLE_CONFIG[m.role as WorkspaceRole] || ROLE_CONFIG.viewer;
                  const isSelf = m.userId === user?.id;
                  return (
                    <div key={m.id} className="flex items-center gap-3 bg-slate-800/30 border border-slate-800/60 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                        {m.avatarUrl
                          ? <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : getInitials(m.userName || m.userId)
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">{m.userName}{isSelf ? ' (you)' : ''}</div>
                        <div className="text-xs text-slate-500 truncate">{m.userEmail}</div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </div>
                      {perms.canChangeRoles && !isSelf && m.role !== 'owner' && (
                        <select
                          value={m.role}
                          onChange={e => changeMemberRole(m.id, e.target.value as WorkspaceRole)}
                          className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="admin">Admin</option>
                          <option value="developer">Developer</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                      {perms.canRemoveMember && !isSelf && m.role !== 'owner' && (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="text-slate-600 hover:text-rose-400 transition cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'invites' && (
            <div className="space-y-2">
              {invites.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-sm">No pending invites</div>
              )}
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 bg-slate-800/30 border border-slate-800/60 rounded-xl px-4 py-3">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">{inv.email}</div>
                    <div className="text-xs text-slate-500">Expires {timeAgo(inv.expiresAt)}</div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border ${ROLE_CONFIG[inv.role as WorkspaceRole]?.color || ''}`}>
                    {ROLE_CONFIG[inv.role as WorkspaceRole]?.label || inv.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role legend */}
        <div className="px-6 py-3 border-t border-slate-800">
          <div className="flex flex-wrap gap-3">
            {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                {cfg.icon}
                <span className="font-medium text-slate-400">{cfg.label}:</span>
                {cfg.desc}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
