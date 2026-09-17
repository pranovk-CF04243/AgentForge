// Fixed 3D Coordinates for Compact Corporate Campus (20m x 16m)
// Conversational Boardroom & Collaborative Pods
export type AgentActivity = 'WORKING_DESK' | 'MEETING_DISCUSSING';

export interface SeatAssignment {
  pos: [number, number, number];
  rotY: number;
  activity: AgentActivity;
  isStanding?: boolean;
}

export const AGENT_MODERN_SEATS: Record<string, SeatAssignment> = {
  // ── 1. Executive Boardroom: Conversational Semi-Circle around Table ──────────
  // Elena Vance (Project Manager): Standing beside TV at North, facing team across table
  'agent-pm': {
    pos: [-4.0, 0, -3.8],
    rotY: 2.50, // Angled South-West directly facing conference table and team
    activity: 'MEETING_DISCUSSING',
    isStanding: true,
  },
  // Dr. Marcus Cole (Team Lead): Seated at South head of table, facing North straight into table & Elena
  'agent-arch': {
    pos: [-5.2, 0, -1.15],
    rotY: -0.20, // Facing North slightly angled toward Elena
    activity: 'MEETING_DISCUSSING',
  },
  // Orion Spark (Business Analyst): Seated on West flank of table, facing East into table & Elena
  'agent-research': {
    pos: [-6.95, 0, -2.2],
    rotY: -0.97, // Facing East & North-East across the table
    activity: 'MEETING_DISCUSSING',
  },
  // Seraphina Stone (Jira Agent): Seated on East flank of table, facing West into table & Elena
  'agent-doc': {
    pos: [-3.45, 0, -2.2],
    rotY: 0.97, // Facing West & North-West across the table
    activity: 'MEETING_DISCUSSING',
  },

  // ── 2. Pod 1: Engineering Bullpen (Right Wing North: z = -4.8) ────────────
  // Senior Developer (Kaelen Voss): Facing South (+Z) across pod
  'agent-backend': {
    pos: [4.6, 0, -5.75],
    rotY: Math.PI,
    activity: 'WORKING_DESK',
  },
  // Junior Developer Frontend (Aria Sterling): Facing North (-Z) opposite Senior Dev
  'agent-frontend': {
    pos: [4.6, 0, -3.65],
    rotY: 0,
    activity: 'WORKING_DESK',
  },
  // Junior Developer Full-Stack (Leo Chang): Flanking desk facing West (-X)
  'agent-mobile': {
    pos: [7.95, 0, -4.7],
    rotY: Math.PI / 2, // Facing West (-X) into desk and ultrawide monitor
    activity: 'WORKING_DESK',
  },

  // ── 3. Pod 2: QA & DevOps Bay (Right Wing Mid: z = 0.2) ───────────────────
  // QA Lead (Sasha Quinn): North side facing South (+Z)
  'agent-qa': {
    pos: [3.6, 0, -0.85],
    rotY: Math.PI,
    activity: 'WORKING_DESK',
  },
  // DevOps Lead (Caleb Cruz): North side facing South (+Z)
  'agent-devops': {
    pos: [6.4, 0, -0.85],
    rotY: Math.PI,
    activity: 'WORKING_DESK',
  },
  // Junior QA (Victor Thorne): South side facing North (-Z) opposite QA Lead
  'agent-reviewer': {
    pos: [3.6, 0, 1.25],
    rotY: 0,
    activity: 'WORKING_DESK',
  },
  // Cloud SRE (Jaxson Reed): South side facing North (-Z) opposite DevOps Lead
  'agent-sre': {
    pos: [6.4, 0, 1.25],
    rotY: 0,
    activity: 'WORKING_DESK',
  },

  // ── 4. Pod 3: Support & Project Analytics (Right Wing South: z = 5.2) ─────
  // Senior Support (Cipher Vance): North side facing South (+Z)
  'agent-sec': {
    pos: [4.0, 0, 4.15],
    rotY: Math.PI,
    activity: 'WORKING_DESK',
  },
  // Analytics Lead (Maya Lin): North side facing South (+Z)
  'agent-data': {
    pos: [6.8, 0, 4.15],
    rotY: Math.PI,
    activity: 'WORKING_DESK',
  },
  // Junior Support (Tariq Mansour): South side facing North (-Z) opposite Senior Support
  'agent-db': {
    pos: [4.0, 0, 6.25],
    rotY: 0,
    activity: 'WORKING_DESK',
  },
};

export const AGENT_HOME_SEATS = AGENT_MODERN_SEATS;
