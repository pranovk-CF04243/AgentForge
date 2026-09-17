import { create } from 'zustand';

export type AgentLevel = 'Junior' | 'Mid' | 'Senior' | 'Principal' | 'Legend';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: string;
}

interface GamificationState {
  agentXP: Record<string, number>;
  agentLevels: Record<string, AgentLevel>;
  achievements: Achievement[];
  recentToasts: Achievement[];
  teamVelocity: number; // tasks/hr
  addXP: (agentId: string, amount: number) => void;
  triggerAchievement: (title: string, description: string, icon: string) => void;
  dismissToast: (id: string) => void;
}

const LEVEL_THRESHOLDS: { level: AgentLevel; xp: number }[] = [
  { level: 'Legend', xp: 500 },
  { level: 'Principal', xp: 250 },
  { level: 'Senior', xp: 100 },
  { level: 'Mid', xp: 40 },
  { level: 'Junior', xp: 0 },
];

function getLevelForXP(xp: number): AgentLevel {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.xp) return threshold.level;
  }
  return 'Junior';
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  agentXP: {
    'agent-pm': 140,
    'agent-arch': 190,
    'agent-backend': 120,
    'agent-frontend': 110,
    'agent-mobile': 85,
    'agent-qa': 95,
    'agent-reviewer': 160,
    'agent-db': 130,
    'agent-data': 105,
    'agent-devops': 115,
    'agent-sre': 145,
    'agent-sec': 125,
    'agent-doc': 70,
    'agent-research': 90,
  },
  agentLevels: {
    'agent-pm': 'Senior',
    'agent-arch': 'Senior',
    'agent-backend': 'Senior',
    'agent-frontend': 'Senior',
    'agent-mobile': 'Mid',
    'agent-qa': 'Mid',
    'agent-reviewer': 'Senior',
    'agent-db': 'Senior',
    'agent-data': 'Senior',
    'agent-devops': 'Senior',
    'agent-sre': 'Senior',
    'agent-sec': 'Senior',
    'agent-doc': 'Mid',
    'agent-research': 'Mid',
  },
  achievements: [
    {
      id: 'ach-1',
      title: '🚀 Team Initialized',
      description: '14 Digital AI Engineers ready in the command bullpen.',
      icon: '🚀',
      timestamp: new Date().toLocaleTimeString(),
    },
  ],
  recentToasts: [],
  teamVelocity: 8.4,

  addXP: (agentId, amount) => {
    const current = get().agentXP[agentId] || 0;
    const newXP = Math.max(0, current + amount);
    const oldLevel = get().agentLevels[agentId] || 'Junior';
    const newLevel = getLevelForXP(newXP);

    set((state) => ({
      agentXP: { ...state.agentXP, [agentId]: newXP },
      agentLevels: { ...state.agentLevels, [agentId]: newLevel },
    }));

    if (newLevel !== oldLevel) {
      get().triggerAchievement(
        `🎉 Level Up: ${newLevel}!`,
        `Agent upgraded to ${newLevel} AI Engineer tier.`,
        '⭐'
      );
    }
  },

  triggerAchievement: (title, description, icon) => {
    const ach: Achievement = {
      id: `ach-${Date.now()}-${Math.random()}`,
      title,
      description,
      icon,
      timestamp: new Date().toLocaleTimeString(),
    };
    set((state) => ({
      achievements: [ach, ...state.achievements.slice(0, 20)],
      recentToasts: [ach, ...state.recentToasts.slice(0, 4)],
    }));
  },

  dismissToast: (id) => {
    set((state) => ({
      recentToasts: state.recentToasts.filter((t) => t.id !== id),
    }));
  },
}));
