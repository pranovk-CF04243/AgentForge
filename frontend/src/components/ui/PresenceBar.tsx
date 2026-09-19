import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';

interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl?: string;
  role: string;
  projectId?: string;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function roleColor(role: string): string {
  switch (role) {
    case 'owner': return 'bg-amber-500';
    case 'admin': return 'bg-blue-500';
    case 'developer': return 'bg-emerald-500';
    default: return 'bg-slate-500';
  }
}

export const PresenceBar: React.FC = () => {
  const { user } = useAuthStore();
  const projects = useStore(s => s.projects);
  
  // Get online users from store (populated by PRESENCE_UPDATE WS events)
  const onlineUsers = (useStore as any)(s => s.onlineUsers as PresenceUser[] | undefined) || [];

  if (onlineUsers.length === 0 && !user) return null;

  // Always include self (current user)
  const selfPresence: PresenceUser[] = user ? [{
    userId: user.id,
    userName: user.name,
    avatarUrl: user.avatarUrl,
    role: useAuthStore.getState().role || 'viewer',
    projectId: useStore.getState().selectedProjectId,
  }] : [];

  const allUsers = [
    ...selfPresence,
    ...onlineUsers.filter(u => u.userId !== user?.id),
  ];

  if (allUsers.length === 0) return null;

  return (
    <div className="h-8 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0d1017]/50 px-4 flex items-center gap-3 select-none">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-600 uppercase tracking-wider shrink-0">
        Online
      </span>
      <div className="flex items-center gap-1.5">
        {allUsers.map((u, i) => {
          const projectName = u.projectId ? projects[u.projectId]?.name : undefined;
          const isSelf = u.userId === user?.id;
          return (
            <div key={u.userId} className="relative group" title={`${u.userName} — ${projectName ? `viewing ${projectName}` : 'online'} · ${u.role}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${roleColor(u.role)} ${isSelf ? 'ring-1 ring-white/40 ring-offset-1 ring-offset-transparent' : ''}`}>
                {getInitials(u.userName)}
              </div>
              {/* Pulse dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-slate-900" />
              {/* Tooltip */}
              <div className="absolute left-0 top-7 z-50 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                <div className="font-semibold">{u.userName}{isSelf ? ' (you)' : ''}</div>
                <div className="text-slate-400 text-[10px] capitalize">{u.role}{projectName ? ` · ${projectName}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800/40" />
    </div>
  );
};
