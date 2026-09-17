import React, { useState, useEffect, useMemo } from 'react';
import { Agent } from '../../types';
import { useStore } from '../../store/useStore';
import { useGamificationStore } from '../../store/useGamificationStore';

export interface DeskPosition {
  x: number;
  y: number;
  zone: string;
  facing: 'down' | 'up' | 'left' | 'right';
  activity?: 'presenting' | 'gaming' | 'resting' | 'working' | 'meeting';
}

// ─── 1. BASE ASSIGNED POSITIONS (Workstations & Meeting Room) ──────────────────
export const AGENT_COORDINATES: Record<string, DeskPosition> = {
  // ── Leadership Pod (In Meeting Room by Default, facing PM and TV!) ──
  // PM stands in front of the TV facing DOWN towards the team
  'agent-pm': { x: 290, y: 175, zone: 'meeting_room', facing: 'down', activity: 'presenting' },
  // Team Lead / Architect seated at table, facing UP towards PM
  'agent-arch': { x: 290, y: 300, zone: 'meeting_room', facing: 'up', activity: 'meeting' },
  // Business Analyst seated at table, facing UP towards PM
  'agent-doc': { x: 210, y: 295, zone: 'meeting_room', facing: 'up', activity: 'meeting' },
  // Jira Agent seated at table, facing UP towards PM
  'agent-research': { x: 370, y: 295, zone: 'meeting_room', facing: 'up', activity: 'meeting' },

  // ── Engineering Bullpen (1 Senior Dev + 2 Junior Devs) ──
  'agent-backend': { x: 1477, y: 195, zone: 'engineering', facing: 'up', activity: 'working' },
  'agent-mobile': { x: 1290, y: 195, zone: 'engineering', facing: 'up', activity: 'working' },
  'agent-frontend': { x: 1667, y: 195, zone: 'engineering', facing: 'up', activity: 'working' },

  // ── QA Team (QA Lead + Junior QA) ──
  'agent-qa': { x: 755, y: 480, zone: 'qa', facing: 'up', activity: 'working' },
  'agent-reviewer': { x: 1010, y: 480, zone: 'qa', facing: 'up', activity: 'working' },

  // ── Infra, SRE & DevOps Team ──
  'agent-devops': { x: 1302, y: 480, zone: 'devops', facing: 'up', activity: 'working' },
  'agent-sre': { x: 1497, y: 480, zone: 'devops', facing: 'up', activity: 'working' },

  // ── Customer Support Team ──
  'agent-data': { x: 755, y: 745, zone: 'support', facing: 'up', activity: 'working' },
  'agent-db': { x: 1010, y: 745, zone: 'support', facing: 'up', activity: 'working' },

  // ── Project Analytics & Security ──
  'agent-sec': { x: 1345, y: 745, zone: 'analytics', facing: 'up', activity: 'working' },
};

// ─── 2. DESIGNATED BREAK & LOUNGE SPOTS (Gaming & Resting Areas) ───────────────
const LOUNGE_SPOTS: DeskPosition[] = [
  // Arcade Machine 1
  { x: 99, y: 505, zone: 'gaming', facing: 'up', activity: 'gaming' },
  // Arcade Machine 2
  { x: 179, y: 505, zone: 'gaming', facing: 'up', activity: 'gaming' },
  // Gaming Console Beanbag
  { x: 285, y: 525, zone: 'gaming', facing: 'up', activity: 'gaming' },
  // Foosball Player
  { x: 470, y: 505, zone: 'gaming', facing: 'left', activity: 'gaming' },
  // Recharge Sofa Left
  { x: 215, y: 735, zone: 'resting', facing: 'down', activity: 'resting' },
  // Recharge Sofa Right
  { x: 325, y: 735, zone: 'resting', facing: 'down', activity: 'resting' },
  // Water Dispenser Hydration Hub
  { x: 110, y: 735, zone: 'resting', facing: 'right', activity: 'resting' },
  // Espresso Bar Counter
  { x: 450, y: 735, zone: 'resting', facing: 'up', activity: 'resting' },
];

// ─── 3. MODERN REALISTIC HUMAN CHARACTER DNA ──────────────────────────────────
interface CharacterDNA {
  name: string;
  role: string;
  skin: string;
  hairColor: string;
  hairStyle: 'bun' | 'fade' | 'long-waves' | 'buzz' | 'parted' | 'afro' | 'ponytail';
  topColor: string;
  collarColor: string;
  pantsColor: string;
  shoeColor: string;
  hasGlasses?: boolean;
  hasHeadset?: boolean;
  hasWatch?: boolean;
}

const CHARACTER_DNA: Record<string, CharacterDNA> = {
  'agent-pm': {
    name: 'Alex Morgan',
    role: 'Project Manager',
    skin: '#f5cba7',
    hairColor: '#2c1810',
    hairStyle: 'bun',
    topColor: '#1e3a8a', // Executive navy blazer
    collarColor: '#ffffff',
    pantsColor: '#1e293b',
    shoeColor: '#0f172a',
    hasWatch: true,
  },
  'agent-arch': {
    name: 'Ryan Chen',
    role: 'Team Lead & Architect',
    skin: '#fcd34d',
    hairColor: '#18181b',
    hairStyle: 'parted',
    topColor: '#334155',
    collarColor: '#94a3b8',
    pantsColor: '#1e293b',
    shoeColor: '#111827',
    hasGlasses: true,
    hasWatch: true,
  },
  'agent-doc': {
    name: 'Zara Shaw',
    role: 'Business Analyst',
    skin: '#fbcfe8',
    hairColor: '#451a03',
    hairStyle: 'long-waves',
    topColor: '#0e7490',
    collarColor: '#cffafe',
    pantsColor: '#0f172a',
    shoeColor: '#000000',
    hasGlasses: true,
  },
  'agent-research': {
    name: 'Aria Bot',
    role: 'Jira Agent',
    skin: '#fde047',
    hairColor: '#3b82f6',
    hairStyle: 'ponytail',
    topColor: '#4338ca',
    collarColor: '#e0e7ff',
    pantsColor: '#1e1b4b',
    shoeColor: '#0284c7',
  },
  'agent-backend': {
    name: 'Kaelen Voss',
    role: 'Senior Developer',
    skin: '#f5d0a9',
    hairColor: '#1c1917',
    hairStyle: 'fade',
    topColor: '#15803d', // Forest green hoodie
    collarColor: '#86efac',
    pantsColor: '#18181b',
    shoeColor: '#ffffff',
    hasHeadset: true,
  },
  'agent-mobile': {
    name: 'Leo Chang',
    role: 'Junior Dev 1',
    skin: '#fed7aa',
    hairColor: '#09090b',
    hairStyle: 'buzz',
    topColor: '#0284c7',
    collarColor: '#bae6fd',
    pantsColor: '#1e293b',
    shoeColor: '#e2e8f0',
  },
  'agent-frontend': {
    name: 'Priya Kapoor',
    role: 'Junior Dev 2',
    skin: '#d97706',
    hairColor: '#1c1917',
    hairStyle: 'long-waves',
    topColor: '#7c3aed',
    collarColor: '#ede9fe',
    pantsColor: '#0f172a',
    shoeColor: '#ffffff',
  },
  'agent-qa': {
    name: 'Sasha Quinn',
    role: 'QA Lead',
    skin: '#fecdd3',
    hairColor: '#9f1239',
    hairStyle: 'ponytail',
    topColor: '#db2777',
    collarColor: '#fce7f3',
    pantsColor: '#1e293b',
    shoeColor: '#0f172a',
  },
  'agent-reviewer': {
    name: 'Victor Thorne',
    role: 'Junior QA',
    skin: '#e2e8f0',
    hairColor: '#27272a',
    hairStyle: 'parted',
    topColor: '#475569',
    collarColor: '#cbd5e1',
    pantsColor: '#0f172a',
    shoeColor: '#18181b',
    hasGlasses: true,
  },
  'agent-devops': {
    name: 'Caleb Cruz',
    role: 'DevOps Lead',
    skin: '#fcd34d',
    hairColor: '#422006',
    hairStyle: 'afro',
    topColor: '#ea580c',
    collarColor: '#ffedd5',
    pantsColor: '#1c1917',
    shoeColor: '#ffffff',
    hasHeadset: true,
  },
  'agent-sre': {
    name: 'Jaxson Reed',
    role: 'Infra & SRE',
    skin: '#fbcfe8',
    hairColor: '#18181b',
    hairStyle: 'fade',
    topColor: '#dc2626',
    collarColor: '#fee2e2',
    pantsColor: '#0f172a',
    shoeColor: '#111827',
  },
  'agent-data': {
    name: 'Maya Lin',
    role: 'Senior Support',
    skin: '#fed7aa',
    hairColor: '#172554',
    hairStyle: 'bun',
    topColor: '#9333ea',
    collarColor: '#f3e8ff',
    pantsColor: '#1e293b',
    shoeColor: '#000000',
    hasHeadset: true,
  },
  'agent-db': {
    name: 'Tariq Mansour',
    role: 'Junior Support',
    skin: '#b45309',
    hairColor: '#0a0a0a',
    hairStyle: 'buzz',
    topColor: '#16a34a',
    collarColor: '#dcfce7',
    pantsColor: '#0f172a',
    shoeColor: '#ffffff',
    hasHeadset: true,
  },
  'agent-sec': {
    name: 'Cipher Vance',
    role: 'Analytics Lead',
    skin: '#cbd5e1',
    hairColor: '#09090b',
    hairStyle: 'fade',
    topColor: '#0891b2',
    collarColor: '#cffafe',
    pantsColor: '#020617',
    shoeColor: '#000000',
    hasGlasses: true,
  },
};

// ─── 4. REALISTIC HUMAN SPRITE COMPONENT ───────────────────────────────────────
const HumanSprite: React.FC<{
  dna: CharacterDNA;
  state: string;
  facing: 'down' | 'up' | 'left' | 'right';
  activity?: 'presenting' | 'gaming' | 'resting' | 'working' | 'meeting';
}> = ({ dna, state, facing, activity }) => {
  const isWorking = state === 'WORKING';
  const isCompleted = state === 'COMPLETED';
  const isPresenting = activity === 'presenting';
  const isGaming = activity === 'gaming';
  const isResting = activity === 'resting';

  return (
    <g>
      {/* ── Shadow under feet ── */}
      <ellipse cx="0" cy="28" rx="14" ry="6" fill="#000000" opacity="0.25" />

      {/* ── FACING DOWN (Seen from Front - e.g. PM Presenting or Resting on Sofa) ── */}
      {facing === 'down' && (
        <g>
          {/* Shoes */}
          <rect x="-8" y="24" width="7" height="6" rx="2" fill={dna.shoeColor} />
          <rect x="1" y="24" width="7" height="6" rx="2" fill={dna.shoeColor} />

          {/* Legs / Trousers */}
          <rect x="-9" y="10" width="8" height="15" rx="2" fill={dna.pantsColor} />
          <rect x="1" y="10" width="8" height="15" rx="2" fill={dna.pantsColor} />

          {/* Torso / Blazer / Top */}
          <rect x="-12" y="-6" width="24" height="18" rx="4" fill={dna.topColor} />
          {/* Shirt / V-Neck collar */}
          <polygon points="-4,-6 4,-6 0,2" fill={dna.collarColor} />

          {/* ── Arms & Hands ── */}
          {isPresenting ? (
            <>
              {/* Left arm holding presenter tablet/remote */}
              <rect x="-17" y="-4" width="6" height="12" rx="2" fill={dna.topColor} />
              <rect x="-17" y="7" width="6" height="5" rx="2" fill={dna.skin} />
              <rect x="-19" y="8" width="5" height="7" rx="1" fill="#0284c7" />

              {/* Right arm actively pointing upward/towards TV with animation */}
              <g>
                <line x1="10" y1="-2" x2="18" y2="-16" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round">
                  <animate attributeName="x2" values="18;22;18" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="y2" values="-16;-20;-16" dur="1.8s" repeatCount="indefinite" />
                </line>
                <circle cx="18" cy="-17" r="3.5" fill={dna.skin}>
                  <animate attributeName="cx" values="18;22;18" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="cy" values="-17;-21;-17" dur="1.8s" repeatCount="indefinite" />
                </circle>
                {/* Laser Pointer Dot Beam on TV */}
                <line x1="18" y1="-17" x2="10" y2="-36" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.8">
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="0.8s" repeatCount="indefinite" />
                </line>
              </g>
            </>
          ) : (
            <>
              {/* Natural relaxed arms */}
              <rect x="-17" y="-4" width="6" height="14" rx="2" fill={dna.topColor} />
              <rect x="11" y="-4" width="6" height="14" rx="2" fill={dna.topColor} />
              <circle cx="-14" cy="11" r="3" fill={dna.skin} />
              <circle cx="14" cy="11" r="3" fill={dna.skin} />
              {isResting && (
                // Holding Coffee Mug
                <rect x="12" y="6" width="6" height="8" rx="2" fill="#ef4444" />
              )}
            </>
          )}

          {/* ── Head ── */}
          <rect x="-10" y="-24" width="20" height="20" rx="6" fill={dna.skin} />

          {/* Eyes & Eyebrows */}
          <circle cx="-4" cy="-14" r="1.8" fill="#1e293b" />
          <circle cx="4" cy="-14" r="1.8" fill="#1e293b" />
          <line x1="-7" y1="-17" x2="-2" y2="-17" stroke="#334155" strokeWidth="1.2" />
          <line x1="2" y1="-17" x2="7" y2="-17" stroke="#334155" strokeWidth="1.2" />

          {/* Glasses */}
          {dna.hasGlasses && (
            <g>
              <rect x="-7" y="-16" width="6" height="5" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="1.2" />
              <rect x="1" y="-16" width="6" height="5" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="1.2" />
              <line x1="-1" y1="-14" x2="1" y2="-14" stroke="#0f172a" strokeWidth="1" />
            </g>
          )}

          {/* Mouth (smiling/speaking) */}
          {isPresenting || isCompleted ? (
            <path d="M -3 -8 Q 0 -5 3 -8" fill="none" stroke="#b45309" strokeWidth="1.4" strokeLinecap="round" />
          ) : (
            <line x1="-3" y1="-8" x2="3" y2="-8" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" />
          )}

          {/* Hair Styling */}
          {dna.hairStyle === 'bun' && (
            <g>
              <path d="M -11 -22 C -11 -27 11 -27 11 -22 Z" fill={dna.hairColor} />
              <circle cx="0" cy="-28" r="6" fill={dna.hairColor} />
            </g>
          )}
          {dna.hairStyle === 'fade' && (
            <path d="M -11 -20 C -11 -27 11 -27 11 -20 L 11 -23 L -11 -23 Z" fill={dna.hairColor} />
          )}
          {dna.hairStyle === 'long-waves' && (
            <g>
              <path d="M -11 -22 C -11 -28 11 -28 11 -22 Z" fill={dna.hairColor} />
              <rect x="-12" y="-22" width="4" height="24" rx="2" fill={dna.hairColor} />
              <rect x="8" y="-22" width="4" height="24" rx="2" fill={dna.hairColor} />
            </g>
          )}
          {dna.hairStyle === 'parted' && (
            <path d="M -11 -21 C -11 -28 6 -28 11 -22 L 10 -19 L -11 -19 Z" fill={dna.hairColor} />
          )}
        </g>
      )}

      {/* ── FACING UP (Seen from Behind at Desk or Meeting Table) ── */}
      {facing === 'up' && (
        <g>
          {/* Chair backrest visible beneath shoulders */}
          <rect x="-14" y="6" width="28" height="8" rx="4" fill="#1e293b" opacity="0.6" />

          {/* Torso from behind */}
          <rect x="-12" y="-6" width="24" height="18" rx="4" fill={dna.topColor} />
          {/* Collar seam */}
          <path d="M -5 -6 Q 0 -3 5 -6" fill="none" stroke={dna.collarColor} strokeWidth="2" />

          {/* ── Animated Arms for Typing / Gaming / Meeting ── */}
          {isWorking ? (
            <>
              {/* Rapid professional typing motion */}
              <line x1="-12" y1="-2" x2="-8" y2="-12" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round">
                <animate attributeName="y2" values="-12;-15;-12" dur="0.18s" repeatCount="indefinite" />
              </line>
              <line x1="12" y1="-2" x2="8" y2="-12" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round">
                <animate attributeName="y2" values="-15;-12;-15" dur="0.18s" repeatCount="indefinite" />
              </line>
              <circle cx="-8" cy="-13" r="3" fill={dna.skin}>
                <animate attributeName="cy" values="-13;-16;-13" dur="0.18s" repeatCount="indefinite" />
              </circle>
              <circle cx="8" cy="-13" r="3" fill={dna.skin}>
                <animate attributeName="cy" values="-16;-13;-16" dur="0.18s" repeatCount="indefinite" />
              </circle>
            </>
          ) : isGaming ? (
            <>
              {/* Joystick mashing animation */}
              <line x1="-12" y1="-2" x2="-6" y2="-14" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round">
                <animate attributeName="x2" values="-6;-9;-4;-6" dur="0.25s" repeatCount="indefinite" />
              </line>
              <line x1="12" y1="-2" x2="6" y2="-14" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round">
                <animate attributeName="y2" values="-14;-17;-14" dur="0.15s" repeatCount="indefinite" />
              </line>
              <circle cx="-6" cy="-15" r="3" fill={dna.skin} />
              <circle cx="6" cy="-15" r="3" fill={dna.skin} />
            </>
          ) : (
            <>
              {/* Seated resting hands on table / desk */}
              <line x1="-12" y1="-2" x2="-7" y2="-9" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round" />
              <line x1="12" y1="-2" x2="7" y2="-9" stroke={dna.topColor} strokeWidth="5" strokeLinecap="round" />
              <circle cx="-7" cy="-10" r="3" fill={dna.skin} />
              <circle cx="7" cy="-10" r="3" fill={dna.skin} />
            </>
          )}

          {/* ── Head from Behind (Shows Full Hairstyle!) ── */}
          <rect x="-10" y="-24" width="20" height="20" rx="6" fill={dna.hairColor} />
          {/* Neck visible below hair */}
          <rect x="-4" y="-7" width="8" height="4" fill={dna.skin} />

          {/* Specific hair shapes from back */}
          {dna.hairStyle === 'bun' && (
            <circle cx="0" cy="-28" r="6.5" fill={dna.hairColor} stroke="#0f172a" strokeWidth="1" />
          )}
          {dna.hairStyle === 'long-waves' && (
            <path d="M -12 -20 L -10 2 L 10 2 L 12 -20 Z" fill={dna.hairColor} />
          )}
          {dna.hairStyle === 'ponytail' && (
            <g>
              <circle cx="0" cy="-22" r="3" fill="#3b82f6" />
              <path d="M 0 -22 Q 8 -12 4 4" fill="none" stroke={dna.hairColor} strokeWidth="5" strokeLinecap="round" />
            </g>
          )}

          {/* Headset wire / band */}
          {dna.hasHeadset && (
            <g>
              <path d="M -11 -18 A 11 11 0 0 1 11 -18" fill="none" stroke="#334155" strokeWidth="3" />
              <rect x="-13" y="-18" width="4" height="8" rx="2" fill="#0284c7" />
              <rect x="9" y="-18" width="4" height="8" rx="2" fill="#0284c7" />
            </g>
          )}
        </g>
      )}

      {/* ── FACING LEFT / RIGHT ── */}
      {(facing === 'left' || facing === 'right') && (
        <g transform={facing === 'left' ? 'scale(-1, 1)' : undefined}>
          <rect x="-6" y="24" width="10" height="6" rx="2" fill={dna.shoeColor} />
          <rect x="-7" y="10" width="10" height="15" rx="2" fill={dna.pantsColor} />
          <rect x="-8" y="-6" width="14" height="18" rx="4" fill={dna.topColor} />
          <rect x="-6" y="-24" width="16" height="20" rx="5" fill={dna.skin} />
          <path d="M -7 -25 C -7 -28 8 -28 8 -22 Z" fill={dna.hairColor} />
          <circle cx="4" cy="-14" r="1.8" fill="#1e293b" />
          <line x1="0" y1="-2" x2="8" y2="-6" stroke={dna.topColor} strokeWidth="4" strokeLinecap="round" />
          <circle cx="8" cy="-6" r="3" fill={dna.skin} />
        </g>
      )}
    </g>
  );
};

// ─── 5. SMART STATE BUBBLE (Pixel Thought / Speech / Emote Bubble) ─────────────
const StateBubble: React.FC<{
  state: string;
  activeAction?: string;
  activity?: string;
}> = ({ state, activeAction, activity }) => {
  if (activity === 'gaming') {
    return (
      <g transform="translate(0, -46)">
        <rect x="-35" y="-14" width="70" height="20" rx="6" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1.5" />
        <polygon points="-4,6 4,6 0,10" fill="#1e1b4b" />
        <text x="0" y="0" textAnchor="middle" fill="#c084fc" fontSize="8" fontWeight="bold" fontFamily="monospace">
          🎮 GAMING
        </text>
      </g>
    );
  }

  if (activity === 'resting') {
    return (
      <g transform="translate(0, -46)">
        <rect x="-35" y="-14" width="70" height="20" rx="6" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
        <polygon points="-4,6 4,6 0,10" fill="#064e3b" />
        <text x="0" y="0" textAnchor="middle" fill="#6ee7b7" fontSize="8" fontWeight="bold" fontFamily="monospace">
          ☕ ON BREAK
        </text>
      </g>
    );
  }

  if (state === 'THINKING') {
    return (
      <g transform="translate(16, -46)">
        <ellipse cx="0" cy="0" rx="16" ry="14" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" />
        <circle cx="-6" cy="16" r="3.5" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.5" />
        <circle cx="-10" cy="22" r="2" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.5" />
        <text x="0" y="4" textAnchor="middle" fontSize="13">💡</text>
      </g>
    );
  }

  if (state === 'COMPLETED') {
    return (
      <g transform="translate(16, -46)">
        <ellipse cx="0" cy="0" rx="16" ry="14" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        <circle cx="-6" cy="16" r="3.5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
        <text x="0" y="4" textAnchor="middle" fontSize="13">✨</text>
      </g>
    );
  }

  if (state === 'BLOCKED' || state === 'FAILED') {
    return (
      <g transform="translate(16, -46)">
        <rect x="-14" y="-14" width="28" height="28" rx="4" fill="#fee2e2" stroke="#ef4444" strokeWidth="2" />
        <text x="0" y="6" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#ef4444">!</text>
      </g>
    );
  }

  if (state === 'WORKING' || state === 'COMMUNICATING') {
    const label = activeAction ? activeAction.slice(0, 16) : 'Working...';
    return (
      <g transform="translate(0, -48)">
        <rect
          x="-45"
          y="-14"
          width="90"
          height="22"
          rx="6"
          fill="#0f172a"
          stroke="#38bdf8"
          strokeWidth="1.5"
          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
        />
        <polygon points="-4,8 4,8 0,14" fill="#0f172a" />
        <text x="0" y="1" textAnchor="middle" fill="#7dd3fc" fontSize="8" fontWeight="bold" fontFamily="monospace">
          {label}
        </text>
      </g>
    );
  }

  return null;
};

// ─── 6. DYNAMIC AGENT SPRITE WITH SMOOTH POSITION TRANSITIONS ──────────────────
export const AgentSprite: React.FC<{ agent: Agent }> = ({ agent }) => {
  const selectAgent = useStore((state) => state.selectAgent);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const isSelected = selectedAgentId === agent.id;

  const agentXP = useGamificationStore((state) => state.agentXP[agent.id] || 100);
  const agentLevel = useGamificationStore((state) => state.agentLevels[agent.id] || 'Senior');

  const dna = CHARACTER_DNA[agent.id];
  const baseCoord = AGENT_COORDINATES[agent.id] || { x: 900, y: 450, zone: 'office', facing: 'up' };

  // ── Dynamic Location State ──
  // Non-leadership agents who are IDLE rotate occasionally to gaming/resting areas
  const [loungeIndex, setLoungeIndex] = useState<number | null>(null);

  useEffect(() => {
    // Only idle agents take breaks, and leadership stays in boardroom/pod
    const canTakeBreak =
      agent.state === 'IDLE' &&
      agent.id !== 'agent-pm' &&
      agent.id !== 'agent-arch' &&
      agent.id !== 'agent-doc' &&
      agent.id !== 'agent-research';

    if (!canTakeBreak) {
      setLoungeIndex(null);
      return;
    }

    // Assign a break spot using hash of agent ID + current time slice (every 35s)
    const updateBreakSpot = () => {
      const timeSlice = Math.floor(Date.now() / 35000);
      const agentHash = agent.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const isOutForBreak = (agentHash + timeSlice) % 3 === 0; // 33% chance to be relaxing when idle

      if (isOutForBreak) {
        const spotIndex = (agentHash + timeSlice) % LOUNGE_SPOTS.length;
        setLoungeIndex(spotIndex);
      } else {
        setLoungeIndex(null); // At desk
      }
    };

    updateBreakSpot();
    const timer = setInterval(updateBreakSpot, 15000);
    return () => clearInterval(timer);
  }, [agent.state, agent.id]);

  // When work is assigned (non-IDLE), immediate return to desk!
  const isAtLounge = agent.state === 'IDLE' && loungeIndex !== null;
  const currentPos: DeskPosition = isAtLounge
    ? LOUNGE_SPOTS[loungeIndex!]
    : baseCoord;

  if (!dna) return null;

  const xpProgress = Math.min(100, agentXP % 100);
  const levelColor =
    agentLevel === 'Legend' ? '#f59e0b' :
    agentLevel === 'Principal' ? '#a855f7' :
    agentLevel === 'Senior' ? '#38bdf8' :
    agentLevel === 'Mid' ? '#34d399' :
    '#94a3b8';

  return (
    <g
      id={`agent-sprite-${agent.id}`}
      style={{
        transform: `translate(${currentPos.x}px, ${currentPos.y}px)`,
        transition: 'transform 0.85s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer',
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectAgent(agent.id);
      }}
    >
      {/* ── Selection Ring ── */}
      {isSelected && (
        <g>
          <circle cx="0" cy="5" r="32" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4">
            <animateTransform attributeName="transform" type="rotate" from="0 0 5" to="360 0 5" dur="6s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="5" r="32" fill="#38bdf8" fillOpacity="0.08" />
        </g>
      )}

      {/* ── Character Sprite ── */}
      <HumanSprite
        dna={dna}
        state={agent.state}
        facing={currentPos.facing}
        activity={currentPos.activity}
      />

      {/* ── State / Thought Bubble ── */}
      <StateBubble
        state={agent.state}
        activeAction={agent.activeAction}
        activity={currentPos.activity}
      />

      {/* ── Modern Wide Name Badge (Non-Congested & Crisp) ── */}
      <g transform="translate(0, 42)">
        {/* Name Pill Box */}
        <rect
          x="-58"
          y="-12"
          width="116"
          height="22"
          rx="6"
          fill="#0f172a"
          stroke={isSelected ? '#38bdf8' : '#334155'}
          strokeWidth={isSelected ? 2 : 1}
          filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))"
        />
        {/* Agent Name */}
        <text
          x="0"
          y="3"
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="9"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {dna.name}
        </text>
      </g>

      {/* ── Role & XP Tier Bar ── */}
      <g transform="translate(0, 58)">
        {/* Role label */}
        <rect
          x="-58"
          y="-3"
          width="116"
          height="14"
          rx="3"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="0.8"
        />
        <text
          x="0"
          y="7"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="7.5"
          fontWeight="600"
          fontFamily="monospace"
        >
          {dna.role}
        </text>

        {/* Mini XP Progress Line */}
        <rect x="-56" y="14" width="112" height="3" rx="1.5" fill="#334155" />
        <rect x="-56" y="14" width={(112 * xpProgress) / 100} height="3" rx="1.5" fill={levelColor} />
      </g>
    </g>
  );
};
